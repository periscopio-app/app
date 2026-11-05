/**
 * Regressão do envio do RE ao médico, preenchendo SOMENTE pelas rotas que a tela do RE chama
 * (`ReJourneyPanel`): sumário, itens de desenvolvimento, comportamentos, ATA e "não vou aplicar" do SNAP-IV.
 *
 * Bug de 05/nov/2026 ([REG-001]): a API exigia os 15 comportamentos do FOGAP, mas nenhuma rota usada pela tela os gravava.
 * O RE preenchia tudo, enviava e levava 422 "Faltam 15 campo(s) obrigatório(s)". Os E2E antigos passavam porque gravavam
 * pelo caminho genérico `PUT /re-assessment`, que a tela não usa. Este teste fecha essa brecha.
 *
 * Roda só com TEST_DATABASE_URL apontando para um banco LOCAL cujo nome contém "test". Dados 100% sintéticos.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente (E2E precisa de Postgres local de teste)" : false;

const SUMARIO = {
  serie: "3º ano",
  queixa_professor: "Dificuldade para copiar da lousa e terminar as tarefas.",
  hipotese_espectro: "Dimensão da comunicação social a observar.",
  dificuldades_persistentes: ["Aprendizagem"],
  conduta: "nao",
  qual: "",
  tempo: "",
  resultado: "",
};

describe("[REG-001] envio do RE ao médico pelas rotas da tela (E2E)", { skip }, () => {
  let app: FastifyInstance;
  let H: any;
  const PASS = "Senha-de-teste-123!";
  const cookies: Record<string, string> = {};
  let schoolId = "";
  let studentId = "";
  let caseId = "";

  async function call(method: string, path: string, who?: string, body?: unknown) {
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
    cookies[key] = (Array.isArray(set) ? set : [String(set)]).map((c) => c.split(";")[0]).join("; ");
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
    H = { ...shared, db };

    const [tA] = await db.insert(shared.tenants).values({ name: "Município A (teste)", municipalityCode: "A" }).returning();
    const [tB] = await db.insert(shared.tenants).values({ name: "Município B (teste)", municipalityCode: "B" }).returning();
    const [sA] = await db.insert(shared.schools).values({ tenantId: tA.id, name: "Escola A1", slug: "escola-a1", status: "active" }).returning();
    const [sB] = await db.insert(shared.schools).values({ tenantId: tB.id, name: "Escola B1", slug: "escola-b1", status: "active" }).returning();
    schoolId = sA.id;

    const people = [
      { key: "re", email: "re@teste.local", name: "RE Teste", role: "ppi", tenant: tA.id, school: sA.id, specialty: "psicopedagogia" },
      { key: "prof", email: "prof@teste.local", name: "Professor Teste", role: "teacher", tenant: tA.id, school: sA.id, specialty: null },
      { key: "reB", email: "reb@teste.local", name: "RE Outro Município", role: "ppi", tenant: tB.id, school: sB.id, specialty: "psicopedagogia" },
    ];
    for (const p of people) {
      await db.insert(shared.users).values({ tenantId: p.tenant, schoolId: p.school, email: p.email, name: p.name, role: p.role, specialty: p.specialty, accessEnabled: true });
      await upsertCredential({ email: p.email, name: p.name, password: PASS });
    }

    app = await buildApp({ logger: false });
    await app.ready();
    for (const p of people) await login(p.key, p.email);

    // Aluno sintético dentro da faixa do piloto, com série no cadastro (obrigatória no Formulário I).
    const Y = new Date().getFullYear();
    const s = await call("POST", "/api/students", "re", { schoolId, birthYear: Y - 7, birthMonth: 1 });
    assert.equal(s.status, 201, JSON.stringify(s.body));
    studentId = s.body.student.id;
    await db.update(shared.students).set({ grade: "3º ano" }).where((await import("drizzle-orm")).eq(shared.students.id, studentId));
    const c = await call("POST", "/api/cases", "re", { studentId });
    assert.equal(c.status, 201, JSON.stringify(c.body));
    caseId = c.body.case.id;
  });

  after(async () => {
    await app?.close();
    const { db } = await import("../db/client");
    await (db as any).$client.end();
  });

  const lerJornada = async (who = "re") => {
    const r = await call("GET", `/api/cases/${caseId}/re-journey`, who);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  };
  const bloqueantesDoI = (j: any) => j.situacao.lacunas.filter((l: any) => l.bloqueante && l.passo === "i");

  test("[REG-001a] sem responder os comportamentos, o envio é recusado listando os 15 itens", async () => {
    // Com o Sumário salvo existe a linha do Formulário I; sem nenhuma gravação o Sumário sozinho já bloqueia o envio.
    assert.equal((await call("PUT", `/api/cases/${caseId}/re-journey/sumario`, "re", { secao_sumario: SUMARIO })).status, 200);
    const r = await call("POST", `/api/cases/${caseId}/re-assessment/submit`, "re", {});
    assert.equal(r.status, 422);
    assert.equal(r.body.code, "LACUNAS_BLOQUEANTES");
    const comportamentos = r.body.lacunas.filter((l: any) => String(l.campo).startsWith("respostas_comportamentos."));
    assert.equal(comportamentos.length, H.FOGAP_COMPORTAMENTOS.length);
  });

  test("[REG-001b] comportamentos salvam pela rota da tela, voltam na leitura e item em branco não vira \"Não\"", async () => {
    const [c1, c2, c3] = H.FOGAP_COMPORTAMENTOS;
    const put = await call("PUT", `/api/cases/${caseId}/re-journey/fogap-comportamentos`, "re", {
      respostas: { [c1.id]: "sim", [c2.id]: "nao", [c3.id]: null },
    });
    assert.equal(put.status, 200, JSON.stringify(put.body));

    const j = await lerJornada();
    const salvo = j.forms.i.payload.respostas_comportamentos;
    assert.equal(salvo[c1.id], "sim");
    assert.equal(salvo[c2.id], "nao");
    assert.ok(salvo[c3.id] === null || salvo[c3.id] === undefined, "item em branco continua em branco");
    const faltam = bloqueantesDoI(j).filter((l: any) => String(l.campo).startsWith("respostas_comportamentos."));
    assert.equal(faltam.length, H.FOGAP_COMPORTAMENTOS.length - 2, "só os 2 respondidos saem da lista de pendências");

    // Salvar de novo uma parte não apaga o que já estava salvo.
    const [, , , c4] = H.FOGAP_COMPORTAMENTOS;
    assert.equal((await call("PUT", `/api/cases/${caseId}/re-journey/fogap-comportamentos`, "re", { respostas: { [c4.id]: "nao" } })).status, 200);
    const depois = (await lerJornada()).forms.i.payload.respostas_comportamentos;
    assert.equal(depois[c1.id], "sim");
    assert.equal(depois[c4.id], "nao");
  });

  test("[REG-001c] a rota recusa comportamento inexistente, valor inválido, perfil sem permissão e outro município", async () => {
    const url = `/api/cases/${caseId}/re-journey/fogap-comportamentos`;
    assert.equal((await call("PUT", url, "re", { respostas: { "FOGAP-C-99": "sim" } })).status, 400);
    assert.equal((await call("PUT", url, "re", { respostas: { [H.FOGAP_COMPORTAMENTOS[0].id]: "talvez" } })).status, 400);
    assert.equal((await call("PUT", url, "prof", { respostas: {} })).status, 403, "na escola só o RE preenche");
    assert.equal((await call("PUT", url, "reB", { respostas: {} })).status, 404, "outro município não vê o caso");
    assert.equal((await call("PUT", url, undefined, { respostas: {} })).status, 401);
  });

  test("[REG-001d] RE completa a jornada SÓ pelas rotas da tela e envia ao médico", async () => {
    // 1) Sumário (Formulário I) — PUT /re-journey/sumario
    assert.equal((await call("PUT", `/api/cases/${caseId}/re-journey/sumario`, "re", { secao_sumario: SUMARIO })).status, 200);

    // 2) Itens de desenvolvimento da faixa em uso — PUT /re-journey/fogap-desenvolvimento
    const j0 = await lerJornada();
    const faixa = H.faixaEmUso({ faixa_fogap: j0.forms.i?.payload?.faixa_fogap, total_meses: j0.forms.i?.payload?.total_meses });
    assert.ok(faixa, "aluno de 7 anos cai em uma faixa do piloto");
    const dev: Record<string, string> = {};
    for (const item of H.itensDaFaixa(faixa)) dev[item.id] = "adequada";
    const d = await call("PUT", `/api/cases/${caseId}/re-journey/fogap-desenvolvimento`, "re", { faixa, respostas: dev });
    assert.equal(d.status, 200, JSON.stringify(d.body));

    // 3) Comportamentos — PUT /re-journey/fogap-comportamentos (a rota que faltava)
    const comp: Record<string, string> = {};
    for (const c of H.FOGAP_COMPORTAMENTOS) comp[c.id] = "nao";
    const c = await call("PUT", `/api/cases/${caseId}/re-journey/fogap-comportamentos`, "re", { respostas: comp });
    assert.equal(c.status, 200, JSON.stringify(c.body));

    // 4) ATA (obrigatória) — rotas do TeaScreeningPanel
    const ata = await call("PUT", `/api/cases/${caseId}/tea/ata`, "re", { answers: { marcados: { "1": [0] }, antes36meses: false }, respondent: "mae_pai", appliedOn: "2026-10-07" });
    assert.equal(ata.status, 200, JSON.stringify(ata.body));
    assert.equal((await call("POST", `/api/cases/${caseId}/tea/ata/submit`, "re")).status, 200);

    // 5) SNAP-IV opcional: "Não vou aplicar" — POST /re-journey/steps/g/skip
    assert.equal((await call("POST", `/api/cases/${caseId}/re-journey/steps/g/skip`, "re", { valor: true })).status, 200);

    // Nada obrigatório pode ter sobrado, na leitura que a tela faz.
    const j = await lerJornada();
    assert.deepEqual(j.situacao.lacunas.filter((l: any) => l.bloqueante), [], "nenhuma pendência obrigatória depois do preenchimento pela tela");

    // Envio com "enviar assim mesmo" (A a F podem ficar em branco) — o que a tela faz depois da revisão.
    const envio = await call("POST", `/api/cases/${caseId}/re-assessment/submit`, "re", { confirmarLacunas: true });
    assert.equal(envio.status, 200, JSON.stringify(envio.body));
    assert.equal((await lerJornada()).caseState, "revisao_medica");
  });

  test("[REG-001e] depois do envio os comportamentos ficam em somente leitura (409)", async () => {
    const r = await call("PUT", `/api/cases/${caseId}/re-journey/fogap-comportamentos`, "re", { respostas: { [H.FOGAP_COMPORTAMENTOS[0].id]: "sim" } });
    assert.equal(r.status, 409);
  });
});
