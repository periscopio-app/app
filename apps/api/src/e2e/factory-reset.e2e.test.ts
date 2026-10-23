/**
 * Reset de fábrica do piloto (Bloco 2) — E2E com dados sintéticos.
 * Prova a regra mais importante: o reset zera SÓ municípios de demonstração (demo = true)
 * e NUNCA toca em município real (Tarumã), mesmo que alguém o marque como demo por engano.
 * Requer TEST_DATABASE_URL.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;

describe("Reset de fábrica do piloto (E2E)", { skip }, () => {
  let app: FastifyInstance;
  let dbx: typeof import("../db/client").db;
  let shared: typeof import("@periscopio/shared");
  const ids: Record<string, string> = {};

  const call = async (method: string, path: string, who?: string, body?: unknown) => {
    const headers: Record<string, string> = { origin: "http://localhost:3000" };
    if (who) headers["x-test-email"] = `${who}@teste.local`.toLowerCase();
    if (body !== undefined) headers["content-type"] = "application/json";
    const r = await app.inject({ method: method as never, url: path, headers, payload: body === undefined ? undefined : JSON.stringify(body) });
    let parsed: any = null;
    try { parsed = r.json(); } catch { parsed = r.body; }
    return { status: r.statusCode, body: parsed };
  };

  const criarCasoCompleto = async (tenantId: string, schoolId: string, reId: string, code: string) => {
    const [st] = await dbx.insert(shared.students).values({ tenantId, schoolId, studentCode: code, birthYear: 2018, birthMonth: 3, ageBracket: "06-09", grade: "3º ano" }).returning();
    const [c] = await dbx.insert(shared.cases).values({ tenantId, studentId: st.id, status: "triagem", journeyState: "revisao_medica" as never }).returning();
    await dbx.insert(shared.reAssessments).values({ tenantId, caseId: c.id, formCode: shared.FOGAP_FORM_CODE, formVersion: shared.FOGAP_VERSION, status: "enviado", payload: {}, createdBy: reId, submittedAt: new Date(), submittedBy: reId });
    await dbx.insert(shared.caseTransitions).values({ tenantId, caseId: c.id, fromState: "rascunho", toState: "revisao_medica", actorId: reId, actorRole: "ppi", reason: "teste" });
    await dbx.insert(shared.teacherObservations).values({ tenantId, studentId: st.id, teacherId: reId, kind: "flash", domain: "social", payload: {} });
    return { studentId: st.id, caseId: c.id };
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

    shared = await import("@periscopio/shared");
    ({ db: dbx } = await import("../db/client"));
    const { buildApp } = await import("../app");
    app = await buildApp();
    await app.ready();

    // Município de DEMONSTRAÇÃO (pode ser zerado)
    const [demo] = await dbx.insert(shared.tenants).values({ name: "Município Demonstração", municipalityCode: "DEMO", demo: true }).returning();
    // Município REAL homônimo de Tarumã, marcado demo por engano (a trava de nome tem de protegê-lo)
    const [taruma] = await dbx.insert(shared.tenants).values({ name: "Município de Tarumã", municipalityCode: "9999999", demo: true }).returning();
    // Município real comum, nunca marcado demo
    const [real] = await dbx.insert(shared.tenants).values({ name: "Município Real", municipalityCode: "1234567", demo: false }).returning();
    ids.demo = demo.id; ids.taruma = taruma.id; ids.real = real.id;

    const esc = async (tid: string, slug: string) => (await dbx.insert(shared.schools).values({ tenantId: tid, name: `Escola ${slug}`, slug, status: "active" }).returning())[0];
    const [eD, eT, eR] = [await esc(demo.id, "demo"), await esc(taruma.id, "tar"), await esc(real.id, "real")];

    const mkUser = async (key: string, tid: string, sid: string | null, role: string) => {
      const [u] = await dbx.insert(shared.users).values({ tenantId: tid, schoolId: sid, email: `${key}@teste.local`, name: `Pessoa ${key}`, role, specialty: role === "ppi" ? "psicopedagogia" : null, accessEnabled: true }).returning();
      ids[key] = u.id;
    };
    await mkUser("admin", demo.id, null, "admin_platform");
    await mkUser("reDemo", demo.id, eD.id, "ppi");
    await mkUser("reTar", taruma.id, eT.id, "ppi");
    await mkUser("reReal", real.id, eR.id, "ppi");

    await criarCasoCompleto(demo.id, eD.id, ids.reDemo, "DEMO-0001");
    await criarCasoCompleto(demo.id, eD.id, ids.reDemo, "DEMO-0002");
    await criarCasoCompleto(taruma.id, eT.id, ids.reTar, "TAR-0001");
    await criarCasoCompleto(real.id, eR.id, ids.reReal, "REAL-0001");
  });

  after(async () => {
    await app?.close();
    const { db } = await import("../db/client");
    await (db as any).$client.end();
  });

  const contarAlunos = async (tid: string) =>
    (await dbx.select().from(shared.students).where(eq(shared.students.tenantId, tid))).length;

  test("só o admin vê a prévia e dispara o reset", async () => {
    assert.equal((await call("GET", "/api/admin/factory-reset/preview", "reDemo")).status, 403);
    assert.equal((await call("POST", "/api/admin/factory-reset", "reDemo", { confirm: "RESETAR DEMO" })).status, 403);
    assert.equal((await call("GET", "/api/admin/factory-reset/preview")).status, 401);
    assert.equal((await call("GET", "/api/admin/factory-reset/preview", "admin")).status, 200);
  });

  test("a prévia lista só o município demo (Tarumã e real ficam de fora, mesmo Tarumã marcado demo)", async () => {
    const r = await call("GET", "/api/admin/factory-reset/preview", "admin");
    assert.equal(r.status, 200);
    const nomes = r.body.tenants.map((t: any) => t.name);
    assert.deepEqual(nomes, ["Município Demonstração"], "só o DEMO entra; Tarumã é protegido pelo nome");
    assert.ok(r.body.total >= 2, "conta os 2 casos/alunos do demo");
    assert.ok(r.body.counts.find((c: any) => c.table === "students")?.rows === 2);
  });

  test("sem a palavra de confirmação, não apaga nada", async () => {
    const r = await call("POST", "/api/admin/factory-reset", "admin", { confirm: "sim" });
    assert.equal(r.status, 400);
    assert.equal(await contarAlunos(ids.demo), 2, "nada foi apagado");
  });

  test("executa: zera o demo e NÃO toca Tarumã nem o real", async () => {
    const r = await call("POST", "/api/admin/factory-reset", "admin", { confirm: "RESETAR DEMO" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.tenants.map((t: any) => t.name), ["Município Demonstração"]);

    assert.equal(await contarAlunos(ids.demo), 0, "demo ficou vazio");
    assert.equal(await contarAlunos(ids.taruma), 1, "Tarumã intacto");
    assert.equal(await contarAlunos(ids.real), 1, "município real intacto");

    // Estrutura preservada: tenants, escolas e usuários continuam
    assert.ok((await dbx.select().from(shared.tenants).where(eq(shared.tenants.id, ids.demo))).length === 1, "o tenant demo continua existindo");
    assert.ok((await dbx.select().from(shared.users).where(eq(shared.users.id, ids.reDemo))).length === 1, "o RE do demo continua");

    // Auditoria registra o reset
    const logs = await dbx.select().from(shared.auditLogs).where(eq(shared.auditLogs.action, "system.factory_reset"));
    assert.ok(logs.length >= 1, "o reset fica na auditoria");
  });

  test("rodar de novo é idempotente: demo já vazio, total 0, nada quebra", async () => {
    const r = await call("POST", "/api/admin/factory-reset", "admin", { confirm: "RESETAR DEMO" });
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 0);
    assert.equal(await contarAlunos(ids.taruma), 1, "Tarumã segue intacto");
  });
});
