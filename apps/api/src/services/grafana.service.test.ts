import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { clearGrafanaCache, describePromError, fetchGrafanaDeploys, fetchGrafanaSeries, fetchGrafanaStats, GRAFANA_SERIES } from "./grafana.service";

const env = {
  GRAFANA_PROM_URL: "https://prometheus-prod-00.example.net/api/prom/",
  GRAFANA_PROM_USER: "123456",
  GRAFANA_PROM_TOKEN: "token-secreto-de-teste",
};
const NOW = 1_800_000_000_000;
const ok = (values: [number, string][]) => async () => ({
  status: 200,
  json: async () => ({ status: "success", data: { result: [{ values }] } }),
});

describe("fetchGrafanaSeries", () => {
  beforeEach(() => clearGrafanaCache());

  it("sem configuração devolve configured=false e não chama o Grafana", async () => {
    let chamou = false;
    const r = await fetchGrafanaSeries("memory_mb", "1h", { env: {}, now: () => NOW, fetch: async () => { chamou = true; return { status: 200, json: async () => ({}) }; } });
    assert.deepEqual(r, { configured: false });
    assert.equal(chamou, false);
  });

  it("recusa URL que não seja https", async () => {
    const r = await fetchGrafanaSeries("memory_mb", "1h", { env: { ...env, GRAFANA_PROM_URL: "http://localhost:9090" }, now: () => NOW });
    assert.deepEqual(r, { configured: false });
  });

  it("monta query_range com a consulta da lista, autenticação básica e passo do período", async () => {
    let url = "";
    let auth = "";
    const r = await fetchGrafanaSeries("latency_p95_ms", "24h", {
      env,
      now: () => NOW,
      fetch: async (u, init) => {
        url = u;
        auth = init.headers.Authorization;
        return ok([[1_799_999_700, "12.5"], [1_800_000_000, "NaN"], [1_800_000_300, "20"]])();
      },
    });
    const q = new URL(url);
    assert.equal(q.origin + q.pathname, "https://prometheus-prod-00.example.net/api/prom/api/v1/query_range");
    assert.equal(q.searchParams.get("query"), GRAFANA_SERIES.latency_p95_ms.query);
    assert.equal(q.searchParams.get("step"), "300");
    assert.equal(Number(q.searchParams.get("end")) - Number(q.searchParams.get("start")), 86_400);
    assert.equal(auth, `Basic ${Buffer.from("123456:token-secreto-de-teste").toString("base64")}`);
    assert.equal(r.configured && r.ok, true);
    if (r.configured && r.ok) {
      assert.deepEqual(r.points, [{ t: 1_799_999_700_000, v: 12.5 }, { t: 1_800_000_300_000, v: 20 }]);
      assert.equal(r.unit, "ms");
    }
  });

  it("token recusado vira erro claro, sem vazar o token", async () => {
    const r = await fetchGrafanaSeries("memory_mb", "1h", { env, now: () => NOW, fetch: async () => ({ status: 401, json: async () => ({}) }) });
    assert.equal(r.configured && !r.ok, true);
    assert.ok(!JSON.stringify(r).includes("token-secreto-de-teste"));
  });

  it("falha de rede vira erro genérico", async () => {
    const r = await fetchGrafanaSeries("memory_mb", "1h", { env, now: () => NOW, fetch: async () => { throw new TypeError("fetch failed"); } });
    assert.equal(r.configured && !r.ok, true);
    if (r.configured && !r.ok) assert.match(r.error, /Grafana/);
  });

  it("guarda em cache por 30 s e consulta de novo depois", async () => {
    let chamadas = 0;
    let t = NOW;
    const deps = { env, now: () => t, fetch: async () => { chamadas += 1; return ok([[1_799_999_999, "1"]])(); } };
    await fetchGrafanaSeries("cpu_percent", "1h", deps);
    await fetchGrafanaSeries("cpu_percent", "1h", deps);
    assert.equal(chamadas, 1);
    t += 31_000;
    await fetchGrafanaSeries("cpu_percent", "1h", deps);
    assert.equal(chamadas, 2);
  });
});

describe("fetchGrafanaDeploys", () => {
  beforeEach(() => clearGrafanaCache());

  const deployBody = {
    status: "success",
    data: {
      result: [
        { metric: { commit: "aaaaaaa" }, values: [[1_799_000_000, "1"], [1_799_500_000, "1"]] },
        { metric: { commit: "bbbbbbb" }, values: [[1_799_700_000, "1"], [1_799_999_900, "1"]] },
        { metric: {}, values: [[1_799_999_900, "1"]] },
      ],
    },
  };

  it("sem configuração devolve configured=false", async () => {
    assert.deepEqual(await fetchGrafanaDeploys("7d", { env: {}, now: () => NOW }), { configured: false });
  });

  it("lista commits do mais novo ao mais antigo e marca o atual", async () => {
    let url = "";
    const r = await fetchGrafanaDeploys("7d", {
      env,
      now: () => NOW,
      fetch: async (u) => { url = u; return { status: 200, json: async () => deployBody }; },
    });
    assert.match(decodeURIComponent(url.replace(/\+/g, " ")), /max by \(commit\) \(periscopio_build_info\)/);
    assert.equal(r.configured && r.ok, true);
    if (r.configured && r.ok) {
      assert.deepEqual(r.deploys.map((d) => d.commit), ["bbbbbbb", "aaaaaaa"]);
      assert.equal(r.deploys[0].current, true);
      assert.equal(r.deploys[1].current, false);
      assert.equal(r.deploys[0].firstSeen, 1_799_700_000_000);
    }
  });

  it("token recusado vira erro sem vazar o token", async () => {
    const r = await fetchGrafanaDeploys("24h", { env, now: () => NOW, fetch: async () => ({ status: 403, json: async () => ({}) }) });
    assert.equal(r.configured && !r.ok, true);
    assert.ok(!JSON.stringify(r).includes("token-secreto-de-teste"));
  });
});

describe("describePromError", () => {
  it("aponta a variável provável conforme a causa", () => {
    assert.match(describePromError(Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } })), /GRAFANA_PROM_URL não existe|não existe \(DNS\)/);
    assert.match(describePromError(Object.assign(new Error("x"), { name: "AbortError" })), /a tempo/);
    assert.match(describePromError(new SyntaxError("Unexpected token <")), /\/api\/prom/);
    assert.match(describePromError(new Error("boom")), /GRAFANA_PROM_URL/);
  });

  it("uma resposta que não é JSON vira dica de endereço, não 'rede ou tempo esgotado'", async () => {
    const r = await fetchGrafanaSeries("memory_mb", "1h", { env, now: () => NOW, fetch: async () => ({ status: 200, json: async () => { throw new SyntaxError("Unexpected token <"); } }) });
    assert.equal(r.configured && !r.ok, true);
    if (r.configured && !r.ok) assert.match(r.error, /\/api\/prom/);
  });
});

describe("fetchGrafanaStats", () => {
  beforeEach(() => clearGrafanaCache());

  const vec = (rows: { m?: Record<string, string>; v: string }[]) => ({ status: "success", data: { result: rows.map((r) => ({ metric: r.m ?? {}, value: [1_800_000_000, r.v] })) } });
  const answers = (q: string) => {
    if (q.includes("periscopio_uptime_seconds")) return vec([{ v: "86400" }]);
    if (q.includes('status_class="5xx"')) return vec([{ v: "3.2" }]);
    if (q.includes("periscopio_http_requests_total")) return vec([{ v: "1500.4" }]);
    if (q.includes("histogram_quantile")) return vec([{ v: "480" }]);
    if (q.includes("resident_memory")) return vec([{ v: "210.6" }]);
    if (q.includes('direction="input"')) return vec([{ v: "10000" }]);
    if (q.includes('direction="output"')) return vec([{ v: "2500" }]);
    if (q.includes('status="error"')) return vec([{ v: "1" }]);
    if (q.includes("by (provider, model)")) return vec([{ m: { provider: "groq", model: "m1" }, v: "9000" }, { m: { provider: "gemini", model: "m2" }, v: "3500" }, { m: { provider: "x", model: "y" }, v: "0" }]);
    if (q.includes("by (feature)")) return vec([{ m: { feature: "assistente_bi" }, v: "12000" }, { m: { feature: "resumo_tea" }, v: "500" }]);
    if (q.includes("periscopio_ai_requests_total")) return vec([{ v: "14" }]);
    return vec([]);
  };
  const fakeFetch = async (u: string) => ({ status: 200, json: async () => answers(decodeURIComponent(new URL(u).searchParams.get("query")!.replace(/\+/g, " "))) });

  it("sem configuração devolve configured=false", async () => {
    assert.deepEqual(await fetchGrafanaStats("24h", { env: {}, now: () => NOW }), { configured: false });
  });

  it("junta os números e ordena o uso de IA por modelo e por recurso", async () => {
    const r = await fetchGrafanaStats("24h", { env, now: () => NOW, fetch: fakeFetch });
    assert.equal(r.configured && r.ok, true);
    if (r.configured && r.ok) {
      assert.equal(r.stats.requests, 1500);
      assert.equal(r.stats.errors5xx, 3);
      assert.equal(r.stats.p95Ms, 480);
      assert.equal(r.stats.memoryMb, 211);
      assert.equal(r.stats.uptimeSeconds, 86400);
      assert.deepEqual([r.stats.ai.inputTokens, r.stats.ai.outputTokens, r.stats.ai.calls, r.stats.ai.errors], [10000, 2500, 14, 1]);
      assert.deepEqual(r.stats.ai.byModel.map((m) => m.model), ["m1", "m2"]);
      assert.deepEqual(r.stats.ai.byFeature.map((f) => f.feature), ["assistente_bi", "resumo_tea"]);
      assert.deepEqual(r.pricing, { inputPerMtok: null, outputPerMtok: null, currency: "US$" });
    }
  });

  it("os preços só aparecem se o administrador os definir", async () => {
    const r = await fetchGrafanaStats("7d", { env: { ...env, AI_PRICE_INPUT_PER_MTOK: "0.5", AI_PRICE_OUTPUT_PER_MTOK: "1.5", AI_PRICE_CURRENCY: "R$" }, now: () => NOW, fetch: fakeFetch });
    if (r.configured && r.ok) assert.deepEqual(r.pricing, { inputPerMtok: 0.5, outputPerMtok: 1.5, currency: "R$" });
    else assert.fail("esperava ok");
  });

  it("série sem dados vira null, não zero inventado", async () => {
    const r = await fetchGrafanaStats("24h", { env, now: () => NOW, fetch: async () => ({ status: 200, json: async () => vec([]) }) });
    if (r.configured && r.ok) {
      assert.equal(r.stats.requests, null);
      assert.equal(r.stats.ai.inputTokens, null);
      assert.deepEqual(r.stats.ai.byModel, []);
    } else assert.fail("esperava ok");
  });

  it("token recusado devolve erro sem vazar o token", async () => {
    const r = await fetchGrafanaStats("24h", { env, now: () => NOW, fetch: async () => ({ status: 401, json: async () => ({}) }) });
    assert.equal(r.configured && !r.ok, true);
    assert.ok(!JSON.stringify(r).includes("token-secreto-de-teste"));
  });
});
