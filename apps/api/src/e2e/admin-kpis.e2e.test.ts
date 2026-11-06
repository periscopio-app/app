/**
 * REG-020 — KPIs internos do Administrador Master: mediana do tempo de preenchimento do FOGAP e volumetria das justificativas.
 * Só agregados, só para quem tem `system.observability.view`. Dados sintéticos. Requer TEST_DATABASE_URL.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;

describe("KPIs do admin (REG-020)", { skip }, () => {
  let app: FastifyInstance;
  let tA = "";
  let tB = "";
  let registrar: typeof import("../services/justification-metrics.service").registrarJustificativa;
  let dbx: typeof import("../db/client").db;

  const call = async (path: string, email?: string) => {
    const headers: Record<string, string> = { origin: "http://localhost:3000" };
    if (email) headers["x-test-email"] = email;
    const r = await app.inject({ method: "GET", url: path, headers });
    let parsed: any = null;
    try { parsed = r.json(); } catch { parsed = r.body; }
    return { status: r.statusCode, body: parsed };
  };

  before(async () => {
    const { assertSafeTestDatabase, resetTestDatabase } = await import("../testing/test-db");
    assertSafeTestDatabase(url);
    await resetTestDatabase(url!);
    process.env.DATABASE_URL = url!;
    process.env.NODE_ENV = "test";
    process.env.BETTER_AUTH_SECRET = "segredo-de-teste-com-mais-de-32-caracteres!!";
    process.env.BETTER_AUTH_URL = "http://localhost:3001";
    process.env.CORS_ORIGINS = "http://localhost:3000";
    const shared = await import("@periscopio/shared");
    ({ db: dbx } = await import("../db/client"));
    ({ registrarJustificativa: registrar } = await import("../services/justification-metrics.service"));
    const [a] = await dbx.insert(shared.tenants).values({ name: "Município KA", municipalityCode: "KA" }).returning();
    const [b] = await dbx.insert(shared.tenants).values({ name: "Município KB", municipalityCode: "KB" }).returning();
    tA = a.id; tB = b.id;
    const [esc] = await dbx.insert(shared.schools).values({ tenantId: tA, name: "Escola K", slug: "k", status: "active" }).returning();
    const [escB] = await dbx.insert(shared.schools).values({ tenantId: tB, name: "Escola L", slug: "l", status: "active" }).returning();
    const [adm] = await dbx.insert(shared.users).values({ tenantId: tA, email: "adm@teste.local", name: "adm", role: "admin_platform", accessEnabled: true }).returning();
    const [re] = await dbx.insert(shared.users).values({ tenantId: tA, schoolId: esc.id, email: "re@teste.local", name: "re", role: "ppi", accessEnabled: true }).returning();
    await dbx.insert(shared.users).values({ tenantId: tA, email: "md@teste.local", name: "md", role: "md1", accessEnabled: true });
    void adm;

    const novoCaso = async (tenant: string, school: string, code: string, estado: string, segundos: number) => {
      const [st] = await dbx.insert(shared.students).values({ tenantId: tenant, schoolId: school, studentCode: code, birthYear: 2018, birthMonth: 3, ageBracket: "06-09", grade: "3º ano" }).returning();
      const [c] = await dbx.insert(shared.cases).values({ tenantId: tenant, studentId: st.id, status: "triagem", journeyState: estado as never }).returning();
      await dbx.insert(shared.reStepTimings).values({ tenantId: tenant, schoolId: school, caseId: c.id, step: "a", userId: re.id, userRole: "ppi", activeSeconds: Math.floor(segundos / 2) });
      await dbx.insert(shared.reStepTimings).values({ tenantId: tenant, schoolId: school, caseId: c.id, step: "i", userId: re.id, userRole: "ppi", activeSeconds: segundos - Math.floor(segundos / 2) });
    };
    // Município A: 5 casos enviados (300, 600, 900, 1000, 1500 s) e 1 ainda em rascunho (50000 s, não pode entrar).
    let i = 0;
    for (const s of [300, 600, 900, 1000, 1500]) await novoCaso(tA, esc.id, `K-${++i}`, "enviado_re", s);
    await novoCaso(tA, esc.id, "K-RASC", "rascunho", 50000);
    // Município B: só 2 casos (abaixo do limite de 5).
    await novoCaso(tB, escB.id, "L-1", "enviado_re", 400);
    await novoCaso(tB, escB.id, "L-2", "enviado_re", 800);

    const { buildApp } = await import("../app");
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await app?.close();
  });

  test("só quem vê a saúde do sistema acessa: RE, médico e visitante não recebem número", async () => {
    for (const path of ["/api/admin/kpis/fogap-fill-time", "/api/admin/kpis/justification-volume"]) {
      assert.equal((await call(path)).status, 401, `${path} sem sessão`);
      for (const who of ["re@teste.local", "md@teste.local"]) {
        const r = await call(path, who);
        assert.equal(r.status, 403, `${path} ${who}`);
        assert.ok(r.body.medianaSegundos === undefined && r.body.total === undefined);
      }
    }
  });

  test("mediana do FOGAP: soma as partes de cada caso enviado, ignora o rascunho e mostra a mediana em destaque", async () => {
    const r = await call(`/api/admin/kpis/fogap-fill-time?tenantId=${tA}`, "adm@teste.local");
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.casos, 5, "o caso em rascunho não entra");
    assert.equal(r.body.medianaSegundos, 900);
    assert.equal(r.body.mediaSegundos, 860);
    assert.equal(r.body.suppressed, false);
    assert.equal(r.body.passos.find((p: any) => p.step === "a").casos, 5);
    assert.ok(!JSON.stringify(r.body).includes("K-1") && !JSON.stringify(r.body).includes("Escola K"), "sem aluno nem escola");
  });

  test("município com menos de 5 casos: números ocultos; sem filtro, soma os dois", async () => {
    const b = await call(`/api/admin/kpis/fogap-fill-time?tenantId=${tB}`, "adm@teste.local");
    assert.equal(b.body.casos, 2);
    assert.equal(b.body.suppressed, true);
    assert.equal(b.body.medianaSegundos, null);
    const todos = await call("/api/admin/kpis/fogap-fill-time", "adm@teste.local");
    assert.equal(todos.body.casos, 7);
    assert.equal(todos.body.medianaSegundos, 800);
  });

  test("filtro inválido é 400", async () => {
    assert.equal((await call("/api/admin/kpis/fogap-fill-time?tenantId=x", "adm@teste.local")).status, 400);
    assert.equal((await call("/api/admin/kpis/fogap-fill-time?dias=0", "adm@teste.local")).status, 400);
  });

  test("volumetria das justificativas: soma contagens por formulário e nunca devolve o texto", async () => {
    const texto = "A professora observou que o aluno se afasta do grupo quando a sala fica barulhenta e volta a participar quando o ambiente fica calmo.";
    await registrar(dbx, { tenantId: tA, form: "devolucao", kind: "devolucao", texto });
    await registrar(dbx, { tenantId: tA, form: "devolucao", kind: "devolucao", texto });
    await registrar(dbx, { tenantId: tB, form: "fogap", kind: "sim_nao", texto });
    const r = await call("/api/admin/kpis/justification-volume", "adm@teste.local");
    assert.equal(r.status, 200);
    const dev = r.body.porFormulario.find((x: any) => x.form === "devolucao");
    assert.equal(dev.n, 2);
    assert.equal(dev.chars, texto.length * 2);
    assert.equal(dev.estTokens, Math.ceil(texto.length / 4) * 2);
    assert.equal(r.body.total.n, 3);
    assert.ok(!JSON.stringify(r.body).includes("professora"), "o texto não é guardado nem devolvido");
    const soB = await call(`/api/admin/kpis/justification-volume?tenantId=${tB}`, "adm@teste.local");
    assert.equal(soB.body.total.n, 1);
  });
});
