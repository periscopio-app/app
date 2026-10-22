/**
 * Validação de rotas por perfil: "bloco de notas" de cada profissional (E2E, dados sintéticos).
 * Regra: o médico lê só o sumário do RE e o sumário de cada especialidade; o especialista só vê o
 * próprio bloco e o sumário do médico; ninguém lê rascunho de outro. Cada conteúdo secreto tem um
 * marcador, e a varredura procura o marcador em TODAS as respostas de cada perfil.
 * Requer TEST_DATABASE_URL.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;

const RE_FORM_A = "MARCA-RE-FORM-A";
const RE_FOGAP_ITENS = "MARCA-RE-FOGAP-ITENS";
const RE_SUMARIO = "SUMARIO-RE-OK";
const FONO_RASCUNHO = "MARCA-FONO-RASCUNHO";
const FONO_NOTAS = "MARCA-FONO-NOTAS-SECAO";
const PSM_NOTAS = "MARCA-PSM-NOTAS-SECAO";
const PSM_CONCLUIDA = "SUMARIO-PSM-CONCLUIDO";
const MD_RASCUNHO = "MARCA-MD-FORM-RASCUNHO";

describe("Validação de rotas por perfil (E2E)", { skip }, () => {
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
    return { status: r.statusCode, body: parsed, texto: JSON.stringify(parsed) };
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
      { key: "psico", role: "specialist", tenant: t.id, school: null, specialty: "psicologia" },
    ];
    for (const p of pessoas) {
      const [u] = await dbx.insert(shared.users).values({
        tenantId: p.tenant, schoolId: p.school, email: `${p.key}@teste.local`.toLowerCase(), name: `Pessoa ${p.key}`, role: p.role,
        specialty: p.specialty, accessEnabled: true,
      }).returning();
      ids[p.key] = u.id;
    }

    const [st] = await dbx.insert(shared.students).values({ tenantId: t.id, schoolId: e.id, studentCode: "T-VIS-0001", birthYear: 2018, birthMonth: 3, ageBracket: "06-09", grade: "3º ano" }).returning();
    const [c] = await dbx.insert(shared.cases).values({ tenantId: t.id, studentId: st.id, status: "triagem", journeyState: "delegado" as never }).returning();
    caso = c.id;

    // Bloco de notas do RE: formulário A e respostas item a item do FOGAP, mais o sumário (o que sai).
    await dbx.insert(shared.reAssessments).values({
      tenantId: t.id, caseId: caso, formCode: shared.RE_FORMS.a.code, formVersion: shared.RE_JORNADA_VERSION, status: "enviado",
      payload: { teste: RE_FORM_A }, createdBy: ids.re, submittedAt: new Date(), submittedBy: ids.re,
    });
    const fogap = shared.makeFogapPayloadVazio() as any;
    fogap.historico_insuficiente = { marcado: true, fonte: RE_FOGAP_ITENS, periodo_observado: null };
    fogap.respostas_desenvolvimento = { d1: "adequada" };
    fogap.secao_sumario = { ...fogap.secao_sumario, queixa_professor: RE_SUMARIO };
    await dbx.insert(shared.reAssessments).values({
      tenantId: t.id, caseId: caso, formCode: shared.FOGAP_FORM_CODE, formVersion: shared.FOGAP_VERSION, status: "enviado",
      payload: fogap, createdBy: ids.re, submittedAt: new Date(), submittedBy: ids.re,
    });

    // Fono: seção em andamento (rascunho). Psicomotricidade: seção concluída.
    const [sf] = await dbx.insert(shared.caseSummaries).values({
      tenantId: t.id, caseId: caso, specialty: "fonoaudiologia", assignedProfessionalId: ids.fono, status: "em_andamento",
      summary: { texto: FONO_RASCUNHO }, notes: FONO_NOTAS.repeat(4),
    } as never).returning();
    const [sp] = await dbx.insert(shared.caseSummaries).values({
      tenantId: t.id, caseId: caso, specialty: "psicomotricidade", assignedProfessionalId: ids.psm, status: "concluido",
      summary: { texto: PSM_CONCLUIDA }, notes: PSM_NOTAS.repeat(4), completedAt: new Date(),
    } as never).returning();
    secaoFono = sf.id;
    secaoPsm = sp.id;

    // Rascunhos reais pela API: formulário do especialista e formulário do médico.
    const f = await call("PUT", `/api/cases/sections/${secaoFono}/forms/fono_plano_terapeutico`, "fono", { payload: { principais_achados: FONO_RASCUNHO } });
    assert.equal(f.status, 200, f.texto);
    const m = await call("PUT", `/api/cases/${caso}/medical-forms/anamnese_biografica`, "md", { payload: { registro: MD_RASCUNHO } });
    assert.equal(m.status, 200, m.texto);
  });

  after(async () => {
    await app?.close();
    const { db } = await import("../db/client");
    await (db as any).$client.end();
  });

  const lerTudo = async (who: string) => {
    const rotas = [
      `/api/cases/${caso}/re-assessment`,
      `/api/cases/${caso}/re-assessment?completo=1`,
      `/api/cases/${caso}/re-journey`,
      `/api/cases/${caso}/consolidated`,
      `/api/cases/${caso}/full-summary`,
      `/api/cases/${caso}/specialty-forms`,
      `/api/cases/${caso}/specialist-view`,
      `/api/cases/${caso}/medical-forms`,
      `/api/cases/${caso}/events`,
      `/api/cases/sections/${secaoFono}/forms`,
      `/api/cases/sections/${secaoPsm}/forms`,
    ];
    const out: Record<string, { status: number; texto: string }> = {};
    for (const r of rotas) out[r] = await call("GET", r, who);
    return out;
  };

  test("médico: só o sumário do RE e a seção concluída; nada de formulários A a H, itens do FOGAP nem rascunhos", async () => {
    const r = await lerTudo("md");
    const tudo = Object.values(r).map((x) => x.texto).join("\n");

    for (const proibido of [RE_FORM_A, RE_FOGAP_ITENS, FONO_RASCUNHO, FONO_NOTAS]) {
      assert.ok(!tudo.includes(proibido), `o médico não pode receber ${proibido}`);
    }
    assert.equal(r[`/api/cases/${caso}/re-assessment`].status, 200);
    assert.ok(r[`/api/cases/${caso}/re-assessment`].texto.includes(RE_SUMARIO), "o sumário do RE chega ao médico");
    assert.ok(r[`/api/cases/${caso}/consolidated`].texto.includes(PSM_CONCLUIDA), "seção concluída aparece no consolidado");
    assert.ok(r[`/api/cases/${caso}/consolidated`].texto.includes(PSM_NOTAS), "parecer escrito ao concluir é o sumário que o médico recebe");
    assert.equal(r[`/api/cases/${caso}/specialist-view`].status, 403, "médico não usa a visão do especialista");
    assert.equal(r[`/api/cases/sections/${secaoFono}/forms`].status, 403, "médico não abre o bloco de notas do especialista");
    assert.equal(r[`/api/cases/sections/${secaoPsm}/forms`].status, 403);

    const cons = JSON.parse(r[`/api/cases/${caso}/consolidated`].texto);
    const fono = cons.sections.find((s: any) => s.specialty === "fonoaudiologia");
    assert.ok(fono, "a seção aparece, mas sem conteúdo enquanto não concluída");
    assert.ok(!fono.summary && !fono.notes, "rascunho/notas da seção em andamento não saem");
  });

  test("especialista (fono): só o próprio bloco; sem FOGAP, A a H, seção de colega nem formulário do médico", async () => {
    const r = await lerTudo("fono");
    assert.equal(r[`/api/cases/sections/${secaoFono}/forms`].status, 200);
    assert.ok(r[`/api/cases/sections/${secaoFono}/forms`].texto.includes(FONO_RASCUNHO), "vê o próprio rascunho");

    for (const rota of [
      `/api/cases/${caso}/re-assessment`,
      `/api/cases/${caso}/re-assessment?completo=1`,
      `/api/cases/${caso}/re-journey`,
      `/api/cases/${caso}/consolidated`,
      `/api/cases/${caso}/full-summary`,
      `/api/cases/${caso}/specialty-forms`,
      `/api/cases/${caso}/medical-forms`,
      `/api/cases/sections/${secaoPsm}/forms`,
    ]) {
      assert.equal(r[rota].status, 403, `${rota} deve negar ao especialista`);
    }

    const vista = r[`/api/cases/${caso}/specialist-view`];
    assert.equal(vista.status, 200);
    for (const proibido of [RE_FORM_A, RE_FOGAP_ITENS, RE_SUMARIO, PSM_NOTAS, PSM_CONCLUIDA, MD_RASCUNHO]) {
      assert.ok(!vista.texto.includes(proibido), `a visão do especialista não pode conter ${proibido}`);
    }
  });

  test("especialista sem seção neste caso e RE: nada além do que é seu", async () => {
    const psico = await lerTudo("psico");
    for (const [rota, x] of Object.entries(psico)) {
      assert.ok([403, 404].includes(x.status), `${rota} psico sem seção: ${x.status}`);
    }
    const re = await lerTudo("re");
    for (const rota of [
      `/api/cases/${caso}/consolidated`,
      `/api/cases/${caso}/full-summary`,
      `/api/cases/${caso}/specialty-forms`,
      `/api/cases/${caso}/specialist-view`,
      `/api/cases/${caso}/medical-forms`,
      `/api/cases/sections/${secaoFono}/forms`,
      `/api/cases/sections/${secaoPsm}/forms`,
    ]) {
      assert.equal(re[rota].status, 403, `${rota} deve negar ao RE`);
    }
    const tudoRe = Object.values(re).map((x) => x.texto).join("\n");
    for (const proibido of [FONO_RASCUNHO, FONO_NOTAS, PSM_NOTAS, MD_RASCUNHO]) {
      assert.ok(!tudoRe.includes(proibido), `o RE não pode ver ${proibido}`);
    }
    assert.ok(re[`/api/cases/${caso}/re-assessment?completo=1`].texto.includes(RE_FOGAP_ITENS), "o RE continua dono do próprio formulário");
  });

  test("outro município e sessão ausente: nada", async () => {
    const o = await lerTudo("mdOutro");
    const tudo = Object.values(o).map((x) => x.texto).join("\n");
    for (const proibido of [RE_FORM_A, RE_FOGAP_ITENS, RE_SUMARIO, FONO_RASCUNHO, PSM_CONCLUIDA, MD_RASCUNHO]) {
      assert.ok(!tudo.includes(proibido), `outro município não pode ver ${proibido}`);
    }
    for (const [rota, x] of Object.entries(o)) assert.ok([403, 404].includes(x.status), `${rota}: ${x.status}`);

    for (const rota of [`/api/cases/${caso}/re-assessment`, `/api/cases/${caso}/consolidated`, `/api/cases/sections/${secaoFono}/forms`]) {
      assert.equal((await call("GET", rota)).status, 401, rota);
    }
  });
});
