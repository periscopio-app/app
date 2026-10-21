/**
 * Formulários das especialidades: o especialista preenche só a própria seção; o médico lê depois da conclusão (E2E).
 * Dados sintéticos. Requer TEST_DATABASE_URL.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;
const TEXTO = "Achado sintético do fonoaudiólogo — texto que nunca deve aparecer em trilha ou auditoria.";

describe("Formulários das especialidades (E2E)", { skip }, () => {
  let app: FastifyInstance;
  let dbx: typeof import("../db/client").db;
  let shared: typeof import("@periscopio/shared");
  const ids: Record<string, string> = {};
  let caso = "";
  let secaoFono = "";
  let secaoPsm = "";

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
      { key: "mdOutro", role: "md1", tenant: t2.id, school: null, specialty: "medicina" },
      { key: "fono", role: "specialist", tenant: t.id, school: null, specialty: "fonoaudiologia" },
      { key: "psm", role: "specialist", tenant: t.id, school: null, specialty: "psicomotricidade" },
      { key: "fonoOutra", role: "specialist", tenant: t.id, school: null, specialty: "fonoaudiologia" },
    ];
    for (const p of pessoas) {
      const [u] = await dbx.insert(shared.users).values({
        tenantId: p.tenant, schoolId: p.school, email: `${p.key}@teste.local`.toLowerCase(), name: `Pessoa ${p.key}`, role: p.role,
        specialty: p.specialty, accessEnabled: true,
      }).returning();
      ids[p.key] = u.id;
    }

    const [st] = await dbx.insert(shared.students).values({ tenantId: t.id, schoolId: e.id, studentCode: "T-ESP-0001", birthYear: 2018, birthMonth: 3, ageBracket: "06-09", grade: "3º ano" }).returning();
    const [c] = await dbx.insert(shared.cases).values({ tenantId: t.id, studentId: st.id, status: "triagem", journeyState: "delegado" as never }).returning();
    caso = c.id;
    const [sf] = await dbx.insert(shared.caseSummaries).values({ tenantId: t.id, caseId: caso, specialty: "fonoaudiologia", assignedProfessionalId: ids.fono, status: "pendente" }).returning();
    const [sp] = await dbx.insert(shared.caseSummaries).values({ tenantId: t.id, caseId: caso, specialty: "psicomotricidade", assignedProfessionalId: ids.psm, status: "pendente" }).returning();
    secaoFono = sf.id;
    secaoPsm = sp.id;
  });

  after(async () => {
    await app?.close();
    const { db } = await import("../db/client");
    await (db as any).$client.end();
  });

  test("cada especialista vê os formulários da própria especialidade, e só dela", async () => {
    const f = await call("GET", `/api/cases/sections/${secaoFono}/forms`, "fono");
    assert.equal(f.status, 200, JSON.stringify(f.body));
    assert.equal(f.body.specialty, "fonoaudiologia");
    assert.equal(f.body.editavel, true);
    assert.deepEqual(f.body.forms.map((x: any) => x.id), shared.ESPECIALIDADE_FORMS.fonoaudiologia.map((x) => x.id));
    assert.ok(f.body.forms.every((x: any) => x.status === "nao_iniciado" && Object.keys(x.payload).length === 0), "em branco continua em branco");

    const p = await call("GET", `/api/cases/sections/${secaoPsm}/forms`, "psm");
    assert.deepEqual(p.body.forms.map((x: any) => x.id), shared.ESPECIALIDADE_FORMS.psicomotricidade.map((x) => x.id));
  });

  test("quem não é dono da seção não lê nem escreve (colega, médico, RE, outro município, sem login)", async () => {
    const put = (who?: string) => call("PUT", `/api/cases/sections/${secaoFono}/forms/fono_plano_terapeutico`, who, { payload: { principais_achados: "x" } });
    assert.equal((await call("GET", `/api/cases/sections/${secaoFono}/forms`, "psm")).status, 403, "outra especialidade");
    assert.equal((await call("GET", `/api/cases/sections/${secaoFono}/forms`, "fonoOutra")).status, 403, "mesma especialidade, outro profissional");
    assert.equal((await call("GET", `/api/cases/sections/${secaoFono}/forms`, "md")).status, 403, "médico usa a leitura consolidada");
    assert.equal((await call("GET", `/api/cases/sections/${secaoFono}/forms`, "re")).status, 403);
    assert.equal((await call("GET", `/api/cases/sections/${secaoFono}/forms`, "mdOutro")).status, 403);
    assert.equal((await call("GET", `/api/cases/sections/${secaoFono}/forms`)).status, 401);
    for (const who of ["psm", "fonoOutra", "md", "re", "mdOutro"]) assert.equal((await put(who)).status, 403, who);
    assert.equal((await put()).status, 401);
  });

  test("formulário de outra especialidade não existe para esta seção", async () => {
    const r = await call("PUT", `/api/cases/sections/${secaoFono}/forms/psm_sumario`, "fono", { payload: { hipotese: "x" } });
    assert.equal(r.status, 404);
  });

  test("valida: campo desconhecido, opção inválida e data inválida são recusados", async () => {
    const f = (payload: unknown) => call("PUT", `/api/cases/sections/${secaoFono}/forms/fono_plano_terapeutico`, "fono", { payload });
    assert.equal((await f({ inexistente: "x" })).status, 400);
    assert.equal((await f({ data_ultima_avaliacao: "ontem" })).status, 400);
    const a = await call("PUT", `/api/cases/sections/${secaoFono}/forms/fono_anamnese`, "fono", { payload: { audicao: { pede_repetir: { r: "talvez" } } } });
    assert.equal(a.status, 400);
  });

  test("rascunho, conclusão, trava e reabertura com motivo (guarda a versão anterior)", async () => {
    const base = `/api/cases/sections/${secaoFono}/forms/fono_plano_terapeutico`;
    // sem rascunho salvo não conclui
    assert.equal((await call("POST", `${base}/complete`, "fono")).status, 409);

    const salvo = await call("PUT", base, "fono", { payload: { principais_achados: TEXTO, data_ultima_avaliacao: "2026-10-01" } });
    assert.equal(salvo.status, 200, JSON.stringify(salvo.body));
    assert.equal(salvo.body.form.status, "rascunho");

    // em branco não conclui
    await call("PUT", `/api/cases/sections/${secaoFono}/forms/fono_srs2`, "fono", { payload: {} });
    assert.equal((await call("POST", `/api/cases/sections/${secaoFono}/forms/fono_srs2/complete`, "fono")).status, 400);

    assert.equal((await call("POST", `${base}/complete`, "fono")).status, 200);
    assert.equal((await call("PUT", base, "fono", { payload: { principais_achados: "outro" } })).status, 409, "concluído trava");
    assert.equal((await call("POST", `${base}/reopen`, "fono", { reason: "" })).status, 400, "reabrir exige motivo");
    assert.equal((await call("POST", `${base}/reopen`, "fono", { reason: "Correção de digitação" })).status, 200);

    const lista = await call("GET", `/api/cases/sections/${secaoFono}/forms`, "fono");
    const form = lista.body.forms.find((x: any) => x.id === "fono_plano_terapeutico");
    assert.equal(form.status, "rascunho");
    assert.equal(form.reaberturas, 1);
    assert.equal(form.payload.principais_achados, TEXTO, "reabrir não apaga a resposta");

    const { caseSpecialtyForms } = shared;
    const { eq } = await import("drizzle-orm");
    const [row] = await dbx.select().from(caseSpecialtyForms).where(eq(caseSpecialtyForms.sectionId, secaoFono));
    assert.equal((row.history as any[])[0].reason, "Correção de digitação");

    assert.equal((await call("PUT", base, "fono", { payload: { principais_achados: TEXTO } })).status, 200);
    assert.equal((await call("POST", `${base}/complete`, "fono")).status, 200);
  });

  test("o conteúdo clínico não vai para a trilha nem para a auditoria", async () => {
    const { caseTimeline, auditLogs } = shared;
    const { eq } = await import("drizzle-orm");
    const trilha = await dbx.select().from(caseTimeline).where(eq(caseTimeline.caseId, caso));
    assert.ok(trilha.some((x) => x.event === "specialty_form:completed"));
    assert.ok(trilha.some((x) => x.event === "specialty_form:reopened"));
    assert.ok(!JSON.stringify(trilha).includes("Achado sintético"));
    const aud = await dbx.select().from(auditLogs);
    assert.ok(!JSON.stringify(aud).includes("Achado sintético"));
  });

  test("o médico não lê nada enquanto a seção não for concluída", async () => {
    const r = await call("GET", `/api/cases/${caso}/specialty-forms`, "md");
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.sections, []);
    assert.ok(!JSON.stringify(r.body).includes("Achado sintético"), "nem rascunho nem formulário concluído de seção aberta");
  });

  test("seção concluída: formulários viram somente leitura e o médico lê SÓ o sumário, não o bloco de notas", async () => {
    const SUMARIO = "Síntese sintética do fonoaudiólogo para o médico.";
    // preenche o sumário (fono_sintese) além do plano terapêutico, que é só do profissional
    const sint = await call("PUT", `/api/cases/sections/${secaoFono}/forms/fono_sintese`, "fono", { payload: { conclusao: SUMARIO } });
    assert.equal(sint.status, 200, JSON.stringify(sint.body));

    const fim = await call("PATCH", `/api/cases/sections/${secaoFono}`, "fono", { summary: { texto: "final" }, markAsCompleted: true });
    assert.equal(fim.status, 200, JSON.stringify(fim.body));

    const lista = await call("GET", `/api/cases/sections/${secaoFono}/forms`, "fono");
    assert.equal(lista.body.editavel, false);
    const base = `/api/cases/sections/${secaoFono}/forms/fono_plano_terapeutico`;
    assert.equal((await call("PUT", base, "fono", { payload: { principais_achados: "x" } })).status, 409);
    assert.equal((await call("POST", `${base}/reopen`, "fono", { reason: "depois de concluir" })).status, 409);

    const md = await call("GET", `/api/cases/${caso}/specialty-forms`, "md");
    assert.equal(md.status, 200);
    assert.equal(md.body.sections.length, 1);
    const sec = md.body.sections[0];
    assert.equal(sec.specialty, "fonoaudiologia");
    assert.equal(sec.sumarioPreenchido, true);
    assert.deepEqual(sec.forms.map((f: any) => f.id), ["fono_sintese"], "só o sumário chega ao médico");
    assert.equal(sec.forms[0].payload.conclusao, SUMARIO);
    assert.ok(!JSON.stringify(md.body).includes("Achado sintético"), "o plano terapêutico e as anamneses ficam com o profissional");
    // a seção da psicomotricidade, ainda aberta, continua invisível
    assert.ok(!md.body.sections.some((s: any) => s.specialty === "psicomotricidade"));
  });

  test("seção concluída sem o formulário de sumário: o médico vê a seção, avisada como sem sumário", async () => {
    const { caseSpecialtyForms } = shared;
    const { and, eq } = await import("drizzle-orm");
    await dbx.delete(caseSpecialtyForms).where(and(eq(caseSpecialtyForms.sectionId, secaoFono), eq(caseSpecialtyForms.formId, "fono_sintese")));
    const md = await call("GET", `/api/cases/${caso}/specialty-forms`, "md");
    assert.equal(md.body.sections[0].sumarioPreenchido, false);
    assert.deepEqual(md.body.sections[0].forms, []);
  });

  test("consolidado: parecer de seção em andamento não sai do profissional; o de seção concluída sim", async () => {
    const rascunho = await call("PATCH", `/api/cases/sections/${secaoPsm}`, "psm", { notes: "Parecer em andamento da psicomotricidade (rascunho). ".repeat(4) });
    assert.equal(rascunho.status, 200, JSON.stringify(rascunho.body));
    const cons = await call("GET", `/api/cases/${caso}/consolidated`, "md");
    assert.equal(cons.status, 200, JSON.stringify(cons.body));
    const psm = cons.body.sections.find((x: any) => x.specialty === "psicomotricidade");
    assert.ok(psm, "o médico vê que a seção existe e em que estado está");
    assert.equal(psm.notes, null, "rascunho não sai");
    assert.ok(!JSON.stringify(cons.body).includes("Parecer em andamento"));
    assert.ok(!("reJourney" in cons.body));
  });

  test("só o médico do município lê a devolutiva; especialista, RE e médico de outro município não", async () => {
    for (const who of ["fono", "psm", "re"]) assert.equal((await call("GET", `/api/cases/${caso}/specialty-forms`, who)).status, 403, who);
    assert.equal((await call("GET", `/api/cases/${caso}/specialty-forms`, "mdOutro")).status, 404);
    assert.equal((await call("GET", `/api/cases/${caso}/specialty-forms`)).status, 401);
  });
});
