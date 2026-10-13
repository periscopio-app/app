/**
 * E2E dos indicadores do piloto: grupo (escola e rede), individual (aluno por código) e registro da medida
 * de sintomas. Dados 100% sintéticos. Requer TEST_DATABASE_URL (Postgres local de teste).
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;
const PASS = "Senha-de-teste-123!";

describe("Indicadores do piloto (E2E)", { skip }, () => {
  let app: FastifyInstance;
  let db: typeof import("../db/client").db;
  let shared: typeof import("@periscopio/shared");
  const cookies = {} as Record<string, string>;
  const realFetch = globalThis.fetch;
  const allCodes: string[] = [];
  let schoolGL = "", schoolNova = "", schoolCtl = "", schoolB = "";
  let tenantA = "", tenantB = "";
  let abandonoCode = "", novaCode = "", otherTenantCode = "";
  let abandonoCaseId = "", revisaoCaseId = "", delegadoCaseId = "";
  const users = {} as Record<string, string>;

  async function call(method: string, path: string, who?: string, body?: unknown) {
    const headers: Record<string, string> = { origin: "http://localhost:3000" };
    if (who) headers.cookie = cookies[who];
    if (body !== undefined) headers["content-type"] = "application/json";
    const r = await app.inject({ method: method as any, url: path, headers, payload: body === undefined ? undefined : JSON.stringify(body) });
    let parsed: any = null;
    try { parsed = r.json(); } catch { parsed = r.body; }
    return { status: r.statusCode, body: parsed, raw: r.body };
  }

  const day = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

  /** Cria aluno + caso e as transições que a máquina de estados gravaria. */
  async function mkCase(opts: {
    tenant: string; school: string; tag: string; i: number; state: string;
    sent?: boolean; evaluated?: boolean; decision?: string; followUp?: string; sentDay?: string;
  }) {
    const code = `T-${opts.tag}-${opts.i}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    allCodes.push(code);
    const [st] = await db.insert(shared.students).values({ tenantId: opts.tenant, schoolId: opts.school, studentCode: code, birthYear: 2018, birthMonth: 4, ageBracket: "06-09" }).returning();
    const [cs] = await db.insert(shared.cases).values({ tenantId: opts.tenant, studentId: st.id, status: "triagem", journeyState: opts.state }).returning();
    const sentAt = day(opts.sentDay ?? "2026-03-10");
    const evalAt = new Date(sentAt.getTime() + 3 * 86_400_000);
    const tr = async (to: string, at: Date) =>
      db.insert(shared.caseTransitions).values({ tenantId: opts.tenant, caseId: cs.id, fromState: null, toState: to, actorRole: "sistema", reason: "teste", createdAt: at });
    if (opts.sent) await tr("enviado_re", sentAt);
    if (opts.evaluated) await tr("delegado", evalAt);
    if (opts.decision) {
      await db.insert(shared.caseTimeline).values({
        tenantId: opts.tenant, caseId: cs.id, event: "case:closed",
        payload: { decision: opts.decision, followUp: opts.followUp, reason: "teste" }, createdAt: day("2026-06-01"),
      });
    }
    return { code, caseId: cs.id, studentId: st.id };
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
    delete process.env.PILOT_REQUIRED_COURSE_IDS;

    globalThis.fetch = (async (input: any, init?: any) => {
      if (String(input).startsWith("https://api.resend.com/")) return new Response(JSON.stringify({ id: "x" }), { status: 200 });
      return realFetch(input, init);
    }) as typeof fetch;

    shared = await import("@periscopio/shared");
    ({ db } = await import("../db/client"));
    const { upsertCredential } = await import("../auth/credentials");
    const { buildApp } = await import("../app");

    const [tA] = await db.insert(shared.tenants).values({ name: "Município A", municipalityCode: "A" }).returning();
    const [tB] = await db.insert(shared.tenants).values({ name: "Município B", municipalityCode: "B" }).returning();
    tenantA = tA.id; tenantB = tB.id;
    const [sGL] = await db.insert(shared.schools).values({ tenantId: tA.id, name: "Escola GL", slug: "escola-gl", status: "active", enrollment: 200 }).returning();
    const [sN] = await db.insert(shared.schools).values({ tenantId: tA.id, name: "Escola Nova", slug: "escola-nova", status: "active", enrollment: 100 }).returning();
    const [sC] = await db.insert(shared.schools).values({ tenantId: tA.id, name: "Escola Controle", slug: "escola-controle", status: "active", enrollment: 80, isControlGroup: true }).returning();
    const [sB] = await db.insert(shared.schools).values({ tenantId: tB.id, name: "Escola B1", slug: "escola-b1", status: "active", enrollment: 90 }).returning();
    schoolGL = sGL.id; schoolNova = sN.id; schoolCtl = sC.id; schoolB = sB.id;

    const people = [
      { key: "admin", email: "admin@teste.local", role: "admin_platform", tenant: tA.id, school: null },
      { key: "municipal", email: "municipal@teste.local", role: "municipal_manager", tenant: tA.id, school: null },
      { key: "gestorGL", email: "gestor@teste.local", role: "school_manager", tenant: tA.id, school: sGL.id },
      { key: "reGL", email: "re@teste.local", role: "ppi", tenant: tA.id, school: sGL.id },
      { key: "reNova", email: "renova@teste.local", role: "ppi", tenant: tA.id, school: sN.id },
      { key: "md", email: "md@teste.local", role: "md1", tenant: tA.id, school: null },
      { key: "mdB", email: "mdb@teste.local", role: "md1", tenant: tB.id, school: null },
      { key: "esp", email: "esp@teste.local", role: "specialist", tenant: tA.id, school: null },
      { key: "espOutro", email: "esp2@teste.local", role: "specialist", tenant: tA.id, school: null },
      { key: "prof", email: "prof@teste.local", role: "teacher", tenant: tA.id, school: sGL.id },
    ];
    for (const p of people) {
      const [u] = await db.insert(shared.users).values({ tenantId: p.tenant, schoolId: p.school, email: p.email, name: p.key, role: p.role, accessEnabled: true }).returning();
      users[p.key] = u.id;
      await upsertCredential({ email: p.email, name: p.key, password: PASS });
    }

    // Capacitação: educadores da Escola GL = reGL + prof + 4 professores; 2 cursos obrigatórios.
    const fillers: string[] = [];
    for (let i = 0; i < 4; i++) {
      const [u] = await db.insert(shared.users).values({ tenantId: tA.id, schoolId: sGL.id, email: `prof${i}@teste.local`, name: `prof${i}`, role: "teacher", accessEnabled: true }).returning();
      fillers.push(u.id);
    }
    const [c1] = await db.insert(shared.courses).values({ title: "Curso A" }).returning();
    const [c2] = await db.insert(shared.courses).values({ title: "Curso B" }).returning();
    for (const uid of fillers.slice(0, 3)) {
      for (const c of [c1, c2]) await db.insert(shared.enrollments).values({ tenantId: tA.id, userId: uid, courseId: c.id, progress: 100, completedAt: day("2026-04-01") });
    }
    await db.insert(shared.enrollments).values({ tenantId: tA.id, userId: fillers[3], courseId: c1.id, progress: 30 });

    // Escola GL: 30 encaminhados, 24 avaliados (8 alta, 5 abandono, 5 interrupção, 6 em atendimento), 6 aguardando.
    let i = 0;
    for (let n = 0; n < 8; n++) await mkCase({ tenant: tA.id, school: sGL.id, tag: "ALT", i: i++, state: "encerrado", sent: true, evaluated: true, decision: "alta" });
    for (let n = 0; n < 5; n++) {
      const c = await mkCase({ tenant: tA.id, school: sGL.id, tag: "ABA", i: i++, state: "encerrado", sent: true, evaluated: true, decision: "abandono" });
      if (n === 0) { abandonoCode = c.code; abandonoCaseId = c.caseId; }
    }
    for (let n = 0; n < 5; n++) await mkCase({ tenant: tA.id, school: sGL.id, tag: "INT", i: i++, state: "encerrado", sent: true, evaluated: true, decision: "interrupcao_justificada" });
    const delegados: { caseId: string }[] = [];
    for (let n = 0; n < 6; n++) delegados.push(await mkCase({ tenant: tA.id, school: sGL.id, tag: "DEL", i: i++, state: "delegado", sent: true, evaluated: true }));
    delegadoCaseId = delegados[0].caseId;
    for (let n = 0; n < 6; n++) {
      const c = await mkCase({ tenant: tA.id, school: sGL.id, tag: "REV", i: i++, state: "revisao_medica", sent: true });
      if (n === 0) revisaoCaseId = c.caseId;
    }
    // Medidas do núcleo: 24 iniciais; 14 reavaliações (7 menos itens, 5 igual, 2 mais itens). Escola nenhuma.
    const admitted = await db.select({ id: shared.cases.id }).from(shared.cases).innerJoin(shared.students, (await import("drizzle-orm")).eq(shared.cases.studentId, shared.students.id)).where((await import("drizzle-orm")).and((await import("drizzle-orm")).eq(shared.students.schoolId, sGL.id), (await import("drizzle-orm")).inArray(shared.cases.journeyState, ["encerrado", "delegado"])));
    assert.equal(admitted.length, 24);
    const row = (caseId: string, phase: string, marked: number) => ({
      tenantId: tA.id, schoolId: sGL.id, caseId, phase, source: "nucleo", measure: "snap4_itens_1a9", measureVersion: "teste",
      appliedOn: phase === "inicial" ? "2026-03-20" : "2026-11-20", answers: {}, markedCount: marked, itemsTotal: 9,
      recordedBy: users.md, recordedRole: "md1",
    });
    for (const a of admitted) await db.insert(shared.symptomMeasurements).values(row(a.id, "inicial", 6));
    admitted.slice(0, 7).forEach(async () => {});
    for (const [idx, a] of admitted.slice(0, 14).entries()) {
      const marked = idx < 7 ? 3 : idx < 12 ? 6 : 8;
      await db.insert(shared.symptomMeasurements).values(row(a.id, "reavaliacao", marked));
    }

    // Escola Nova: 3 encaminhados, 2 avaliados (grupo pequeno). Controle: 2 casos. Município B: 8 casos.
    for (let n = 0; n < 3; n++) {
      const c = await mkCase({ tenant: tA.id, school: sN.id, tag: "NOV", i: n, state: n < 2 ? "delegado" : "revisao_medica", sent: true, evaluated: n < 2 });
      if (n === 0) novaCode = c.code;
    }
    for (let n = 0; n < 2; n++) await mkCase({ tenant: tA.id, school: sC.id, tag: "CTL", i: n, state: "revisao_medica", sent: true });
    for (let n = 0; n < 8; n++) {
      const c = await mkCase({ tenant: tB.id, school: sB.id, tag: "BB", i: n, state: "delegado", sent: true, evaluated: true });
      if (n === 0) otherTenantCode = c.code;
    }
    // O especialista "esp" é o designado no caso delegado[0].
    await db.insert(shared.caseSummaries).values({ tenantId: tA.id, schoolId: sGL.id, caseId: delegadoCaseId, specialty: "psicologia", assignedProfessionalId: users.esp, status: "pendente" });

    app = await buildApp({ logger: false });
    await app.ready();
    for (const p of people) {
      const r = await app.inject({
        method: "POST", url: "/api/auth/sign-in/email",
        headers: { origin: "http://localhost:3000", "content-type": "application/json" },
        payload: JSON.stringify({ email: p.email, password: PASS }),
      });
      assert.equal(r.statusCode, 200);
      const set = r.headers["set-cookie"];
      cookies[p.key] = (Array.isArray(set) ? set : [String(set)]).map((c) => c.split(";")[0]).join("; ");
    }
  });

  after(async () => {
    globalThis.fetch = realFetch;
    await app?.close();
  });

  test("sem sessão ou sem privilégio não vê indicadores", async () => {
    assert.equal((await call("GET", "/api/pilot/indicators")).status, 401);
    assert.equal((await call("GET", "/api/pilot/indicators", "prof")).status, 403);
    assert.equal((await call("GET", "/api/pilot/indicators", "esp")).status, 403);
    assert.equal((await call("GET", `/api/pilot/students/${abandonoCode}/indicators`, "esp")).status, 403);
    assert.equal((await call("GET", `/api/pilot/students/${abandonoCode}/indicators`, "municipal")).status, 403, "gestão vê agregado, não o aluno");
  });

  test("rede: os 5 indicadores calculados com os números esperados", async () => {
    const r = await call("GET", "/api/pilot/indicators", "municipal");
    assert.equal(r.status, 200);
    assert.equal(r.body.definitions.length, 5);
    assert.ok(r.body.definitions.every((d: any) => d.status === "proposta" && d.pendencias.length > 0));
    const gl = r.body.bySchool.find((s: any) => s.schoolName === "Escola GL");

    // 1 Capacitação: 6 educadores, 3 concluíram
    assert.equal(gl.capacitacao.educadores, 6);
    assert.equal(gl.capacitacao.concluiram, 3);
    assert.equal(gl.capacitacao.emAndamento, 1);
    assert.equal(gl.capacitacao.percentual.value, 50);
    // 2 Rastreio: 30 FOGAP enviados / 200 matriculados
    assert.equal(gl.rastreio.fogapEnviado.value, 30);
    assert.equal(gl.rastreio.percentual.value, 15);
    // 3 Acesso: 24 de 30; mediana 3 dias
    assert.equal(gl.acesso.acessaram.value, 24);
    assert.equal(gl.acesso.aguardando.value, 6);
    assert.equal(gl.acesso.percentual.value, 80);
    assert.equal(gl.acesso.medianaDias, 3);
    // 4 Desfecho
    assert.equal(gl.desfecho.admitidos.value, 24);
    assert.equal(gl.desfecho.categorias.alta.value, 8);
    assert.equal(gl.desfecho.taxas.alta.value, 33.3);
    assert.equal(gl.desfecho.taxas.abandono.value, 20.8);
    assert.equal(gl.desfecho.taxas.adesao.value, 58.3);
    // 5 Estabilização (núcleo): 24 iniciais, 14 pares
    assert.equal(gl.estabilizacao.nucleo.comMedidaInicial.value, 24);
    assert.equal(gl.estabilizacao.nucleo.comParCompleto.value, 14);
    assert.equal(gl.estabilizacao.nucleo.direcao.menos_itens.value, 7);
    assert.equal(gl.estabilizacao.nucleo.direcao.mais_itens.suppressed, true);
    assert.equal(gl.estabilizacao.nucleo.direcao.igual.suppressed, true);
    assert.equal(gl.estabilizacao.escola.comMedidaInicial.value, 0);

    // Rede: 33 enviados / 300 matriculados (GL + Nova); controle fica fora por padrão
    assert.equal(r.body.overall.rastreio.fogapEnviado.value, 33);
    assert.equal(r.body.overall.rastreio.percentual.value, 11);
    assert.ok(!r.body.bySchool.some((s: any) => s.schoolName === "Escola Controle"));
    assert.ok(!r.body.bySchool.some((s: any) => s.schoolName === "Escola B1"), "outro município nunca aparece");
  });

  test("escola pequena fica oculta (<5) em todos os indicadores de alunos", async () => {
    const r = await call("GET", "/api/pilot/indicators", "municipal");
    const nova = r.body.bySchool.find((s: any) => s.schoolName === "Escola Nova");
    assert.equal(nova.rastreio.fogapEnviado.suppressed, true);
    assert.equal(nova.rastreio.percentual.suppressed, true);
    assert.equal(nova.acesso.acessaram.suppressed, true);
    assert.equal(nova.acesso.medianaDias, null);
    assert.equal(nova.desfecho.admitidos.suppressed, true);
    assert.equal(nova.estabilizacao.admitidos.suppressed, true);
  });

  test("grupo controle é separado do piloto", async () => {
    const r = await call("GET", "/api/pilot/indicators?group=control", "municipal");
    assert.deepEqual(r.body.bySchool.map((s: any) => s.schoolName), ["Escola Controle"]);
    const all = await call("GET", "/api/pilot/indicators?group=all", "municipal");
    assert.equal(all.body.bySchool.length, 3);
  });

  test("gestor e RE de uma escola só enxergam a própria; pedir outra escola é 404", async () => {
    const own = await call("GET", "/api/pilot/indicators", "gestorGL");
    assert.deepEqual(own.body.bySchool.map((s: any) => s.schoolName), ["Escola GL"]);
    assert.equal((await call("GET", `/api/pilot/indicators?schoolId=${schoolNova}`, "gestorGL")).status, 404);
    const re = await call("GET", "/api/pilot/indicators", "reNova");
    assert.deepEqual(re.body.bySchool.map((s: any) => s.schoolName), ["Escola Nova"]);
  });

  test("tenantId de outro município só vale para o admin da plataforma", async () => {
    const mun = await call("GET", `/api/pilot/indicators?tenantId=${tenantB}`, "municipal");
    assert.equal(mun.status, 200);
    assert.ok(!mun.body.bySchool.some((s: any) => s.schoolName === "Escola B1"));
    const adm = await call("GET", `/api/pilot/indicators?tenantId=${tenantB}`, "admin");
    assert.deepEqual(adm.body.bySchool.map((s: any) => s.schoolName), ["Escola B1"]);
  });

  test("a resposta do grupo nunca traz código de aluno nem linguagem diagnóstica", async () => {
    const r = await call("GET", "/api/pilot/indicators?group=all", "municipal");
    for (const code of allCodes) assert.ok(!r.raw.includes(code), `código ${code} vazou`);
    const lower = r.raw.toLowerCase();
    for (const banned of ["melhorou", "piorou", "remissão", "diagnóstico positivo"]) assert.ok(!lower.includes(banned));
  });

  test("individual: médico e RE da escola veem o percurso do aluno; outro município e outra escola não", async () => {
    const md = await call("GET", `/api/pilot/students/${abandonoCode}/indicators`, "md");
    assert.equal(md.status, 200);
    assert.equal(md.body.student.studentCode, abandonoCode);
    assert.equal(md.body.cases.length, 1);
    const c = md.body.cases[0];
    assert.equal(c.rastreio.fogapEnviadoEm.startsWith("2026-03-10"), true);
    assert.equal(c.acesso.diasAteAvaliacao, 3);
    assert.equal(c.desfecho.categoria, "abandono");
    assert.equal(c.estabilizacao.nucleo.inicial, 6);

    assert.equal((await call("GET", `/api/pilot/students/${abandonoCode}/indicators`, "reGL")).status, 200);
    assert.equal((await call("GET", `/api/pilot/students/${abandonoCode}/indicators`, "reNova")).status, 404);
    assert.equal((await call("GET", `/api/pilot/students/${otherTenantCode}/indicators`, "md")).status, 404);
    assert.equal((await call("GET", `/api/pilot/students/${abandonoCode}/indicators`, "mdB")).status, 404);
    assert.equal((await call("GET", `/api/pilot/students/NAO-EXISTE/indicators`, "md")).status, 404);
  });

  test("individual: o acesso fica na trilha de auditoria", async () => {
    await call("GET", `/api/pilot/students/${abandonoCode}/indicators`, "md");
    const rows = await db.select().from(shared.auditLogs);
    assert.ok(rows.some((a) => a.action === "pilot.student_indicators.view" && a.userEmail === "md@teste.local"));
    const payloads = JSON.stringify(rows.filter((a) => a.action === "pilot.student_indicators.view"));
    assert.ok(!payloads.includes(abandonoCode), "a auditoria referencia o id, não o código");
  });

  const allNine = (value: string) => Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`SNAP4-0${i + 1}`, value]));

  test("medida: RE registra a da escola; contagem é calculada no servidor", async () => {
    const answers = { ...allNine("so_um_pouco"), "SNAP4-01": "bastante", "SNAP4-02": "demais", "SNAP4-03": "bastante" };
    const r = await call("POST", `/api/cases/${revisaoCaseId}/symptom-measurements`, "reGL", { phase: "inicial", source: "escola", appliedOn: "2026-03-12", answers });
    assert.equal(r.status, 201);
    assert.equal(r.body.markedCount, 3);
    assert.equal(r.body.itemsTotal, 9);
    // não aceita a contagem vinda do cliente
    const bad = await call("POST", `/api/cases/${revisaoCaseId}/symptom-measurements`, "reGL", { phase: "inicial", source: "escola", appliedOn: "2026-03-12", answers, markedCount: 0 });
    assert.equal(bad.status, 400);
  });

  test("medida: validações de origem, caso, itens, data e ordem", async () => {
    const ok = allNine("nem_um_pouco");
    const post = (who: string, caseId: string, body: any) => call("POST", `/api/cases/${caseId}/symptom-measurements`, who, body);
    // RE não registra a do núcleo; médico não registra a da escola? (médico não é RE) -> 403
    assert.equal((await post("reGL", revisaoCaseId, { phase: "inicial", source: "nucleo", appliedOn: "2026-03-12", answers: ok })).status, 403);
    assert.equal((await post("md", revisaoCaseId, { phase: "inicial", source: "escola", appliedOn: "2026-03-12", answers: ok })).status, 403);
    // caso ainda não chegou ao núcleo: o rascunho/enviado_re bloqueia; revisão médica já permite
    assert.equal((await post("md", revisaoCaseId, { phase: "inicial", source: "nucleo", appliedOn: "2026-03-12", answers: ok })).status, 201);
    // especialista só no caso em que foi designado
    assert.equal((await post("espOutro", delegadoCaseId, { phase: "inicial", source: "nucleo", appliedOn: "2026-03-12", answers: ok })).status, 403);
    assert.equal((await post("esp", delegadoCaseId, { phase: "reavaliacao", source: "nucleo", appliedOn: "2026-10-05", answers: ok })).status, 201, "o caso já tem a inicial do núcleo");
    // itens faltando, item inventado, data futura, reavaliação antes da inicial, reavaliação sem inicial
    const partial = { ...ok }; delete (partial as any)["SNAP4-09"];
    assert.equal((await post("md", revisaoCaseId, { phase: "reavaliacao", source: "nucleo", appliedOn: "2026-10-05", answers: partial })).status, 400);
    assert.equal((await post("md", revisaoCaseId, { phase: "reavaliacao", source: "nucleo", appliedOn: "2026-10-05", answers: { ...ok, "SNAP4-12": "demais" } })).status, 400);
    assert.equal((await post("md", revisaoCaseId, { phase: "reavaliacao", source: "nucleo", appliedOn: "2999-01-01", answers: ok })).status, 400);
    assert.equal((await post("md", revisaoCaseId, { phase: "reavaliacao", source: "nucleo", appliedOn: "2026-03-01", answers: ok })).status, 400);
    assert.equal((await post("reGL", revisaoCaseId, { phase: "reavaliacao", source: "escola", appliedOn: "2026-10-05", answers: ok })).status, 201);
    assert.equal((await post("reGL", abandonoCaseId, { phase: "reavaliacao", source: "escola", appliedOn: "2026-10-05", answers: ok })).status, 409, "sem medida inicial da escola");
    // outra escola / outro município não registram
    assert.equal((await post("reNova", revisaoCaseId, { phase: "inicial", source: "escola", appliedOn: "2026-03-12", answers: ok })).status, 404);
    assert.equal((await post("mdB", revisaoCaseId, { phase: "inicial", source: "nucleo", appliedOn: "2026-03-12", answers: ok })).status, 404);
    // professor não tem a capacidade
    assert.equal((await post("prof", revisaoCaseId, { phase: "inicial", source: "escola", appliedOn: "2026-03-12", answers: ok })).status, 403);
  });

  test("medida: a mais recente vale; as anteriores ficam; o banco não deixa alterar nem apagar", async () => {
    const post = (body: any) => call("POST", `/api/cases/${revisaoCaseId}/symptom-measurements`, "reGL", body);
    await post({ phase: "inicial", source: "escola", appliedOn: "2026-03-12", answers: allNine("demais") });
    const view = await call("GET", `/api/pilot/students/${(await db.select().from(shared.students).where((await import("drizzle-orm")).eq(shared.students.id, (await db.select().from(shared.cases).where((await import("drizzle-orm")).eq(shared.cases.id, revisaoCaseId)))[0].studentId)))[0].studentCode}/indicators`, "md");
    assert.equal(view.body.cases[0].estabilizacao.escola.inicial, 9, "vale a correção mais recente");
    const list = await call("GET", `/api/cases/${revisaoCaseId}/symptom-measurements`, "md");
    assert.ok(list.body.measurements.filter((m: any) => m.source === "escola" && m.phase === "inicial").length >= 2, "histórico preservado");

    const id = list.body.measurements[0].id;
    await assert.rejects(db.execute((await import("drizzle-orm")).sql`UPDATE symptom_measurements SET marked_count = 0 WHERE id = ${id}`), /somente inserção/);
    await assert.rejects(db.execute((await import("drizzle-orm")).sql`DELETE FROM symptom_measurements WHERE id = ${id}`), /somente inserção/);
  });

  test("medida: a trilha de auditoria registra quem gravou", async () => {
    const rows = await db.select().from(shared.auditLogs);
    assert.ok(rows.some((a) => a.action === "pilot.symptom_measure.recorded" && a.userEmail === "re@teste.local"));
  });

  test("a medida registrada alimenta o indicador 5 do grupo", async () => {
    const r = await call("GET", "/api/pilot/indicators", "municipal");
    const gl = r.body.bySchool.find((s: any) => s.schoolName === "Escola GL");
    // 1 caso da escola com medida (revisão médica não está entre os admitidos): o indicador usa só quem acessou o núcleo
    assert.equal(gl.estabilizacao.escola.comMedidaInicial.value, 0);
    assert.equal(gl.estabilizacao.nucleo.comMedidaInicial.value, 24);
  });
});
