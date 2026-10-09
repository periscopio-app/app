/**
 * Matriz de privilégios por ator (regras do PM, 09/out/2026):
 * gestor municipal e diretor veem só o sumário do RE e a lista final de encaminhados ao núcleo;
 * RE só na própria escola; médico recebe a rede; Board e ADM não leem prontuário; especialista só o núcleo.
 * Requer TEST_DATABASE_URL (Postgres local de teste).
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;
const PASS = "Senha-de-teste-123!";

describe("Privilégios por ator (E2E)", { skip }, () => {
  let app: FastifyInstance;
  const cookies = {} as Record<string, string>;
  let schoolA = "";
  let schoolA2 = "";
  let schoolB = "";
  let caseA = "";
  const codes = { a: "", a2: "", b: "" };

  async function call(method: string, path: string, who?: string, body?: unknown) {
    const headers: Record<string, string> = { origin: "http://localhost:3000" };
    if (who) headers.cookie = cookies[who];
    if (body !== undefined) headers["content-type"] = "application/json";
    const r = await app.inject({ method: method as any, url: path, headers, payload: body === undefined ? undefined : JSON.stringify(body) });
    let parsed: any = null;
    try { parsed = r.json(); } catch { parsed = r.body; }
    return { status: r.statusCode, body: parsed, raw: r.body };
  }

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
    const [sA] = await db.insert(shared.schools).values({ tenantId: tA.id, name: "Escola A1", slug: "escola-a1", status: "active" }).returning();
    const [sA2] = await db.insert(shared.schools).values({ tenantId: tA.id, name: "Escola A2", slug: "escola-a2", status: "active" }).returning();
    const [sB] = await db.insert(shared.schools).values({ tenantId: tB.id, name: "Escola B1", slug: "escola-b1", status: "active" }).returning();
    schoolA = sA.id; schoolA2 = sA2.id; schoolB = sB.id;

    const people = [
      { key: "admin", role: "admin_platform", tenant: tA.id, school: null, specialty: null },
      { key: "municipal", role: "municipal_manager", tenant: tA.id, school: null, specialty: null },
      { key: "municipalB", role: "municipal_manager", tenant: tB.id, school: null, specialty: null },
      { key: "dirA", role: "school_manager", tenant: tA.id, school: sA.id, specialty: null },
      { key: "dirSemEscola", role: "school_manager", tenant: tA.id, school: null, specialty: null },
      { key: "reA", role: "ppi", tenant: tA.id, school: sA.id, specialty: "psicopedagogia" },
      { key: "md", role: "md1", tenant: tA.id, school: null, specialty: "medicina" },
      { key: "esp", role: "specialist", tenant: tA.id, school: null, specialty: "neuropsicologia" },
      { key: "board", role: "board", tenant: tA.id, school: null, specialty: null },
      { key: "prof", role: "teacher", tenant: tA.id, school: sA.id, specialty: null },
      { key: "pesq", role: "researcher", tenant: tA.id, school: null, specialty: null },
    ];
    const userIds: Record<string, string> = {};
    for (const p of people) {
      const email = `${p.key.toLowerCase()}@teste.local`;
      const [u] = await db.insert(shared.users).values({ tenantId: p.tenant, schoolId: p.school, email, name: p.key, role: p.role, specialty: p.specialty, accessEnabled: true }).returning();
      userIds[p.key] = u.id;
      await upsertCredential({ email, name: p.key, password: PASS });
    }

    const mkCase = async (tenant: string, school: string, tag: string, state: string, submitted: boolean) => {
      const code = `T-${tag}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      const [st] = await db.insert(shared.students).values({ tenantId: tenant, schoolId: school, studentCode: code, birthYear: 2017, birthMonth: 4, ageBracket: "06-09" }).returning();
      const [c] = await db.insert(shared.cases).values({ tenantId: tenant, studentId: st.id, status: "triagem", journeyState: state }).returning();
      if (submitted) {
        await db.insert(shared.reAssessments).values({
          tenantId: tenant, caseId: c.id, formCode: "fogap", formVersion: "0.1.0-rascunho", status: "enviado",
          createdBy: userIds.reA, submittedBy: userIds.reA, submittedAt: new Date(),
          payload: {
            grupo: "G3",
            respostas_comportamentos: { c1: "inadequada" },
            secao_sumario: { dificuldades_persistentes: ["Aprendizagem", "Linguagem"], conduta: "sim", qual: "Apoio em sala", tempo: "2 meses", resultado: "Pouca mudança" },
            secao_encaminhamento: { observacoes: "texto interno do RE", data: null },
          },
        });
      }
      return { code, caseId: c.id };
    };
    const a = await mkCase(tA.id, sA.id, "A", "revisao_medica", true);
    const a2 = await mkCase(tA.id, sA2.id, "A2", "delegado", true);
    await mkCase(tA.id, sA.id, "RASC", "rascunho", false);
    const b = await mkCase(tB.id, sB.id, "B", "revisao_medica", true);
    codes.a = a.code; codes.a2 = a2.code; codes.b = b.code; caseA = a.caseId;

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

  test("gestor municipal vê o sumário do RE e a lista de encaminhados só do próprio município", async () => {
    const s = await call("GET", "/api/management/re-summaries", "municipal");
    assert.equal(s.status, 200);
    const got = s.body.summaries.map((x: any) => x.studentCode).sort();
    assert.deepEqual(got, [codes.a, codes.a2].sort(), "rascunho e outro município não aparecem");
    const item = s.body.summaries.find((x: any) => x.studentCode === codes.a);
    assert.deepEqual(item.dificuldadesPersistentes, ["Aprendizagem", "Linguagem"]);
    assert.equal(item.conduta, "sim");

    const l = await call("GET", "/api/management/nucleo-referrals", "municipal");
    assert.equal(l.status, 200);
    assert.deepEqual(l.body.referrals.map((x: any) => x.studentCode).sort(), [codes.a, codes.a2].sort());
    assert.equal(l.body.referrals.find((x: any) => x.studentCode === codes.a2).stage, "Delegado a especialistas");

    const filtered = await call("GET", `/api/management/re-summaries?schoolId=${schoolA2}`, "municipal");
    assert.deepEqual(filtered.body.summaries.map((x: any) => x.studentCode), [codes.a2]);
    assert.equal((await call("GET", `/api/management/re-summaries?schoolId=${schoolB}`, "municipal")).status, 404, "escola de outro município");
  });

  test("diretor vê só a própria escola, mesmo pedindo outra", async () => {
    const s = await call("GET", `/api/management/re-summaries?schoolId=${schoolA2}`, "dirA");
    assert.equal(s.status, 200);
    assert.deepEqual(s.body.summaries.map((x: any) => x.studentCode), [codes.a]);
    const l = await call("GET", `/api/management/nucleo-referrals?schoolId=${schoolA2}`, "dirA");
    assert.deepEqual(l.body.referrals.map((x: any) => x.studentCode), [codes.a]);
    assert.equal((await call("GET", "/api/management/re-summaries", "dirSemEscola")).status, 403);
  });

  test("as visões da gestão não expõem respostas item a item, texto interno nem identificação", async () => {
    for (const path of ["/api/management/re-summaries", "/api/management/nucleo-referrals"]) {
      const r = await call("GET", path, "municipal");
      assert.doesNotMatch(r.raw, /respostas_|texto interno|birthYear|birthMonth|inadequada|"email"|"cpf"/i, path);
    }
  });

  test("só gestor municipal e diretor entram nas visões da gestão", async () => {
    for (const who of ["admin", "board", "reA", "md", "esp", "prof", "pesq"]) {
      assert.equal((await call("GET", "/api/management/re-summaries", who)).status, 403, who);
      assert.equal((await call("GET", "/api/management/nucleo-referrals", who)).status, 403, who);
    }
    assert.equal((await call("GET", "/api/management/re-summaries")).status, 401);
  });

  test("gestor municipal e diretor não leem nem criam conteúdo clínico", async () => {
    for (const who of ["municipal", "dirA"]) {
      assert.equal((await call("GET", "/api/cases", who)).status, 403, who);
      assert.equal((await call("GET", `/api/schools/${schoolA}/students`, who)).status, 403, who);
      assert.equal((await call("POST", "/api/students", who, { schoolId: schoolA, birthYear: 2018, birthMonth: 3 })).status, 403, who);
      assert.equal((await call("POST", `/api/schools/${schoolA}/students/bulk`, who, { students: [{ birthYear: 2018, birthMonth: 3 }] })).status, 403, who);
      assert.equal((await call("POST", "/api/cases", who, { studentId: "x" })).status, 403, who);
      for (const p of ["re-assessment", "consolidated", "full-summary", "specialist-view", "events"]) {
        assert.equal((await call("GET", `/api/cases/${caseA}/${p}`, who)).status, 403, `${who} ${p}`);
      }
      assert.equal((await call("GET", "/api/cases/my-delegated-sections", who)).status, 403, who);
    }
  });

  test("Board e ADM não leem prontuário; o Board atua pelos pedidos de ajuda", async () => {
    for (const who of ["board", "admin"]) {
      assert.equal((await call("GET", "/api/cases", who)).status, 403, who);
      for (const p of ["re-assessment", "consolidated", "full-summary", "specialist-view"]) {
        assert.equal((await call("GET", `/api/cases/${caseA}/${p}`, who)).status, 403, `${who} ${p}`);
      }
      assert.equal((await call("GET", "/api/expert-meetings", who)).status, 200, who);
    }
  });

  test("RE lista só os casos da própria escola; médico recebe a rede do município", async () => {
    const re = await call("GET", "/api/cases", "reA");
    assert.equal(re.status, 200);
    const reCodes = re.body.cases.map((c: any) => c.studentCode);
    assert.ok(reCodes.includes(codes.a));
    assert.ok(!reCodes.includes(codes.a2), "outra escola do mesmo município");
    assert.ok(!reCodes.includes(codes.b), "outro município");

    const md = await call("GET", "/api/cases", "md");
    const mdCodes = md.body.cases.map((c: any) => c.studentCode);
    assert.ok(mdCodes.includes(codes.a) && mdCodes.includes(codes.a2));
    assert.ok(!mdCodes.includes(codes.b));
  });

  test("RE não decide pelo médico nem preenche seção de especialista", async () => {
    for (const [m, p] of [["POST", "delegate"], ["POST", "return"], ["POST", "close"], ["GET", "consolidated"], ["GET", "full-summary"]] as const) {
      assert.equal((await call(m, `/api/cases/${caseA}/${p}`, "reA", {})).status, 403, p);
    }
    assert.equal((await call("GET", "/api/cases/my-delegated-sections", "reA")).status, 403);
    assert.equal((await call("GET", `/api/cases/${caseA}/specialist-view`, "reA")).status, 403);
  });

  test("RE e médico pedem ajuda ao Board; diretor e especialista não", async () => {
    assert.equal((await call("GET", "/api/expert-meetings/slots", "reA")).status, 200);
    assert.equal((await call("GET", "/api/expert-meetings/slots", "md")).status, 200);
    for (const who of ["dirA", "municipal", "esp", "prof"]) {
      assert.equal((await call("GET", "/api/expert-meetings/slots", who)).status, 403, who);
    }
  });

  test("especialista não lista casos; só usa as próprias seções delegadas", async () => {
    assert.equal((await call("GET", "/api/cases", "esp")).status, 403);
    assert.equal((await call("GET", "/api/cases/my-delegated-sections", "esp")).status, 200);
    assert.equal((await call("GET", `/api/cases/${caseA}/specialist-view`, "esp")).status, 403, "sem seção atribuída neste caso");
  });

  test("leituras da gestão ficam na trilha de auditoria com o papel", async () => {
    const { db } = await import("../db/client");
    const { auditLogs } = await import("@periscopio/shared");
    const rows = await db.select().from(auditLogs);
    const mgmt = rows.filter((r) => r.action.startsWith("management:"));
    assert.ok(mgmt.length >= 4);
    assert.ok(mgmt.every((r) => (r.metadata as any)?.role === "municipal_manager" || (r.metadata as any)?.role === "school_manager"));
  });
});
