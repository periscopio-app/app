/**
 * Painel de dados (Databricks) [REG-013]: sem rede, sem banco. Garante que fica desligado sem as variáveis, que nada
 * sensível vaza em mensagem, que o cliente não consegue injetar SQL e que células pequenas são suprimidas.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { DATABRICKS_PAINEIS, PAINEL_IDS, clearDatabricksCache, consultarPainel, minimoPorCelula, motivoNaoConfigurado, statusDoPainel } from "./databricks.service";

const ENV = { DATABRICKS_HOST: "https://exemplo.cloud.databricks.com", DATABRICKS_WAREHOUSE_ID: "abc123", DATABRICKS_TOKEN: "token-de-teste-aaaaaaaaaaaa" };
const ok = (body: unknown, status = 200) => async () => ({ status, json: async () => body });
const tabela = (cols: string[], linhas: unknown[][]) => ({ status: { state: "SUCCEEDED" }, manifest: { schema: { columns: cols.map((name) => ({ name })) } }, result: { data_array: linhas } });

describe("[REG-013] painel de dados (Databricks)", () => {
  beforeEach(() => clearDatabricksCache());

  test("sem variáveis fica desligado e diz só os NOMES que faltam", async () => {
    const r = await consultarPainel("casos_por_estado", { env: {} });
    assert.equal(r.configured, false);
    assert.match((r as { reason: string }).reason, /DATABRICKS_HOST, DATABRICKS_WAREHOUSE_ID, DATABRICKS_TOKEN/);
    assert.equal(statusDoPainel({}).configured, false);
    assert.equal(statusDoPainel(ENV).configured, true);
  });

  test("host sem https ou catálogo inválido não liga e não repete o valor", () => {
    const m = motivoNaoConfigurado({ ...ENV, DATABRICKS_HOST: "http://exemplo.com" });
    assert.match(m, /https:\/\//);
    assert.ok(!m.includes("exemplo.com"));
    assert.match(motivoNaoConfigurado({ ...ENV, DATABRICKS_CATALOG: "x; DROP" }), /CATALOG/);
  });

  test("o SQL enviado vem só da lista fechada, com o token só no cabeçalho", async () => {
    let enviado: { url: string; headers: Record<string, string>; body: string } | null = null;
    await consultarPainel("casos_por_mes", {
      env: ENV,
      fetch: async (url, init) => {
        enviado = { url, headers: init.headers, body: init.body };
        return { status: 200, json: async () => tabela(["mes", "total"], []) };
      },
    });
    assert.ok(enviado);
    const e = enviado as { url: string; headers: Record<string, string>; body: string };
    assert.equal(e.url, "https://exemplo.cloud.databricks.com/api/2.0/sql/statements");
    assert.equal(e.headers.Authorization, `Bearer ${ENV.DATABRICKS_TOKEN}`);
    assert.ok(!e.body.includes(ENV.DATABRICKS_TOKEN), "token nunca vai no corpo");
    const corpo = JSON.parse(e.body);
    assert.match(corpo.statement, /^SELECT mes, total FROM periscopio\.gold\.casos_por_mes ORDER BY mes LIMIT 500$/);
    assert.equal(corpo.warehouse_id, "abc123");
  });

  test("há um painel por view e nenhum pede coluna de pessoa", () => {
    assert.deepEqual([...PAINEL_IDS].sort(), ["casos_por_escola", "casos_por_estado", "casos_por_mes", "delegacoes_por_especialidade"]);
    for (const id of PAINEL_IDS) assert.ok(!DATABRICKS_PAINEIS[id].colunas.some((c) => /nome|cpf|aluno|student|email|telefone/i.test(c)), id);
  });

  test("células com total abaixo do mínimo são suprimidas (padrão 5)", async () => {
    const r = await consultarPainel("casos_por_estado", { env: ENV, fetch: ok(tabela(["estado", "total"], [["enviado_re", "12"], ["delegado", "2"]])) });
    assert.equal(r.configured && r.ok, true);
    if (!(r.configured && r.ok)) return;
    assert.deepEqual(r.linhas, [["enviado_re", 12], ["delegado", null]]);
    assert.equal(r.suprimidas, 1);
    assert.equal(r.minimoPorCelula, 5);
    assert.equal(minimoPorCelula({ DATABRICKS_MIN_CELL: "10" }), 10);
    assert.equal(minimoPorCelula({ DATABRICKS_MIN_CELL: "abc" }), 5);
  });

  test("credencial recusada, erro HTTP, consulta não concluída e rede viram mensagem segura", async () => {
    const casos: [Parameters<typeof consultarPainel>[1], RegExp][] = [
      [{ env: ENV, fetch: ok({}, 401) }, /recusou a credencial/],
      [{ env: ENV, fetch: ok({}, 500) }, /HTTP 500/],
      [{ env: ENV, fetch: ok({ status: { state: "FAILED" } }) }, /não terminou/],
      [{ env: ENV, fetch: async () => { throw Object.assign(new Error("getaddrinfo ENOTFOUND exemplo.cloud.databricks.com"), { code: "ENOTFOUND" }); } }, /DNS/],
    ];
    for (const [deps, re] of casos) {
      clearDatabricksCache();
      const r = await consultarPainel("casos_por_estado", deps);
      assert.equal(r.configured && !r.ok, true);
      const msg = (r as { error: string }).error;
      assert.match(msg, re);
      assert.ok(!msg.includes(ENV.DATABRICKS_TOKEN) && !msg.includes("exemplo.cloud"), "nada sensível na mensagem");
    }
  });

  test("resposta boa fica em cache; erro não", async () => {
    let chamadas = 0;
    const f = async () => { chamadas++; return { status: 200, json: async () => tabela(["escola", "total"], [["E1", 9]]) }; };
    await consultarPainel("casos_por_escola", { env: ENV, fetch: f, now: () => 1000 });
    await consultarPainel("casos_por_escola", { env: ENV, fetch: f, now: () => 2000 });
    assert.equal(chamadas, 1);
    await consultarPainel("casos_por_escola", { env: ENV, fetch: f, now: () => 1000 + 6 * 60_000 });
    assert.equal(chamadas, 2);
  });
});
