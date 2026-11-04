import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { clearGrafanaCache, fetchGrafanaSeries, GRAFANA_SERIES } from "./grafana.service";

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
