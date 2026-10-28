/**
 * Médico: vê os formulários do RE (A a I), preenche os próprios formulários e encaminha a especialistas (E2E).
 * Dados sintéticos. Requer TEST_DATABASE_URL.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;
const TEXTO = "Registro sintético do médico — texto que nunca deve aparecer em trilha ou auditoria.";

describe("Formulários do médico e encaminhamento (E2E)", { skip }, () => {
  let app: FastifyInstance;
  let dbx: typeof import("../db/client").db;
  let shared: typeof import("@periscopio/shared");
  let ids: Record<string, string> = {};
  let caso = "";
  let casoRascunho = "";
  let casoEncerrado = "";

  const call = async (method: string, path: string, who?: string, body?: unknown) => {
    const headers: Record<string, string> = { origin: "http://localhost:3000" };
    if (who) headers["x-test-email"] = `${who}@teste.local`.toLowerCase();
    if (body !== undefined) headers["content-type"] = "application/json";
    const r = await app.inject({ method: method as never, url: path, headers, payload: body === undefined ? undefined : JSON.stringify(body) });
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

    shared = await import("@periscopio/shared");
    ({ db: dbx } = await import("../db/client"));
    const { buildApp } = await import("../app");
    app = await buildApp();
    await app.ready();

    const [t] = await dbx.insert(shared.tenants).values({ name: "Município M", municipalityCode: "M" }).returning();
    const [t2] = await dbx.insert(shared.tenants).values({ name: "Município P", municipalityCode: "P" }).returning();
    const [e] = await dbx.insert(shared.schools).values({ tenantId: t.id, name: "Escola Sintética", slug: "sintetica", status: "active" }).returning();

    const pessoas = [
      { key: "re", role: "ppi", tenant: t.id, school: e.id, specialty: "psicopedagogia" },
      { key: "md", role: "md1", tenant: t.id, school: null, specialty: "medicina" },
      { key: "mdResumo", role: "md1", tenant: t.id, school: null, specialty: "medicina" },
      { key: "mdOutro", role: "md1", tenant: t2.id, school: null, specialty: "medicina" },
      { key: "fono", role: "specialist", tenant: t.id, school: null, specialty: "fonoaudiologia" },
      { key: "psico", role: "specialist", tenant: t.id, school: null, specialty: "psicologia" },
    ];
    for (const p of pessoas) {
      const [u] = await dbx.insert(shared.users).values({
        tenantId: p.tenant, schoolId: p.school, email: `${p.key}@teste.local`.toLowerCase(), name: `Pessoa ${p.key}`, role: p.role,
        specialty: p.specialty, accessEnabled: true,
      }).returning();
      ids[p.key] = u.id;
    }
    await dbx.insert(shared.privilegeUserGrants).values({ userId: ids.mdResumo, capability: "school.read_full", allowed: false });

    const mk = async (code: string, estado: string) => {
      const [st] = await dbx.insert(shared.students).values({ tenantId: t.id, schoolId: e.id, studentCode: code, birthYear: 2018, birthMonth: 3, ageBracket: "06-09", grade: "3º ano" }).returning();
      const [c] = await dbx.insert(shared.cases).values({ tenantId: t.id, studentId: st.id, status: "triagem", journeyState: estado as never }).returning();
      return c.id;
    };
    caso = await mk("T-MD-0001", "revisao_medica");
    casoRascunho = await mk("T-MD-0002", "rascunho");
    casoEncerrado = await mk("T-MD-0003", "encerrado");

    // O RE já preencheu o Formulário A e o FOGAP (Formulário I) deste caso.
    await dbx.insert(shared.reAssessments).values({
      tenantId: t.id, caseId: caso, formCode: shared.RE_FORMS.a.code, formVersion: shared.RE_JORNADA_VERSION, status: "enviado",
      payload: { teste: "A" }, createdBy: ids.re, submittedAt: new Date(), submittedBy: ids.re,
    });
    await dbx.insert(shared.reAssessments).values({
      tenantId: t.id, caseId: caso, formCode: shared.FOGAP_FORM_CODE, formVersion: shared.FOGAP_VERSION, status: "enviado",
      payload: { ...shared.makeFogapPayloadVazio(), faixa_fogap: "6a9", respostas_desenvolvimento: { d1: "adequada" } }, createdBy: ids.re, submittedAt: new Date(), submittedBy: ids.re,
    });
  });

  after(async () => {
    await app?.close();
    const { db } = await import("../db/client");
    await (db as any).$client.end();
  });

  test("o médico vê tudo o que a escola registrou sobre o aluno encaminhado (somente leitura)", async () => {
    const fogap = await call("GET", `/api/cases/${caso}/re-assessment?completo=1`, "md");
    assert.equal(fogap.status, 200);
    assert.ok(fogap.body.assessment, "FOGAP deve vir preenchido");
    assert.equal(fogap.body.assessment.status, "enviado");
    const pl = fogap.body.assessment.payload;
    assert.ok(pl.secao_sumario && pl.secao_encaminhamento, "sumário e encaminhamento vêm");
    assert.ok("respostas_desenvolvimento" in pl, "o médico lê as respostas item a item (regra da Dra., 23/out)");
    const resumido = await call("GET", `/api/cases/${caso}/re-assessment`, "md");
    assert.ok(!("respostas_desenvolvimento" in resumido.body.assessment.payload), "sem completo=1 só vem o sumário: a tela do médico precisa pedir completo=1");
    assert.equal(fogap.body.somenteSumario, false);
    const cons = await call("GET", `/api/cases/${caso}/consolidated`, "md");
    assert.equal(cons.status, 200);
    assert.ok("respostas_desenvolvimento" in cons.body.reAssessment.payload, "consolidado leva o registro integral da escola");

    const j = await call("GET", `/api/cases/${caso}/re-journey`, "md");
    assert.equal(j.status, 200);
    assert.ok(j.body.forms.i, "Formulário I (FOGAP/sumário) deve vir");
    for (const id of ["a", "b", "c", "d", "e", "f", "i"]) assert.ok(id in j.body.forms, `formulário ${id} visível ao médico`);
    assert.notEqual(j.body.somenteSumario, true);
    assert.equal(j.body.forms.i.payload.faixa_fogap, "6a9");
    assert.deepEqual(j.body.forms.i.payload.respostas_desenvolvimento, { d1: "adequada" });
    assert.equal(j.body.caseState, "revisao_medica");

    const jornadaResumo = await call("GET", `/api/cases/${caso}/re-journey`, "mdResumo");
    assert.equal(jornadaResumo.status, 200);
    assert.equal(jornadaResumo.body.somenteSumario, true);
    assert.ok(!("faixa_fogap" in jornadaResumo.body.forms.i.payload));
    assert.ok(!("respostas_desenvolvimento" in jornadaResumo.body.forms.i.payload));
    const reAssessmentResumido = await call("GET", `/api/cases/${caso}/re-assessment?completo=1`, "mdResumo");
    assert.equal(reAssessmentResumido.body.somenteSumario, true);
    assert.ok(!("faixa_fogap" in reAssessmentResumido.body.assessment.payload));
    assert.ok(!("respostas_desenvolvimento" in reAssessmentResumido.body.assessment.payload));

    // médico lê, mas não escreve na escola
    assert.equal((await call("PUT", `/api/cases/${caso}/re-journey/fogap-desenvolvimento`, "md", { faixa: "6a9", respostas: {} })).status >= 400, true, "o médico lê, não escreve na escola");
  });

  test("só o médico lê e escreve os formulários do médico", async () => {
    for (const who of ["re", "fono", "psico"]) {
      assert.equal((await call("GET", `/api/cases/${caso}/medical-forms`, who)).status, 403, who);
      assert.equal((await call("PUT", `/api/cases/${caso}/medical-forms/anamnese_biografica`, who, { payload: { registro: "x" } })).status, 403, who);
    }
    assert.equal((await call("GET", `/api/cases/${caso}/medical-forms`, "mdOutro")).status, 404);
    assert.equal((await call("GET", `/api/cases/${caso}/medical-forms`)).status, 401);

    const r = await call("GET", `/api/cases/${caso}/medical-forms`, "md");
    assert.equal(r.status, 200);
    assert.equal(r.body.editavel, true);
    assert.equal(r.body.forms.length, 17);
    assert.ok(r.body.forms.every((f: any) => f.status === "nao_iniciado"));
    assert.deepEqual(
      r.body.forms.map((f: any) => f.id),
      ["queixa_escola", "anamnese_biografica", "avaliacao_psiquiatrica", "outras_queixas", "exame_fisico", "genograma", "conclusao", "hipotese_diagnostica", "conduta",
        "encaminhamentos", "retorno_reavaliacao", "testes_complementares", "tcle", "entrevista_seguimento", "entrevista_manutencao", "sumario_medico", "recomendacao_escola"],
      "a ficha segue a sequência B a R do formulário em papel"
    );
    assert.deepEqual(r.body.forms.map((f: any) => (shared.MD_FORMS as Record<string, { letra: string }>)[f.id].letra).join(""), "BCDEFGHIJKLMNOPQR");
  });

  test("L: retorno para reavaliação guarda só data válida (AAAA-MM-DD)", async () => {
    const ok = await call("PUT", `/api/cases/${caso}/medical-forms/retorno_reavaliacao`, "md", { payload: { data: "2026-12-15" } });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body.form.payload, { data: "2026-12-15" });
    const ruim = await call("PUT", `/api/cases/${caso}/medical-forms/retorno_reavaliacao`, "md", { payload: { data: "depois do natal" } });
    assert.deepEqual(ruim.body.form.payload, { data: "" }, "texto que não é data vira campo em branco");
  });

  test("genograma: o desenho por parentesco é guardado normalizado e conclui a seção sem texto", async () => {
    const estrutura = JSON.stringify({ aluno: "female", membros: [{ id: "a", parentesco: "mae" }, { id: "b", parentesco: "pai" }, { id: "c", parentesco: "tio_paterno" }, { id: "d", parentesco: "marciano" }] });
    const salvo = await call("PUT", `/api/cases/${caso}/medical-forms/genograma`, "md", { payload: { estrutura } });
    assert.equal(salvo.status, 200);
    const guardado = JSON.parse(salvo.body.form.payload.estrutura);
    assert.deepEqual(guardado.membros.map((m: any) => m.parentesco), ["mae", "pai"], "desconhecido e sem ligação ficam de fora");
    assert.equal(guardado.aluno, "female");
    assert.equal(salvo.body.form.payload.legenda_mae, "");
    assert.equal((await call("POST", `/api/cases/${caso}/medical-forms/genograma/complete`, "md")).status, 200);
    // lixo no lugar do desenho vira campo em branco, e em branco não conclui
    const lixo = await call("PUT", `/api/cases/${caso}/medical-forms/entrevista_seguimento`, "md", { payload: { queixas_atuais: "", estrutura: "lixo" } });
    assert.equal(lixo.body.form.payload.queixas_atuais, "");
    assert.ok(!("estrutura" in lixo.body.form.payload), "campo que não é do formulário é ignorado");
  });

  test("rascunho, conclusão, trava e reabertura com motivo (guarda a versão anterior)", async () => {
    const ruim = await call("PUT", `/api/cases/${caso}/medical-forms/nao_existe`, "md", { payload: { registro: "x" } });
    assert.equal(ruim.status, 404);

    const salvo = await call("PUT", `/api/cases/${caso}/medical-forms/conduta`, "md", { payload: { farmacoterapia_previa_qual: TEXTO, campo_estranho: "ignorado" } });
    assert.equal(salvo.status, 200);
    assert.equal(salvo.body.form.payload.farmacoterapia_previa_qual, TEXTO);
    assert.ok(!("campo_estranho" in salvo.body.form.payload));
    assert.equal(salvo.body.form.status, "rascunho");

    // em branco não conclui
    await call("PUT", `/api/cases/${caso}/medical-forms/entrevista_seguimento`, "md", { payload: { queixas_atuais: "   " } });
    assert.equal((await call("POST", `/api/cases/${caso}/medical-forms/entrevista_seguimento/complete`, "md")).status, 400);
    // sem rascunho salvo não conclui
    assert.equal((await call("POST", `/api/cases/${caso}/medical-forms/exame_fisico/complete`, "md")).status, 409);

    const concl = await call("POST", `/api/cases/${caso}/medical-forms/conduta/complete`, "md");
    assert.equal(concl.status, 200);
    assert.equal(concl.body.form.status, "concluido");

    // concluída: não edita, não conclui de novo
    assert.equal((await call("PUT", `/api/cases/${caso}/medical-forms/conduta`, "md", { payload: { farmacoterapia_previa_qual: "outra" } })).status, 409);
    assert.equal((await call("POST", `/api/cases/${caso}/medical-forms/conduta/complete`, "md")).status, 409);

    // reabrir exige motivo
    assert.equal((await call("POST", `/api/cases/${caso}/medical-forms/conduta/reopen`, "md", { reason: "" })).status, 400);
    const reab = await call("POST", `/api/cases/${caso}/medical-forms/conduta/reopen`, "md", { reason: "Retificação após devolutiva da fono" });
    assert.equal(reab.status, 200);
    assert.equal(reab.body.form.status, "rascunho");

    const [linha] = await dbx.select().from(shared.caseMedicalForms);
    const hist = (await dbx.select().from(shared.caseMedicalForms)).find((l) => l.formId === "conduta")!.history as any[];
    assert.ok(linha);
    assert.equal(hist.length, 1);
    assert.equal(hist[0].payload.farmacoterapia_previa_qual, TEXTO, "a versão original continua guardada");
    assert.equal(hist[0].reason, "Retificação após devolutiva da fono");

    const edit = await call("PUT", `/api/cases/${caso}/medical-forms/conduta`, "md", { payload: { farmacoterapia_previa_qual: "versão retificada" } });
    assert.equal(edit.status, 200);
  });

  test("o conteúdo clínico não vai para a trilha nem para a auditoria", async () => {
    const tl = await dbx.select().from(shared.caseTimeline);
    const ev = tl.filter((x) => x.event.startsWith("md_form:"));
    assert.ok(ev.length >= 2, "conclusão e reabertura ficam na trilha");
    assert.ok(!JSON.stringify(tl).includes("Registro sintético"), "texto clínico fora da trilha");
    const au = await dbx.select().from(shared.auditLogs);
    assert.ok(au.some((a) => a.action === "medical_form.save"));
    assert.ok(!JSON.stringify(au).includes("Registro sintético"), "texto clínico fora da auditoria");
  });

  test("fora da revisão médica a escrita é bloqueada", async () => {
    const r1 = await call("PUT", `/api/cases/${casoRascunho}/medical-forms/anamnese_biografica`, "md", { payload: { registro: "x" } });
    assert.equal(r1.status, 409);
    const r2 = await call("PUT", `/api/cases/${casoEncerrado}/medical-forms/anamnese_biografica`, "md", { payload: { registro: "x" } });
    assert.equal(r2.status, 409);
    // leitura continua liberada, só não é editável
    const g = await call("GET", `/api/cases/${casoEncerrado}/medical-forms`, "md");
    assert.equal(g.status, 200);
    assert.equal(g.body.editavel, false);
  });

  test("encaminhamento: o médico designa especialistas e depois acrescenta outros; o RE não delega", async () => {
    const tentativaRe = await call("POST", `/api/cases/${caso}/delegate`, "re", { delegations: [{ specialty: "fonoaudiologia", professionalId: ids.fono }], reason: "x" });
    assert.equal(tentativaRe.status, 403);

    const um = await call("POST", `/api/cases/${caso}/delegate`, "md", { delegations: [{ specialty: "fonoaudiologia", professionalId: ids.fono }], reason: "Encaminhamento inicial" });
    assert.equal(um.status, 201);
    const [c1] = await dbx.select().from(shared.cases).where((await import("drizzle-orm")).eq(shared.cases.id, caso));
    assert.equal(c1.journeyState, "delegado");

    // acrescentar outra especialidade depois
    const dois = await call("POST", `/api/cases/${caso}/delegate`, "md", { delegations: [{ specialty: "psicologia", professionalId: ids.psico }], reason: "Acréscimo de psicologia" });
    assert.equal(dois.status, 201);
    const secoes = await dbx.select().from(shared.caseSummaries);
    assert.deepEqual(secoes.filter((s) => s.caseId === caso).map((s) => s.specialty).sort(), ["fonoaudiologia", "psicologia"]);
    const [c2] = await dbx.select().from(shared.cases).where((await import("drizzle-orm")).eq(shared.cases.id, caso));
    assert.equal(c2.journeyState, "delegado", "continua delegado");

    // repetir uma especialidade já designada é recusado
    const repetida = await call("POST", `/api/cases/${caso}/delegate`, "md", { delegations: [{ specialty: "fonoaudiologia", professionalId: ids.fono }], reason: "de novo" });
    assert.equal(repetida.status, 409);

    // a trilha registra o acréscimo
    const tl = await dbx.select().from(shared.caseTimeline);
    assert.ok(tl.some((x) => x.event === "case:delegation_added"));
  });

  test("com o caso delegado os formulários do médico continuam editáveis", async () => {
    const r = await call("PUT", `/api/cases/${caso}/medical-forms/sumario_medico`, "md", { payload: { queixa_professor: "sumário em andamento" } });
    assert.equal(r.status, 200);
  });
});
