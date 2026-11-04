import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { otlpPushStatus, pushMetricsOnce, resolveOtlpConfig, startOtlpPush } from "./otlp-push";

const env = {
  GRAFANA_OTLP_ENDPOINT: "https://otlp-gateway-teste.example.net/otlp/",
  GRAFANA_OTLP_USER: "123456",
  GRAFANA_OTLP_TOKEN: "token-secreto-de-teste",
};

describe("resolveOtlpConfig", () => {
  it("fica desligado se faltar qualquer variável", () => {
    assert.equal(resolveOtlpConfig({}), null);
    assert.equal(resolveOtlpConfig({ ...env, GRAFANA_OTLP_TOKEN: "  " }), null);
  });

  it("recusa endereço que não seja https", () => {
    assert.equal(resolveOtlpConfig({ ...env, GRAFANA_OTLP_ENDPOINT: "http://localhost:4318" }), null);
  });

  it("monta /v1/metrics uma única vez, com ou sem o sufixo no valor", () => {
    assert.equal(resolveOtlpConfig(env)?.url, "https://otlp-gateway-teste.example.net/otlp/v1/metrics");
    assert.equal(resolveOtlpConfig({ ...env, GRAFANA_OTLP_ENDPOINT: "https://otlp-gateway-teste.example.net/otlp/v1/metrics" })?.url, "https://otlp-gateway-teste.example.net/otlp/v1/metrics");
  });
});

describe("pushMetricsOnce", () => {
  it("sem configuração não chama a rede", async () => {
    let chamou = false;
    const ok = await pushMetricsOnce({ env: {}, fetch: async () => { chamou = true; return { status: 200 }; } });
    assert.equal(ok, false);
    assert.equal(chamou, false);
    assert.equal(otlpPushStatus().enabled, false);
  });

  it("envia JSON com autenticação básica e registra o sucesso", async () => {
    let seen: { url: string; auth: string; type: string; body: any } | null = null;
    const ok = await pushMetricsOnce({
      env,
      now: () => 1_800_000_000_000,
      fetch: async (url, init) => { seen = { url, auth: init.headers.Authorization, type: init.headers["Content-Type"], body: JSON.parse(init.body) }; return { status: 200 }; },
    });
    assert.equal(ok, true);
    assert.equal(seen!.url, "https://otlp-gateway-teste.example.net/otlp/v1/metrics");
    assert.equal(seen!.auth, `Basic ${Buffer.from("123456:token-secreto-de-teste").toString("base64")}`);
    assert.equal(seen!.type, "application/json");
    assert.ok(seen!.body.resourceMetrics[0].scopeMetrics[0].metrics.length >= 7);
    const st = otlpPushStatus();
    assert.equal(st.enabled, true);
    assert.equal(st.lastError, null);
    assert.ok(st.lastOkAt);
  });

  it("credencial recusada e falha de rede viram estado, sem lançar nem vazar o token", async () => {
    const avisos: string[] = [];
    const r1 = await pushMetricsOnce({ env, now: () => 2_000_000_000_000, warn: (m) => avisos.push(m), fetch: async () => ({ status: 401 }) });
    assert.equal(r1, false);
    assert.match(otlpPushStatus().lastError ?? "", /recusou as credenciais/);
    const r2 = await pushMetricsOnce({ env, now: () => 2_000_000_100_000, warn: (m) => avisos.push(m), fetch: async () => { throw new TypeError("fetch failed"); } });
    assert.equal(r2, false);
    assert.match(otlpPushStatus().lastError ?? "", /Grafana/);
    assert.ok(!JSON.stringify([otlpPushStatus(), avisos]).includes("token-secreto-de-teste"));
  });
});

describe("startOtlpPush", () => {
  it("sem configuração devolve um desligador vazio e não agenda nada", () => {
    const stop = startOtlpPush(1000, { env: {} });
    assert.equal(typeof stop, "function");
    stop();
    assert.equal(otlpPushStatus().enabled, false);
  });
});
