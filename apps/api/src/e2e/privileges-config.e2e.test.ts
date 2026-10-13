/**
 * Caixinhas do Administrador Master: marcar/desmarcar muda, de verdade, o que cada perfil vê e faz.
 * Cobre: só o Admin Master configura; padrão de fábrica; perfil (rede e global); exceção por pessoa;
 * confirmação de dado sensível; capacidades travadas; isolamento de rede; trilha de auditoria; /api/me.
 * Requer TEST_DATABASE_URL (Postgres local de teste).
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;
const PASS = "Senha-de-teste-123!";

describe("Privilégios configuráveis pelo Admin Master (E2E)", { skip }, () => {
  let app: FastifyInstance;
  const cookies = {} as Record<string, string>;
  const ids = {} as Record<string, string>;
  let tenantA = "";
  let tenantB = "";
  let caseA = "";
  let codeA = "";

  async function call(method: string, path: string, who: string, body?: unknown) {
    const headers: Record<string, string> = { origin: "http://localhost:3000", cookie: cookies[who] };
    if (body !== undefined) headers["content-type"] = "application/json";
    const r = await app.inject({ method: method as any, url: path, headers, payload: body === undefined ? undefined : JSON.stringify(body) });
    let parsed: any = null;
    try { parsed = r.json(); } catch { parsed = r.body; }
    return { status: r.statusCode, body: parsed };
  }

  const setRole = (who: string, role: string, capability: string, allowed: boolean | null, extra: Record<string, unknown> = {}, scope: string = tenantA) =>
    call("PUT", "/api/admin/privileges/roles", who, { changes: [{ scope, role, capability, allowed }], ...extra });

  before(async () => {
    const { assertSafeTestDatabase, resetTestDatabase } = await import("../testing/test-db");
    assertSafeTestDatabase(url);
    await resetTestDatabase(url!);
    process.env.DATABASE_URL = url!;
    process.env.NODE_ENV = "test";
    process.env.BETTER_AUTH_SECRET = "segredo-de-teste-com-mais-de-32-caracteres!!";
    process.env.BETTER_AUTH_URL = "http://localhost:3001";
    process.env.CORS_ORIGINS = "http://localhost:3000";
    process.env.RESEND_API_KEY = "re_teste";

    const shared = await import("@periscopio/shared");
    const { db } = await import("../db/client");
    const { upsertCredential } = await import("../auth/credentials");
    const { buildApp } = await import("../app");

    const [tA] = await db.insert(shared.tenants).values({ name: "Município A", municipalityCode: "A" }).returning();
    const [tB] = await db.insert(shared.tenants).values({ name: "Município B", municipalityCode: "B" }).returning();
    tenantA = tA.id; tenantB = tB.id;
    const [sA] = await db.insert(shared.schools).values({ tenantId: tA.id, name: "Escola A1", slug: "escola-a1", status: "active" }).returning();
    const [sA2] = await db.insert(shared.schools).values({ tenantId: tA.id, name: "Escola A2", slug: "escola-a2", status: "active" }).returning();

    const people = [
      { key: "admin", role: "admin_platform", tenant: tA.id, school: null, specialty: null },
      { key: "md", role: "md1", tenant: tA.id, school: null, specialty: "medicina" },
      { key: "mdB", role: "md1", tenant: tB.id, school: null, specialty: "medicina" },
      { key: "reA", role: "ppi", tenant: tA.id, school: sA.id, specialty: "psicopedagogia" },
      { key: "prof", role: "teacher", tenant: tA.id, school: sA.id, specialty: null },
      { key: "municipal", role: "municipal_manager", tenant: tA.id, school: null, specialty: null },
      { key: "fono", role: "specialist", tenant: tA.id, school: null, specialty: "fonoaudiologia" },
    ];
    for (const p of people) {
      const email = `${p.key.toLowerCase()}@teste.local`;
      const [u] = await db.insert(shared.users).values({ tenantId: p.tenant, schoolId: p.school, email, name: p.key, role: p.role, specialty: p.specialty, accessEnabled: true }).returning();
      ids[p.key] = u.id;
      await upsertCredential({ email, name: p.key, password: PASS });
    }

    const mk = async (school: string, tag: string) => {
      const code = `T-${tag}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      const [st] = await db.insert(shared.students).values({ tenantId: tA.id, schoolId: school, studentCode: code, birthYear: 2017, birthMonth: 4, ageBracket: "06-09" }).returning();
      const [c] = await db.insert(shared.cases).values({ tenantId: tA.id, studentId: st.id, status: "triagem", journeyState: "revisao_medica" }).returning();
      return { code, id: c.id };
    };
    const a = await mk(sA.id, "A");
    await mk(sA2.id, "A2");
    caseA = a.id; codeA = a.code;

    app = await buildApp({ logger: false });
    await app.ready();
    for (const p of people) {
      const r = await app.inject({
        method: "POST", url: "/api/auth/sign-in/email",
        headers: { origin: "http://localhost:3000", "content-type": "application/json" },
        payload: JSON.stringify({ email: `${p.key.toLowerCase()}@teste.local`, password: PASS }),
      });
      assert.equal(r.statusCode, 200);
      const set = r.headers["set-cookie"];
      cookies[p.key] = (Array.isArray(set) ? set : [String(set)]).map((c) => c.split(";")[0]).join("; ");
    }
  });

  after(async () => {
    await app?.close();
    const { db } = await import("../db/client");
    await (db as any).$client.end();
  });

  test("só o Administrador Master abre e altera a tela de privilégios", async () => {
    for (const who of ["md", "reA", "municipal", "fono"]) {
      assert.equal((await call("GET", "/api/admin/privileges/catalog", who)).status, 403, who);
      assert.equal((await setRole(who, "md1", "case.close", false)).status, 403, who);
    }
    const cat = await call("GET", "/api/admin/privileges/catalog", "admin");
    assert.equal(cat.status, 200);
    assert.ok(cat.body.capabilities.length >= 40);
    assert.ok(cat.body.roles.some((r: any) => r.key === "md1"));
    assert.ok(cat.body.capabilities.find((c: any) => c.key === "tea.reference.view").sensitive);
  });

  test("padrão de fábrica = matriz documentada; /api/me devolve o que a pessoa pode", async () => {
    const md = (await call("GET", "/api/me", "md")).body.capabilities as string[];
    assert.ok(md.includes("prontuario.consolidado.read") && md.includes("case.close") && md.includes("case.delegate"));
    assert.ok(md.includes("vault.register")); // médico é clínico: pode cadastrar identidade
    assert.ok(!md.includes("privileges.manage") && !md.includes("users.manage"));
    const mun = (await call("GET", "/api/me", "municipal")).body.capabilities as string[];
    assert.ok(mun.includes("management.view") && !mun.includes("prontuario.consolidado.read") && !mun.includes("case.list"));
    const re = (await call("GET", "/api/me", "reA")).body.capabilities as string[];
    assert.ok(re.includes("fogap.fill") && re.includes("student.register") && !re.includes("case.close"));
    const adm = (await call("GET", "/api/me", "admin")).body.capabilities as string[];
    assert.ok(adm.includes("privileges.manage") && !adm.includes("prontuario.consolidado.read"), "Admin não lê prontuário por padrão");
  });

  test("desmarcar a caixinha do perfil bloqueia na hora; voltar ao padrão libera de novo", async () => {
    assert.notEqual((await call("GET", `/api/cases/${caseA}/consolidated`, "md")).status, 403, "padrão: médico vê o consolidado");

    assert.equal((await setRole("admin", "md1", "prontuario.consolidado.read", false)).status, 200);
    const blocked = await call("GET", `/api/cases/${caseA}/consolidated`, "md");
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.capability, "prontuario.consolidado.read");
    assert.ok(!((await call("GET", "/api/me", "md")).body.capabilities as string[]).includes("prontuario.consolidado.read"));

    assert.equal((await setRole("admin", "md1", "prontuario.consolidado.read", null)).status, 200);
    assert.notEqual((await call("GET", `/api/cases/${caseA}/consolidated`, "md")).status, 403);
  });

  test("a regra de uma rede não vaza para outra rede; a regra global vale para todas, e a da rede vence", async () => {
    assert.equal((await setRole("admin", "md1", "case.events.read", false, {}, tenantB)).status, 200);
    assert.notEqual((await call("GET", `/api/cases/${caseA}/events`, "md")).status, 403, "médico da rede A não é afetado");

    assert.equal((await setRole("admin", "md1", "case.events.read", false, {}, "global")).status, 200);
    assert.equal((await call("GET", `/api/cases/${caseA}/events`, "md")).status, 403, "global bloqueia a rede A");

    assert.equal((await setRole("admin", "md1", "case.events.read", true, {}, tenantA)).status, 200);
    assert.notEqual((await call("GET", `/api/cases/${caseA}/events`, "md")).status, 403, "a regra da rede vence a global");

    await setRole("admin", "md1", "case.events.read", null, {}, tenantA);
    await setRole("admin", "md1", "case.events.read", null, {}, "global");
    await setRole("admin", "md1", "case.events.read", null, {}, tenantB);
  });

  test("liberar dado sensível exige confirmação; liberar o que a gestão pode ver não", async () => {
    const need = await setRole("admin", "municipal_manager", "prontuario.consolidado.read", true);
    assert.equal(need.status, 409);
    assert.equal(need.body.needsConfirmation, true);
    assert.equal((await call("GET", `/api/cases/${caseA}/consolidated`, "municipal")).status, 403, "nada mudou sem confirmar");

    assert.equal((await setRole("admin", "municipal_manager", "prontuario.consolidado.read", true, { confirmSensitive: true, reason: "piloto" })).status, 200);
    assert.notEqual((await call("GET", `/api/cases/${caseA}/consolidated`, "municipal")).status, 403, "agora o gestor lê o prontuário");
    await setRole("admin", "municipal_manager", "prontuario.consolidado.read", null);
    assert.equal((await call("GET", `/api/cases/${caseA}/consolidated`, "municipal")).status, 403);
  });

  test("liberar uma tela para o RE continua preso à escola dele", async () => {
    assert.equal((await call("GET", "/api/management/re-summaries", "reA")).status, 403, "padrão: RE não usa a visão da gestão");
    assert.equal((await setRole("admin", "ppi", "management.view", true)).status, 200);
    const r = await call("GET", "/api/management/re-summaries", "reA");
    assert.equal(r.status, 200);
    for (const s of r.body.summaries ?? []) assert.equal(s.studentCode, codeA, "só alunos da própria escola");
    await setRole("admin", "ppi", "management.view", null);
  });

  test("exceção por pessoa vale só para ela e vence a regra do perfil", async () => {
    assert.equal((await call("GET", "/api/cases", "prof")).status, 403, "professor não vê a fila por padrão");
    const put = await call("PUT", `/api/admin/privileges/users/${ids.prof}`, "admin", { capability: "case.list", allowed: true, reason: "apoia o RE no piloto" });
    assert.equal(put.status, 200);
    const list = await call("GET", "/api/cases", "prof");
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.cases.map((c: any) => c.studentCode), [codeA], "professor, preso à escola A1");
    assert.equal((await call("GET", "/api/cases", "municipal")).status, 403, "outra pessoa do mesmo perfil não muda");

    const detail = await call("GET", `/api/admin/privileges/users/${ids.prof}`, "admin");
    const row = detail.body.capabilities.find((c: any) => c.key === "case.list");
    assert.equal(row.userOverride, true);
    assert.equal(row.source, "user");

    // exceção de bloqueio individual: médico perde só o encerramento
    await call("PUT", `/api/admin/privileges/users/${ids.md}`, "admin", { capability: "case.close", allowed: false });
    assert.equal((await call("POST", `/api/cases/${caseA}/close`, "md", { decision: "acompanhamento", followUp: "x", reason: "teste" })).status, 403);

    await call("PUT", `/api/admin/privileges/users/${ids.prof}`, "admin", { capability: "case.list", allowed: null });
    await call("PUT", `/api/admin/privileges/users/${ids.md}`, "admin", { capability: "case.close", allowed: null });
    assert.equal((await call("GET", "/api/cases", "prof")).status, 403, "voltou ao padrão");
  });

  test("capacidades exclusivas do Admin Master não podem ser alteradas (ninguém tranca o admin para fora)", async () => {
    const lock = await setRole("admin", "admin_platform", "privileges.manage", false);
    assert.equal(lock.status, 400);
    assert.equal((await setRole("admin", "md1", "privileges.manage", true, { confirmSensitive: true })).status, 400);
    assert.equal((await call("PUT", `/api/admin/privileges/users/${ids.md}`, "admin", { capability: "users.manage", allowed: true, confirmSensitive: true })).status, 400);
    assert.equal((await call("GET", "/api/admin/privileges/catalog", "md")).status, 403);
    assert.equal((await call("GET", "/api/admin/privileges/catalog", "admin")).status, 200);
  });

  test("especialista: padrão por especialidade e matriz do escopo", async () => {
    const fono = (await call("GET", "/api/me", "fono")).body.capabilities as string[];
    assert.ok(fono.includes("tea.srs2.fill") && !fono.includes("tea.abc.fill") && !fono.includes("tea.mchat.fill"));
    const m = await call("GET", "/api/admin/privileges/matrix?scope=global", "admin");
    assert.equal(m.status, 200);
    const cell = m.body.cells.find((c: any) => c.capability === "tea.srs2.fill").byRole.specialist;
    assert.equal(cell.partial, true, "no perfil Especialista a caixinha aparece como 'por especialidade'");
    assert.equal((await call("GET", "/api/admin/privileges/matrix?scope=nao-e-uuid", "admin")).status, 400);
  });

  test("toda mudança fica na trilha de auditoria", async () => {
    const a = await call("GET", "/api/admin/privileges/audit", "admin");
    assert.equal(a.status, 200);
    const actions = a.body.events.map((e: any) => e.action);
    assert.ok(actions.includes("privilege.role_set") && actions.includes("privilege.user_set"));
    assert.ok(actions.includes("privilege.role_set.sensitive"), "mudança sensível destacada");
  });
});
