/**
 * E2E da jornada clínica pela API real (Fastify + Better Auth + Postgres), com dados sintéticos.
 * Roda só com TEST_DATABASE_URL apontando para um banco LOCAL cujo nome contém "test"
 * (no CI há um serviço Postgres). Sem a variável, os testes são pulados.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
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

  /** Formulário I que cumpre os campos obrigatórios e o mínimo de caracteres. */
  const SUMARIO_VALIDO = {
    serie: "3º ano",
    queixa_professor: "Dificuldade para copiar da lousa e terminar as tarefas.",
    hipotese_espectro: "Dimensão da comunicação social a observar.",
    dificuldades_persistentes: ["Aprendizagem"],
    conduta: "nao",
    qual: "",
    tempo: "",
    resultado: "",
  };

  /** Só o que é obrigatório: série no cadastro, ATA enviada e Formulário I completo. A–F podem ficar em branco. */
  async function preencherObrigatorios(who: string, cid: string) {
    const { db, cases, students } = H;
    const [cx] = await db.select({ studentId: cases.studentId }).from(cases).where(eq(cases.id, cid)).limit(1);
    await db.update(students).set({ grade: "3º ano" }).where(eq(students.id, cx.studentId));
    const ata = await call("PUT", `/api/cases/${cid}/tea/ata`, who, { answers: { marcados: { "1": [0] }, antes36meses: false }, respondent: "mae_pai", appliedOn: "2026-10-07" });
    assert.equal(ata.status, 200, JSON.stringify(ata.body));
    assert.equal((await call("POST", `/api/cases/${cid}/tea/ata/submit`, who)).status, 200);
    const sum = await call("PUT", `/api/cases/${cid}/re-journey/sumario`, who, {
      secao_sumario: SUMARIO_VALIDO,
      secao_encaminhamento: { observacoes: "Registro sintético de teste.", data: "2026-10-07" },
    });
    assert.equal(sum.status, 200, JSON.stringify(sum.body));
  }

  /** Percorre a jornada A→I pela API (A–F salvos, G pulado, H aguardando o responsável, I com sumário). */
  async function completarJornada(who: string, cid: string) {
    // A série vem do cadastro do aluno e é obrigatória no Formulário I.
    const { db, cases, students } = H;
    const [cx] = await db.select({ studentId: cases.studentId }).from(cases).where(eq(cases.id, cid)).limit(1);
    await db.update(students).set({ grade: "3º ano" }).where(eq(students.id, cx.studentId));
    for (const f of ["a", "b", "c", "d", "e", "f"]) {
      const put = await call("PUT", `/api/cases/${cid}/re-journey/forms/${f}`, who, { payload: f === "f" ? { data_aplicacao: "2026-10-07" } : { observacoes: "Registro sintético de teste." } });
      assert.equal(put.status, 200, `salvar ${f}: ${JSON.stringify(put.body)}`);
    }
    const g = await call("POST", `/api/cases/${cid}/re-journey/steps/g/skip`, who, { valor: true });
    assert.equal(g.status, 200, JSON.stringify(g.body));
    // A ATA é obrigatória: preenche e envia (respondente e data), em vez de "aguardando o responsável".
    const ata = await call("PUT", `/api/cases/${cid}/tea/ata`, who, { answers: { marcados: { "1": [0] }, antes36meses: false }, respondent: "mae_pai", appliedOn: "2026-10-07" });
    assert.equal(ata.status, 200, JSON.stringify(ata.body));
    const ataEnv = await call("POST", `/api/cases/${cid}/tea/ata/submit`, who);
    assert.equal(ataEnv.status, 200, JSON.stringify(ataEnv.body));
    const sum = await call("PUT", `/api/cases/${cid}/re-journey/sumario`, who, {
      secao_sumario: SUMARIO_VALIDO,
      secao_encaminhamento: { observacoes: "Registro sintético de teste.", data: "2026-10-07" },
    });
    assert.equal(sum.status, 200, JSON.stringify(sum.body));
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
      { key: "prof", email: "prof@teste.local", name: "Professor Teste", role: "teacher", tenant: tA.id, school: sA.id, specialty: null },
      { key: "profOutra", email: "prof2@teste.local", name: "Professora Outra Escola", role: "teacher", tenant: tA.id, school: sA2.id, specialty: null },
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
    // Quem cadastra aluno e abre o caso: o RE (REGISTRY_ROLES). O diretor não cadastra.
    const s = await call("POST", "/api/students", "re", { schoolId: ids.schoolA, birthYear: 2019, birthMonth: 5 });
    assert.equal(s.status, 201, JSON.stringify(s.body));
    studentId = s.body.student.id;
    assert.match(s.body.student.studentCode, /^ESCO-\d{4}-[A-Z0-9]+$/);
    assert.equal("name" in s.body.student, false, "aluno não pode ter nome");

    const c = await call("POST", "/api/cases", "re", { studentId });
    assert.equal(c.status, 201, JSON.stringify(c.body));
    caseId = c.body.case.id;
    assert.equal(c.body.case.journeyState, "rascunho");
  });

  test("caso devolvido traz o código do aluno e abrir de novo retoma o mesmo caso", async () => {
    const again = await call("POST", "/api/cases", "re", { studentId });
    assert.equal(again.status, 200, JSON.stringify(again.body));
    assert.equal(again.body.reused, true);
    assert.equal(again.body.case.id, caseId, "não duplica o prontuário");
    assert.match(again.body.case.studentCode, /^ESCO-\d{4}-[A-Z0-9]+$/, "a tela precisa do código para listar o caso");
    assert.equal(typeof again.body.case.birthYear, "number");
    assert.equal(again.body.case.schoolName, "Escola A1");
    const list = await call("GET", "/api/cases", "re");
    assert.equal(list.body.cases.filter((x: any) => x.id === caseId).length, 1);
  });

  test("trava de idade do piloto: só 4 anos a 9 anos e 11 meses (individual e em lote)", async () => {
    const Y = new Date().getFullYear();
    const novo = await call("POST", "/api/students", "re", { schoolId: ids.schoolA, birthYear: Y - 2, birthMonth: 1 });
    assert.equal(novo.status, 400);
    assert.match(novo.body.error, /4 anos a 9 anos e 11 meses/);
    const velho = await call("POST", "/api/students", "re", { schoolId: ids.schoolA, birthYear: Y - 12, birthMonth: 1 });
    assert.equal(velho.status, 400);
    const lote = await call("POST", `/api/schools/${ids.schoolA}/students/bulk`, "re", {
      students: [{ birthYear: Y - 8, birthMonth: 1 }, { birthYear: Y - 3, birthMonth: 1 }],
    });
    assert.equal(lote.status, 400, "lote com uma linha fora da faixa não importa nada");
    assert.equal(lote.body.errors[0].row, 2);
  });

  test("isolamento: outro município e outra escola não enxergam o caso (404)", async () => {
    assert.equal((await call("GET", `/api/cases/${caseId}/re-assessment`, "reB")).status, 404);
    assert.equal((await call("GET", `/api/cases/${caseId}/consolidated`, "mdB")).status, 404);
    assert.equal((await call("GET", `/api/cases/${caseId}/re-assessment`, "reOutraEscola")).status, 404);
  });

  test("RE: rascunho incompleto não envia; completo envia e trava", async () => {
    const draft = fogapPronto();
    const parcial = { ...draft, fogap_state: "aguardando_idade", grupo: null };
    const malformado = await call("POST", `/api/cases/${caseId}/re-assessment`, "re", { payload: { ...parcial, respostas_comportamentos: { c1: "inadequada" } } });
    assert.equal(malformado.status, 400, "rascunho com valor fora do contrato é recusado na criação, como na edição");
    const c = await call("POST", `/api/cases/${caseId}/re-assessment`, "re", { payload: parcial });
    assert.equal(c.status, 201, JSON.stringify(c.body));

    const early = await call("POST", `/api/cases/${caseId}/re-assessment/submit`, "re");
    assert.equal(early.status, 422, "envio com campos obrigatórios em branco é recusado");
    assert.equal(early.body.code, "LACUNAS_BLOQUEANTES");
    assert.ok(Array.isArray(early.body.lacunas) && early.body.lacunas.length > 0);

    const futuro = await call("PUT", `/api/cases/${caseId}/re-assessment`, "re", {
      payload: { ...draft, secao_encaminhamento: { observacoes: "x", data: "2099-01-01" } },
    });
    assert.equal(futuro.status, 200, "data de encaminhamento futura é aceita (agendamento)");

    const up = await call("PUT", `/api/cases/${caseId}/re-assessment`, "re", { payload: draft });
    assert.equal(up.status, 200, JSON.stringify(up.body));

    // Com o FOGAP completo mas sem a jornada A→I, o servidor lista o que falta e só envia com confirmação.
    const semJornada = await call("POST", `/api/cases/${caseId}/re-assessment/submit`, "re");
    assert.equal(semJornada.status, 422, JSON.stringify(semJornada.body));
    assert.ok(semJornada.body.lacunas.some((l: any) => l.rotulo.includes("Formulário A")));

    await completarJornada("re", caseId);

    const sent = await call("POST", `/api/cases/${caseId}/re-assessment/submit`, "re", { confirmarLacunas: true });
    assert.equal(sent.status, 200, JSON.stringify(sent.body));

    const edit = await call("PUT", `/api/cases/${caseId}/re-assessment`, "re", { payload: draft });
    assert.equal(edit.status, 409, "após o envio a edição deve ser bloqueada");
    const again = await call("POST", `/api/cases/${caseId}/re-assessment/submit`, "re", { confirmarLacunas: true });
    assert.equal(again.status, 409);
  });

  test("administrador de outro município enviando o FOGAP recebe erro claro (não 500) e nada muda", async () => {
    const { db, tenants, users, upsertCredential } = H;
    const [tB] = await db.select().from(tenants).where(eq(tenants.municipalityCode, "B")).limit(1);
    await db.insert(users).values({ tenantId: tB.id, email: "adm@teste.local", name: "Admin Plataforma", role: "admin_platform", accessEnabled: true });
    await upsertCredential({ email: "adm@teste.local", name: "Admin Plataforma", password: PASS });
    await login("adm", "adm@teste.local");

    const s = await call("POST", "/api/students", "re", { schoolId: ids.schoolA, birthYear: 2019, birthMonth: 8 });
    assert.equal(s.status, 201, JSON.stringify(s.body));
    const c = await call("POST", "/api/cases", "re", { studentId: s.body.student.id });
    const cid = c.body.case.id;
    const created = await call("POST", `/api/cases/${cid}/re-assessment`, "re", { payload: fogapPronto() });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    await completarJornada("re", cid);

    const r = await call("POST", `/api/cases/${cid}/re-assessment/submit`, "adm", { confirmarLacunas: true });
    assert.ok([403, 404, 409].includes(r.status), `esperado erro de regra, veio ${r.status}: ${JSON.stringify(r.body)}`);
    assert.equal(typeof r.body.error, "string");

    const after = await call("GET", `/api/cases/${cid}/re-assessment`, "re");
    assert.equal(after.body.assessment?.status ?? after.body.status, "rascunho", "a transação foi desfeita: o RE ainda pode enviar");
    const ok = await call("POST", `/api/cases/${cid}/re-assessment/submit`, "re", { confirmarLacunas: true });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
  });

  test("FOGAP por faixa: 4–5 e 6–9 anos selecionáveis, respostas só da faixa, médico não recebe os itens", async () => {
    const Y = new Date().getFullYear();
    const s = await call("POST", "/api/students", "re", { schoolId: ids.schoolA, birthYear: Y - 5, birthMonth: 1, grade: "Pré II" });
    assert.equal(s.status, 201, JSON.stringify(s.body));
    const c = await call("POST", "/api/cases", "re", { studentId: s.body.student.id });
    const cid = c.body.case.id;
    const url = `/api/cases/${cid}/re-journey/fogap-desenvolvimento`;

    // 4 a 5 anos: item 75 pertence à faixa; item 95 (6 a 9) não
    const ok = await call("PUT", url, "re", { faixa: "4a5", respostas: { "FOGAP-D-075": "adequada", "FOGAP-D-076": "inadequada", "FOGAP-D-077": null } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.form.payload.faixa_fogap, "4a5");
    assert.equal(ok.body.form.payload.respostas_desenvolvimento["FOGAP-D-076"], "inadequada");
    assert.equal(ok.body.form.payload.grupo, "G2");
    assert.equal((await call("PUT", url, "re", { faixa: "4a5", respostas: { "FOGAP-D-095": "adequada" } })).status, 400, "item de outra faixa");
    assert.equal((await call("PUT", url, "re", { faixa: "4a5", respostas: { "FOGAP-D-075": "talvez" } })).status, 400, "valor fora do enum");
    assert.equal((await call("PUT", url, "re", { faixa: "9a12", respostas: {} })).status, 400, "faixa inválida");

    // Trocar para 6 a 9 anos mantém as respostas da faixa anterior (nada é apagado)
    const troca = await call("PUT", url, "re", { faixa: "6a9", respostas: { "FOGAP-D-095": "adequada" } });
    assert.equal(troca.status, 200);
    assert.equal(troca.body.form.payload.faixa_fogap, "6a9");
    assert.equal(troca.body.form.payload.respostas_desenvolvimento["FOGAP-D-075"], "adequada");

    // Salvar o sumário depois não perde as respostas nem a faixa
    const sum = await call("PUT", `/api/cases/${cid}/re-journey/sumario`, "re", {
      secao_sumario: { dificuldades_persistentes: [], conduta: "nao", qual: "", tempo: "", resultado: "" },
    });
    assert.equal(sum.status, 200);
    assert.equal(sum.body.form.payload.faixa_fogap, "6a9");
    assert.equal(sum.body.form.payload.respostas_desenvolvimento["FOGAP-D-095"], "adequada");

    // O RE relê tudo; quem só lê (médico) nunca recebe os itens
    const re = await call("GET", `/api/cases/${cid}/re-journey`, "re");
    assert.equal(re.body.forms.i.payload.respostas_desenvolvimento["FOGAP-D-076"], "inadequada");

    // Especialista e gestor não gravam
    assert.equal((await call("PUT", url, "esp", { faixa: "4a5", respostas: {} })).status, 403);
    assert.equal((await call("PUT", url, "md", { faixa: "4a5", respostas: {} })).status, 403);
  });

  test("jornada do RE: formulário único — qualquer ordem, lacunas listadas e envio com confirmação", async () => {
    const s = await call("POST", "/api/students", "re", { schoolId: ids.schoolA, birthYear: 2019, birthMonth: 3, grade: "3º ano" });
    assert.equal(s.status, 201, JSON.stringify(s.body));
    assert.equal(s.body.student.grade, "3º ano");
    const sid = s.body.student.id;
    const c = await call("POST", "/api/cases", "re", { studentId: sid });
    const cid = c.body.case.id;
    assert.equal(c.body.case.grade, "3º ano");
    const base = `/api/cases/${cid}/re-journey`;

    const inicio = await call("GET", base, "re");
    assert.equal(inicio.status, 200);
    assert.equal(inicio.body.situacao.passos.length, 9);
    assert.ok(inicio.body.situacao.passos.every((p: any) => p.estado === "vazio"), "nada bloqueado: todos os blocos abertos");
    assert.ok(inicio.body.situacao.lacunas.length > 0);
    assert.equal(inicio.body.student.grade, "3º ano");
    assert.equal(inicio.body.student.schoolName, "Escola A1");
    assert.equal(inicio.body.professores.length, 1);
    assert.equal(inicio.body.professorSugerido.id, ids.prof, "com um só professor na escola, o B já vem com ele");

    // Sem ordem obrigatória: F antes de A
    assert.equal((await call("PUT", `${base}/forms/f`, "re", { payload: { data_aplicacao: "2026-10-07" } })).status, 200);
    assert.equal((await call("PUT", `${base}/forms/f`, "re", { payload: { data_aplicacao: "2099-01-01" } })).status, 400, "aplicação do IPPL-R não pode ser futura");

    // Valores fora do catálogo são recusados; em branco é permitido
    assert.equal((await call("PUT", `${base}/forms/a`, "re", { payload: { gosta_escola: ["talvez"] } })).status, 400);
    assert.equal((await call("PUT", `${base}/forms/a`, "re", { payload: { nome_do_aluno: "x" } })).status, 400, "o formulário não aceita campo fora do catálogo (ex.: nome)");
    const salvo = await call("PUT", `${base}/forms/a`, "re", {
      payload: { gosta_escola: ["as_vezes"], gosta_escola__obs: "depende do dia", pai_trabalha: "sim", expressao_oral: { vocabulario: { r: ["sim"] } } },
    });
    assert.equal(salvo.status, 200, JSON.stringify(salvo.body));
    assert.equal(salvo.body.form.payload.mae_trabalha, undefined, "em branco não vira 'não'");
    assert.equal(salvo.body.situacao.passos[0].estado, "parcial");

    // Professor do Formulário B: vem do cadastro da escola; o nome oficial prevalece
    const prof = await call("PUT", `${base}/forms/b`, "re", { payload: { professor: { id: ids.prof, nome: "Nome digitado" } } });
    assert.equal(prof.status, 200, JSON.stringify(prof.body));
    assert.equal(prof.body.form.payload.professor.nome, "Professor Teste");
    const profOutra = await call("PUT", `${base}/forms/b`, "re", { payload: { professor: { id: ids.profOutra } } });
    assert.equal(profOutra.status, 400, "professor de outra escola é recusado");

    // Outro município não enxerga nem altera
    assert.equal((await call("GET", base, "reB")).status, 404);
    assert.equal((await call("PUT", `${base}/forms/b`, "reB", { payload: {} })).status, 404);
    assert.equal((await call("POST", `${base}/timings`, "reB", { step: "a", seconds: 10 })).status, 404);

    // Tempo ativo por bloco (somente segundos)
    assert.equal((await call("POST", `${base}/timings`, "re", { step: "a", seconds: 120 })).status, 204);
    assert.equal((await call("POST", `${base}/timings`, "re", { step: "a", seconds: 30, novaSessao: true })).status, 204);
    assert.equal((await call("POST", `${base}/timings`, "re", { step: "a", seconds: 5000 })).status, 400);
    assert.equal((await call("POST", `${base}/timings`, "re", { step: "z", seconds: 10 })).status, 400);
    const { db, reStepTimings, reOptionalStepUsage } = H;
    const { sql } = await import("drizzle-orm");
    const tempos = await db.select().from(reStepTimings).where(eq(reStepTimings.caseId, cid));
    assert.equal(tempos.length, 1);
    assert.equal(tempos[0].activeSeconds, 150);
    assert.equal(tempos[0].sessions, 2);

    // G opcional: "Não vou aplicar" fica registrado e auditável (somente inserção)
    const pula = await call("POST", `${base}/steps/g/skip`, "re", { valor: true });
    assert.equal(pula.status, 200, JSON.stringify(pula.body));
    assert.equal(pula.body.situacao.passos[6].estado, "pulado");
    await call("POST", `${base}/steps/g/skip`, "re", { valor: true }); // repetir não duplica
    await call("POST", `${base}/steps/g/skip`, "re", { valor: false });
    await call("POST", `${base}/steps/g/skip`, "re", { valor: true });
    const usos = await db.select().from(reOptionalStepUsage).where(eq(reOptionalStepUsage.caseId, cid));
    assert.deepEqual(usos.map((u: any) => u.action).sort(), ["pulado", "pulado", "retomado"]);
    await assert.rejects(
      () => db.execute(sql`UPDATE re_optional_step_usage SET action = 'pulado' WHERE case_id = ${cid}`),
      (error: any) => /somente inserção|inserção/.test(String(error?.cause?.message ?? error?.message)),
    );
    await assert.rejects(
      () => db.execute(sql`DELETE FROM re_optional_step_usage WHERE case_id = ${cid}`),
      (error: any) => /somente inserção|inserção/.test(String(error?.cause?.message ?? error?.message)),
    );

    // H: "aguardando o responsável" NÃO libera o envio (a ATA é obrigatória)
    const aguardando = await call("POST", `${base}/steps/h/await`, "re", { valor: true });
    assert.equal(aguardando.status, 200);
    assert.equal(aguardando.body.situacao.passos[7].estado, "aguardando_responsavel");
    assert.ok(aguardando.body.situacao.lacunas.some((l: any) => l.passo === "h" && l.bloqueante));

    // Edição auditada dos dados do aluno
    const edit = await call("PATCH", `/api/students/${sid}`, "re", { grade: "4º ano" });
    assert.equal(edit.status, 200, JSON.stringify(edit.body));
    assert.deepEqual(edit.body.changed, ["grade"]);
    assert.equal((await call("PATCH", `/api/students/${sid}`, "re", { name: "José" })).status, 400, "nome não pode ser gravado");
    assert.equal((await call("PATCH", `/api/students/${sid}`, "re", { birthYear: new Date().getFullYear() - 2 })).status, 400, "fora da faixa do piloto");
    const hist = await call("GET", `/api/students/${sid}/history`, "re");
    assert.equal(hist.status, 200);
    const alteracao = hist.body.history.find((h: any) => h.action === "update_student");
    assert.ok(alteracao, "a edição fica na trilha");
    assert.equal(alteracao.payload.before.grade, "3º ano");
    assert.equal(alteracao.payload.after.grade, "4º ano");
    assert.equal(alteracao.by, "re@teste.local");
    assert.equal((await call("PATCH", `/api/students/${sid}`, "reB", { grade: "5º ano" })).status, 404);

    // Envio: lista as lacunas e só segue com confirmação
    const semConfirmar = await call("POST", `/api/cases/${cid}/re-assessment/submit`, "re");
    assert.equal(semConfirmar.status, 422);
    assert.equal(semConfirmar.body.code, "LACUNAS_BLOQUEANTES");
    assert.ok(semConfirmar.body.total > 0);

    // Sumário I: série vem do cadastro, mesmo que o cliente mande outra
    const sum = await call("PUT", `${base}/sumario`, "re", {
      secao_sumario: { serie: "9º ano", queixa_professor: "Dificuldade para copiar da lousa.", dificuldades_persistentes: ["Aprendizagem"], conduta: "nao", qual: "", tempo: "", resultado: "" },
      secao_encaminhamento: { observacoes: "", data: "2099-02-01" },
    });
    assert.equal(sum.status, 200, JSON.stringify(sum.body));
    assert.equal(sum.body.form.payload.grupo, "G3", "grupo vem do ano/mês de nascimento, não é digitado");
    assert.equal(sum.body.form.payload.secao_sumario.serie, "4º ano");
    assert.equal(sum.body.form.payload.secao_encaminhamento.data, "2099-02-01", "data futura de encaminhamento é aceita");

    // Mesmo "enviando assim mesmo", faltam obrigatórios (hipótese do RE curta/ausente e ATA): recusado
    const assimMesmo = await call("POST", `/api/cases/${cid}/re-assessment/submit`, "re", { confirmarLacunas: true });
    assert.equal(assimMesmo.status, 422, JSON.stringify(assimMesmo.body));
    assert.equal(assimMesmo.body.code, "LACUNAS_BLOQUEANTES");
    assert.ok(assimMesmo.body.lacunas.some((l: any) => l.passo === "h" && l.bloqueante), "ATA é obrigatória");
    assert.ok(assimMesmo.body.lacunas.some((l: any) => l.campo === "hipotese_espectro" && l.bloqueante));
    const curto = await call("PUT", `${base}/sumario`, "re", {
      secao_sumario: { serie: "", queixa_professor: "curta", hipotese_espectro: "x", dificuldades_persistentes: ["Aprendizagem"], conduta: "nao", qual: "", tempo: "", resultado: "" },
      secao_encaminhamento: { observacoes: "", data: "2099-02-01" },
    });
    assert.equal(curto.status, 200);
    const poucos = await call("POST", `/api/cases/${cid}/re-assessment/submit`, "re", { confirmarLacunas: true });
    assert.ok(poucos.body.lacunas.some((l: any) => l.campo === "queixa_professor" && /pelo menos 20 caracteres/.test(l.rotulo)), "mínimo de caracteres");
    await preencherObrigatorios("re", cid);
    await call("PATCH", `/api/students/${sid}`, "re", { grade: "4º ano" });

    const enviado = await call("POST", `/api/cases/${cid}/re-assessment/submit`, "re", { confirmarLacunas: true });
    assert.equal(enviado.status, 200, JSON.stringify(enviado.body));
    assert.match(enviado.body.summary, /Série: 4º ano/);
    assert.match(enviado.body.summary, /Escola: Escola A1/);
    assert.match(enviado.body.summary, /Nascimento: 03\/2019/);
    assert.match(enviado.body.summary, /H \(ATA\) registrada/);

    // Depois do envio tudo é somente leitura (inclusive o cadastro do aluno)
    assert.equal((await call("PUT", `${base}/forms/a`, "re", { payload: {} })).status, 409);
    assert.equal((await call("PATCH", `/api/students/${sid}`, "re", { grade: "5º ano" })).status, 409);
    // O Formulário I e os itens do FOGAP também travam (a tela do RE vira somente leitura pelo estado do caso)
    assert.equal((await call("PUT", `${base}/sumario`, "re", { secao_sumario: { dificuldades_persistentes: [], conduta: "nao", qual: "", tempo: "", resultado: "" } })).status, 409);
    assert.equal((await call("PUT", `${base}/fogap-desenvolvimento`, "re", { faixa: "6a9", respostas: { "FOGAP-D-095": "adequada" } })).status, 409);
    const lido = await call("GET", base, "re");
    assert.equal(lido.status, 200);
    assert.notEqual(lido.body.caseState, "rascunho", "estado do caso manda a tela para somente leitura");

    // Médico lê o sumário do RE e os dados do aluno no consolidado (A–G ficam com o RE) e devolve; o RE volta a poder editar e reenviar
    const cons = await call("GET", `/api/cases/${cid}/consolidated`, "md");
    assert.equal(cons.status, 200, JSON.stringify(cons.body));
    assert.ok(!("reJourney" in cons.body), "formulários A a G do RE não vão ao médico");
    assert.ok(!JSON.stringify(cons.body).includes("as_vezes"), "nenhuma resposta do Formulário A no consolidado");
    assert.ok(cons.body.reAssessment, "o sumário (FOGAP) continua disponível");
    const escalas = (cons.body.reAssessment.payload ?? cons.body.reAssessment).escalas;
    assert.equal(escalas?.ata?.total, 1, "o médico recebe o retrato da ATA (1 grupo com 1 comportamento = 1 ponto)");
    assert.equal(escalas?.snap4, null, "SNAP-IV foi pulado: não aparece");
    assert.equal(cons.body.student.grade, "4º ano");
    assert.equal(cons.body.student.schoolName, "Escola A1");
    assert.equal(cons.body.student.birthMonth, 3);

    const dev = await call("POST", `/api/cases/${cid}/return`, "md", { reason: "Completar a entrevista com o aluno." });
    assert.equal(dev.status, 200, JSON.stringify(dev.body));
    const edita = await call("PUT", `${base}/forms/a`, "re", { payload: { gosta_escola: ["sim"] } });
    assert.equal(edita.status, 200, JSON.stringify(edita.body));
    assert.equal((await call("PATCH", `/api/students/${sid}`, "re", { grade: "3º ano" })).status, 200, "devolvido: o cadastro volta a ser editável");
    const reenvio = await call("POST", `/api/cases/${cid}/re-assessment/submit`, "re", { confirmarLacunas: true });
    assert.equal(reenvio.status, 200, JSON.stringify(reenvio.body));
  });

  test("A–F em branco ainda podem ir com confirmação, mas só depois dos obrigatórios (série, ATA e Formulário I)", async () => {
    const s = await call("POST", "/api/students", "re", { schoolId: ids.schoolA, birthYear: 2018, birthMonth: 6 });
    const c = await call("POST", "/api/cases", "re", { studentId: s.body.student.id });
    const cid = c.body.case.id;
    const semConfirmar = await call("POST", `/api/cases/${cid}/re-assessment/submit`, "re");
    assert.equal(semConfirmar.status, 422);
    assert.equal(semConfirmar.body.code, "LACUNAS_BLOQUEANTES");
    await preencherObrigatorios("re", cid);
    const pedeConfirmacao = await call("POST", `/api/cases/${cid}/re-assessment/submit`, "re");
    assert.equal(pedeConfirmacao.status, 422);
    assert.equal(pedeConfirmacao.body.code, "LACUNAS", "A–F em branco continuam pedindo confirmação, sem bloquear");
    const enviado = await call("POST", `/api/cases/${cid}/re-assessment/submit`, "re", { confirmarLacunas: true });
    assert.equal(enviado.status, 200, JSON.stringify(enviado.body));
    assert.match(enviado.body.summary, /Série: 3º ano/);
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

  test("especialista vê só o sumário executivo do médico (pendente) e nada do RE nem dos colegas", async () => {
    const v = await call("GET", `/api/cases/${caseId}/specialist-view`, "esp");
    assert.equal(v.status, 200, JSON.stringify(v.body));
    assert.deepEqual(v.body.sumarioExecutivoMedico, { status: "pendente", registro: null, completedAt: null, campos: [] });
    for (const chave of ["fogap", "peerSections", "medicalFinalSummary"]) {
      assert.ok(!(chave in v.body), `a visão do especialista não devolve ${chave}`);
    }
    assert.ok(!JSON.stringify(v.body).includes("professionalName"));
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

  test("especialista só vê o sumário do médico depois de concluído; parecer do colega nunca; sem seção → 403", async () => {
    // O médico escreve o sumário: em rascunho ele não sai do perfil dele
    const rasc = await call("PUT", `/api/cases/${caseId}/medical-forms/sumario_medico`, "md", {
      payload: {
        queixa_professor: "sumário executivo sintético do médico",
        avaliacao_re: "avaliação sintética do RE",
        hipotese: "hipótese sintética registrada pelo médico",
        conduta: "8,6",
        data: "2026-10-27",
      },
    });
    assert.equal(rasc.status, 200, JSON.stringify(rasc.body));
    const antes = await call("GET", `/api/cases/${caseId}/specialist-view`, "esp");
    assert.equal(antes.body.sumarioExecutivoMedico.status, "pendente");
    assert.ok(!JSON.stringify(antes.body).includes("sintético do médico"), "rascunho do médico não vaza");

    const concl = await call("POST", `/api/cases/${caseId}/medical-forms/sumario_medico/complete`, "md");
    assert.equal(concl.status, 200, JSON.stringify(concl.body));
    const v = await call("GET", `/api/cases/${caseId}/specialist-view`, "esp");
    assert.equal(v.status, 200, JSON.stringify(v.body));
    assert.equal(v.body.sumarioExecutivoMedico.status, "concluido");
    assert.equal(v.body.sumarioExecutivoMedico.campos.length, 5);
    assert.deepEqual(v.body.sumarioExecutivoMedico.campos.find((c: any) => c.id === "conduta")?.itens, [
      "6. sim, está sob farmacoterapia",
      "8. Fez avaliação neuropsicológica",
    ]);
    assert.deepEqual(v.body.sumarioExecutivoMedico.campos.find((c: any) => c.id === "data"), {
      id: "data", rotulo: "Data", tipo: "data", valor: "2026-10-27",
    });
    assert.ok(v.body.sumarioExecutivoMedico.registro.includes("sumário executivo sintético do médico"));
    assert.ok(v.body.sumarioExecutivoMedico.registro.includes("Queixa do professor"));
    assert.ok(!("peerSections" in v.body), "parecer do colega não aparece, nem concluído");
    assert.ok(!("fogap" in v.body), "FOGAP não aparece");

    const re = await call("GET", `/api/cases/${caseId}/specialist-view`, "re");
    assert.equal(re.status, 403, "RE não usa esta rota");
  });

  test("médico vê o consolidado, encerra com motivo e a trilha mostra todos os eventos", async () => {
    const cons = await call("GET", `/api/cases/${caseId}/consolidated`, "md");
    assert.equal(cons.status, 200, JSON.stringify(cons.body));

    const semPeriodo = await call("POST", `/api/cases/${caseId}/close`, "md", { decision: "acompanhamento", reason: "sem periodicidade" });
    assert.equal(semPeriodo.status, 400, "acompanhamento exige semestral ou anual");
    const noReason = await call("POST", `/api/cases/${caseId}/close`, "md", { decision: "acompanhamento", reason: "" });
    assert.equal(noReason.status, 400);

    const closed = await call("POST", `/api/cases/${caseId}/close`, "md", { decision: "acompanhamento", followUp: "semestral", reason: "Encerramento sintético da demonstração" });
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
