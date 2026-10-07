/**
 * E2E da jornada clínica pela API real (Fastify + Better Auth + Postgres), com dados sintéticos.
 * Roda só com TEST_DATABASE_URL apontando para um banco LOCAL cujo nome contém "test"
 * (no CI há um serviço Postgres). Sem a variável, os testes são pulados.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente (E2E precisa de Postgres local de teste)" : false;

type Res = { status: number; body: any; cookie?: string };

describe("jornada clínica (E2E)", { skip }, () => {
  let app: FastifyInstance;
  let H: any; // helpers carregados depois de fixar as variáveis de ambiente

  const PASS = "Senha-de-teste-123!";
  const ids = {} as Record<string, string>;
  const cookies = {} as Record<string, string>;
  let studentId = "";
  let caseId = "";

  async function call(method: string, path: string, who?: string, body?: unknown): Promise<Res> {
    const headers: Record<string, string> = { origin: "http://localhost:3000" };
    if (who) headers.cookie = cookies[who];
    if (body !== undefined) headers["content-type"] = "application/json";
    const r = await app.inject({ method: method as any, url: path, headers, payload: body === undefined ? undefined : JSON.stringify(body) });
    let parsed: any = null;
    try { parsed = r.json(); } catch { parsed = r.body; }
    return { status: r.statusCode, body: parsed };
  }

  async function login(key: string, email: string) {
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      payload: JSON.stringify({ email, password: PASS }),
    });
    assert.equal(r.statusCode, 200, `login de ${email} falhou: ${r.body}`);
    const set = r.headers["set-cookie"];
    const list = Array.isArray(set) ? set : [String(set)];
    cookies[key] = list.map((c) => c.split(";")[0]).join("; ");
  }

  function fogapPronto() {
    const respostas_desenvolvimento: Record<string, string> = {};
    for (const i of H.getItensGrupo("G3")) respostas_desenvolvimento[i.id] = "adequada";
    const respostas_comportamentos: Record<string, string> = {};
    for (const c of H.FOGAP_COMPORTAMENTOS) respostas_comportamentos[c.id] = "nao";
    return {
      fogap_version: H.FOGAP_VERSION,
      fogap_state: "rascunho",
      grupo: "G3",
      idade_anos: 7,
      idade_meses: 0,
      total_meses: 84,
      respostas_desenvolvimento,
      respostas_comportamentos,
      historico_insuficiente: { marcado: false, fonte: null, periodo_observado: null },
      secao_sumario: { dificuldades_persistentes: [], conduta: "nao", qual: "", tempo: "", resultado: "" },
      secao_encaminhamento: { observacoes: "Registro sintético de teste.", data: "2026-10-07" },
    };
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
    delete process.env.RESEND_API_KEY;

    const shared = await import("@periscopio/shared");
    const { db } = await import("../db/client");
    const { upsertCredential } = await import("../auth/credentials");
    const { buildApp } = await import("../app");
    H = { ...shared, db, upsertCredential };

    // Dois municípios: A (usado na jornada) e B (isolamento).
    const [tA] = await db.insert(shared.tenants).values({ name: "Município A (teste)", municipalityCode: "A" }).returning();
    const [tB] = await db.insert(shared.tenants).values({ name: "Município B (teste)", municipalityCode: "B" }).returning();
    const [sA] = await db.insert(shared.schools).values({ tenantId: tA.id, name: "Escola A1", slug: "escola-a1", status: "active" }).returning();
    const [sA2] = await db.insert(shared.schools).values({ tenantId: tA.id, name: "Escola A2", slug: "escola-a2", status: "active" }).returning();
    const [sB] = await db.insert(shared.schools).values({ tenantId: tB.id, name: "Escola B1", slug: "escola-b1", status: "active" }).returning();
    ids.schoolA = sA.id;

    const people = [
      { key: "re", email: "re@teste.local", name: "RE Teste", role: "ppi", tenant: tA.id, school: sA.id, specialty: "psicopedagogia" },
      { key: "md", email: "medico@teste.local", name: "Médico Teste", role: "md1", tenant: tA.id, school: sA.id, specialty: "medicina" },
      { key: "esp", email: "neuro@teste.local", name: "Especialista Teste", role: "specialist", tenant: tA.id, school: sA.id, specialty: "neuropsicologia" },
      { key: "esp2", email: "fono@teste.local", name: "Outra Especialista", role: "specialist", tenant: tA.id, school: sA.id, specialty: "fonoaudiologia" },
      { key: "reOutraEscola", email: "re2@teste.local", name: "RE Escola 2", role: "ppi", tenant: tA.id, school: sA2.id, specialty: "psicopedagogia" },
      { key: "reB", email: "reb@teste.local", name: "RE Outro Município", role: "ppi", tenant: tB.id, school: sB.id, specialty: "psicopedagogia" },
      { key: "mdB", email: "mdb@teste.local", name: "Médico Outro Município", role: "md1", tenant: tB.id, school: sB.id, specialty: "medicina" },
      { key: "gestor", email: "gestor@teste.local", name: "Gestor Escolar", role: "school_manager", tenant: tA.id, school: sA.id, specialty: null },
    ];
    for (const p of people) {
      const [u] = await db.insert(shared.users).values({
        tenantId: p.tenant, schoolId: p.school, email: p.email, name: p.name, role: p.role, specialty: p.specialty, accessEnabled: true,
      }).returning();
      ids[p.key] = u.id;
      await upsertCredential({ email: p.email, name: p.name, password: PASS });
      // O id do usuário de auth e o do domínio são independentes: o vínculo é pelo e-mail.
    }

    app = await buildApp({ logger: false });
    await app.ready();
    for (const p of people) await login(p.key, p.email);
  });

  after(async () => {
    await app?.close();
    const { db } = await import("../db/client");
    await (db as any).$client.end();
  });

  test("sem sessão: rotas clínicas respondem 401", async () => {
    assert.equal((await call("GET", "/api/cases")).status, 401);
    assert.equal((await call("POST", "/api/students", undefined, {})).status, 401);
  });

  test("gestor escolar não acessa conteúdo clínico", async () => {
    assert.equal((await call("GET", "/api/cases", "gestor")).status, 403);
  });

  test("RE cadastra aluno só por código e abre o caso", async () => {
    // Quem cria aluno/caso: papéis de gestão da escola (gestor) conforme schoolMgmtRoles.
    const s = await call("POST", "/api/students", "gestor", { schoolId: ids.schoolA, birthYear: 2019, birthMonth: 5 });
    assert.equal(s.status, 201, JSON.stringify(s.body));
    studentId = s.body.student.id;
    assert.match(s.body.student.studentCode, /^ESCO-\d{4}-[A-Z0-9]+$/);
    assert.equal("name" in s.body.student, false, "aluno não pode ter nome");

    const c = await call("POST", "/api/cases", "gestor", { studentId });
    assert.equal(c.status, 201, JSON.stringify(c.body));
    caseId = c.body.case.id;
    assert.equal(c.body.case.journeyState, "rascunho");
  });

  test("isolamento: outro município e outra escola não enxergam o caso (404)", async () => {
    assert.equal((await call("GET", `/api/cases/${caseId}/re-assessment`, "reB")).status, 404);
    assert.equal((await call("GET", `/api/cases/${caseId}/consolidated`, "mdB")).status, 404);
    assert.equal((await call("GET", `/api/cases/${caseId}/re-assessment`, "reOutraEscola")).status, 404);
  });

  test("RE: rascunho incompleto não envia; completo envia e trava", async () => {
    const draft = fogapPronto();
    const parcial = { ...draft, respostas_desenvolvimento: {} };
    const c = await call("POST", `/api/cases/${caseId}/re-assessment`, "re", { payload: parcial });
    assert.equal(c.status, 201, JSON.stringify(c.body));

    const early = await call("POST", `/api/cases/${caseId}/re-assessment/submit`, "re");
    assert.equal(early.status, 422, "envio de formulário incompleto deve ser recusado");
    assert.ok(Array.isArray(early.body.pendencias) && early.body.pendencias.length > 0);

    const up = await call("PUT", `/api/cases/${caseId}/re-assessment`, "re", { payload: draft });
    assert.equal(up.status, 200, JSON.stringify(up.body));

    const sent = await call("POST", `/api/cases/${caseId}/re-assessment/submit`, "re");
    assert.equal(sent.status, 200, JSON.stringify(sent.body));

    const edit = await call("PUT", `/api/cases/${caseId}/re-assessment`, "re", { payload: draft });
    assert.equal(edit.status, 409, "após o envio a edição deve ser bloqueada");
    const again = await call("POST", `/api/cases/${caseId}/re-assessment/submit`, "re");
    assert.equal(again.status, 409);
  });

  test("RE não delega; médico delega a especialista e a outra especialidade", async () => {
    const reTry = await call("POST", `/api/cases/${caseId}/delegate`, "re", {
      delegations: [{ specialty: "neuropsicologia", professionalId: ids.esp }], reason: "x",
    });
    assert.equal(reTry.status, 403);

    const semMotivo = await call("POST", `/api/cases/${caseId}/delegate`, "md", {
      delegations: [{ specialty: "neuropsicologia", professionalId: ids.esp }], reason: "",
    });
    assert.equal(semMotivo.status, 400);

    const d = await call("POST", `/api/cases/${caseId}/delegate`, "md", {
      delegations: [
        { specialty: "neuropsicologia", professionalId: ids.esp },
        { specialty: "fonoaudiologia", professionalId: ids.esp2 },
      ],
      reason: "Demonstração: delegação de duas especialidades",
    });
    assert.equal(d.status, 201, JSON.stringify(d.body));
  });

  let sectionEsp = "";
  let sectionEsp2 = "";
  test("especialista vê só a própria seção e não edita a de outro", async () => {
    const mine = await call("GET", "/api/cases/my-delegated-sections", "esp");
    assert.equal(mine.status, 200, JSON.stringify(mine.body));
    const list = mine.body.assignedSections;
    assert.equal(list.length, 1);
    sectionEsp = list[0].id ?? list[0].sectionId;

    const other = await call("GET", "/api/cases/my-delegated-sections", "esp2");
    sectionEsp2 = other.body.assignedSections[0].id;

    const cross = await call("PATCH", `/api/cases/sections/${sectionEsp2}`, "esp", { notes: "invasão" });
    assert.equal(cross.status, 403);
    const consolidatedTry = await call("GET", `/api/cases/${caseId}/consolidated`, "esp");
    assert.equal(consolidatedTry.status, 403, "especialista não lê o consolidado");
  });

  test("especialistas concluem; só então o caso volta ao médico", async () => {
    const draft = await call("PATCH", `/api/cases/sections/${sectionEsp}`, "esp", { summary: { texto: "rascunho sintético" } });
    assert.equal(draft.status, 200, JSON.stringify(draft.body));

    const closeEarly = await call("POST", `/api/cases/${caseId}/close`, "md", { decision: "acompanhamento", reason: "cedo demais" });
    assert.equal(closeEarly.status, 409, "não encerra antes de todas as seções concluídas");

    assert.equal((await call("PATCH", `/api/cases/sections/${sectionEsp}`, "esp", { summary: { texto: "final" }, markAsCompleted: true })).status, 200);
    const locked = await call("PATCH", `/api/cases/sections/${sectionEsp}`, "esp", { notes: "depois de concluir" });
    assert.equal(locked.status, 409, "seção concluída fica somente leitura");
    const fin = await call("PATCH", `/api/cases/sections/${sectionEsp2}`, "esp2", { summary: { texto: "final" }, markAsCompleted: true });
    assert.equal(fin.status, 200, JSON.stringify(fin.body));
  });

  test("médico vê o consolidado, encerra com motivo e a trilha mostra todos os eventos", async () => {
    const cons = await call("GET", `/api/cases/${caseId}/consolidated`, "md");
    assert.equal(cons.status, 200, JSON.stringify(cons.body));

    const noReason = await call("POST", `/api/cases/${caseId}/close`, "md", { decision: "acompanhamento", reason: "" });
    assert.equal(noReason.status, 400);

    const closed = await call("POST", `/api/cases/${caseId}/close`, "md", { decision: "acompanhamento", reason: "Encerramento sintético da demonstração" });
    assert.equal(closed.status, 200, JSON.stringify(closed.body));

    const events = await call("GET", `/api/cases/${caseId}/events`, "md");
    assert.equal(events.status, 200, JSON.stringify(events.body));
    const list = events.body.events ?? events.body.items ?? events.body;
    assert.ok(list.length >= 6, `esperava 6+ eventos, vieram ${list.length}`);
    const text = JSON.stringify(list);
    assert.doesNotMatch(text, /@teste\.local/, "trilha não deve expor e-mails");
  });

  test("trilha e transições são imutáveis no banco", async () => {
    const { db } = H;
    const client = await (db as any).$client;
    await assert.rejects(client.query("UPDATE case_transitions SET reason = 'x'"));
    await assert.rejects(client.query("DELETE FROM case_timeline"));
    await assert.rejects(client.query("UPDATE audit_logs SET id = id"));
  });

  test("toda transição tem ator, papel, data e motivo", async () => {
    const client = await (H.db as any).$client;
    const r = await client.query("SELECT count(*)::int n, count(*) FILTER (WHERE actor_id IS NULL OR coalesce(reason,'') = '' OR created_at IS NULL)::int bad FROM case_transitions");
    assert.ok(r.rows[0].n >= 5);
    assert.equal(r.rows[0].bad, 0);
  });

  test("avaliações: nota do cliente é ignorada e aluno de outro município dá 404", async () => {
    const ok = await call("POST", "/api/evaluations", "re", { studentId, scale: "fogap", score: 99, payload: { a: 1 } });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.equal(ok.body.evaluation.score, null);
    assert.match(ok.body.notice, /não é diagnóstico/i);
    assert.equal((await call("POST", "/api/evaluations", "reB", { studentId, scale: "fogap", payload: {} })).status, 404);
    assert.equal((await call("POST", "/api/evaluations", "re", { studentId, scale: "xyz" })).status, 400);
    const outra = await call("GET", `/api/evaluations?studentId=${studentId}`, "reOutraEscola");
    assert.equal(outra.body.total, 0, "RE de outra escola não lista avaliações");
  });

  test("respostas não expõem nome, CPF ou e-mail do aluno", async () => {
    const cases = await call("GET", "/api/cases", "md");
    const text = JSON.stringify(cases.body);
    assert.doesNotMatch(text, /\d{3}\.\d{3}\.\d{3}-\d{2}/);
    assert.doesNotMatch(text, /@/);
  });
});
