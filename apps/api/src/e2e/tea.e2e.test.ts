/**
 * Triagem TEA ponta a ponta: 5 instrumentos, quem preenche cada um, trava depois do envio, escopo por caso/rede,
 * faixa de referência desligada por padrão e sumário organizado (regras + IA simulada com trava).
 * Requer TEST_DATABASE_URL (Postgres local de teste).
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { ABC_TEA_ITEMS } from "@periscopio/shared";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;
const PASS = "Senha-de-teste-123!";
const TODAY = new Date().toISOString().slice(0, 10);

describe("Triagem TEA (E2E)", { skip }, () => {
  let app: FastifyInstance;
  const cookies = {} as Record<string, string>;
  let caseId = "";
  let closedCaseId = "";
  let studentCode = "";
  let tenantA = "";
  const realFetch = globalThis.fetch;

  async function call(method: string, path: string, who: string, body?: unknown) {
    const headers: Record<string, string> = { origin: "http://localhost:3000", cookie: cookies[who] };
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
    delete process.env.BI_RAG_URL;

    const shared = await import("@periscopio/shared");
    const { db } = await import("../db/client");
    const { upsertCredential } = await import("../auth/credentials");
    const { buildApp } = await import("../app");

    const [tA] = await db.insert(shared.tenants).values({ name: "Município A", municipalityCode: "A" }).returning();
    const [tB] = await db.insert(shared.tenants).values({ name: "Município B", municipalityCode: "B" }).returning();
    tenantA = tA.id;
    const [sA] = await db.insert(shared.schools).values({ tenantId: tA.id, name: "Escola A1", slug: "escola-a1", status: "active" }).returning();
    const [sA2] = await db.insert(shared.schools).values({ tenantId: tA.id, name: "Escola A2", slug: "escola-a2", status: "active" }).returning();

    const people = [
      { key: "admin", role: "admin_platform", tenant: tA.id, school: null, specialty: null },
      { key: "re", role: "ppi", tenant: tA.id, school: sA.id, specialty: "psicopedagogia" },
      { key: "reOutra", role: "ppi", tenant: tA.id, school: sA2.id, specialty: "psicopedagogia" },
      { key: "md", role: "md1", tenant: tA.id, school: null, specialty: "medicina" },
      { key: "mdB", role: "md1", tenant: tB.id, school: null, specialty: "medicina" },
      { key: "fono", role: "specialist", tenant: tA.id, school: null, specialty: "fonoaudiologia" },
      { key: "fonoSem", role: "specialist", tenant: tA.id, school: null, specialty: "fonoaudiologia" },
      { key: "as", role: "specialist", tenant: tA.id, school: null, specialty: "servico_social" },
      { key: "psi", role: "specialist", tenant: tA.id, school: null, specialty: "psicologia" },
      { key: "dir", role: "school_manager", tenant: tA.id, school: sA.id, specialty: null },
    ];
    const ids: Record<string, string> = {};
    for (const p of people) {
      const email = `${p.key.toLowerCase()}@teste.local`;
      const [u] = await db.insert(shared.users).values({ tenantId: p.tenant, schoolId: p.school, email, name: p.key, role: p.role, specialty: p.specialty, accessEnabled: true }).returning();
      ids[p.key] = u.id;
      await upsertCredential({ email, name: p.key, password: PASS });
    }

    const mk = async (state: string) => {
      const code = `T-TEA-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      const [st] = await db.insert(shared.students).values({ tenantId: tA.id, schoolId: sA.id, studentCode: code, birthYear: 2019, birthMonth: 3, ageBracket: "03-05" }).returning();
      const [c] = await db.insert(shared.cases).values({ tenantId: tA.id, studentId: st.id, status: "triagem", journeyState: state }).returning();
      return { id: c.id, code };
    };
    const c1 = await mk("delegado");
    caseId = c1.id; studentCode = c1.code;
    closedCaseId = (await mk("encerrado")).id;
    for (const [who, spec] of [["fono", "fonoaudiologia"], ["as", "servico_social"], ["psi", "psicologia"]] as const) {
      await db.insert(shared.caseSummaries).values({ tenantId: tA.id, schoolId: sA.id, caseId, specialty: spec, assignedProfessionalId: ids[who], status: "pendente" });
    }

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
    globalThis.fetch = realFetch;
    delete process.env.BI_RAG_URL;
    await app?.close();
    const { db } = await import("../db/client");
    await (db as any).$client.end();
  });

  const ataAnswers = { marcados: { "1": [0, 2], "6": [0], "16": [3] }, antes36meses: true };
  const allItems = (n: number, v: unknown) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), v]));

  test("catálogo: quem preenche ou lê algum instrumento recebe os 5; diretor não", async () => {
    for (const who of ["re", "md", "fono", "as", "psi"]) {
      const r = await call("GET", "/api/tea/catalog", who);
      assert.equal(r.status, 200, who);
      assert.equal(r.body.instruments.length, 5);
      assert.equal(r.body.content.srs2.items.length, 65);
      assert.equal(r.body.content.abc.items.length, 57);
      assert.equal(r.body.content.abc.items[0].weight, undefined, "o peso não vai para o navegador");
    }
    assert.equal((await call("GET", "/api/tea/catalog", "dir")).status, 403);
  });

  test("RE: vê e preenche só a ATA; valida; exige respondente e data para enviar; depois de enviada, trava", async () => {
    const view = await call("GET", `/api/cases/${caseId}/tea`, "re");
    assert.equal(view.status, 200);
    assert.deepEqual(view.body.instruments.map((i: any) => i.code), ["ata"]);

    assert.equal((await call("PUT", `/api/cases/${caseId}/tea/ata`, "re", { answers: { marcados: { "99": [0] }, antes36meses: null } })).status, 400);
    assert.equal((await call("PUT", `/api/cases/${caseId}/tea/asq`, "re", { answers: { items: {} } })).status, 403, "RE não preenche o ASQ");

    const saved = await call("PUT", `/api/cases/${caseId}/tea/ata`, "re", { answers: ataAnswers });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.screening.status, "rascunho");
    assert.equal(saved.body.screening.score.total, 2 + 1 + 1 + 1 /* g1 com 2 marcas = 2; g6 = 1; g16 = 1; +1 por início antes dos 36 meses */);
    assert.equal(saved.body.screening.score.reference, undefined, "faixa de referência desligada por padrão");

    const early = await call("POST", `/api/cases/${caseId}/tea/ata/submit`, "re");
    assert.equal(early.status, 422);
    assert.match(early.body.error, /quem respondeu/);

    assert.equal((await call("PUT", `/api/cases/${caseId}/tea/ata`, "re", { answers: ataAnswers, respondent: "mae_pai", appliedOn: "2999-01-01" })).status, 400, "data futura");
    assert.equal((await call("PUT", `/api/cases/${caseId}/tea/ata`, "re", { answers: ataAnswers, respondent: "mae_pai", appliedOn: TODAY })).status, 200);
    const sent = await call("POST", `/api/cases/${caseId}/tea/ata/submit`, "re");
    assert.equal(sent.status, 200);
    assert.equal(sent.body.screening.status, "enviado");

    assert.equal((await call("PUT", `/api/cases/${caseId}/tea/ata`, "re", { answers: { marcados: {}, antes36meses: null } })).status, 409);
    assert.equal((await call("POST", `/api/cases/${caseId}/tea/ata/submit`, "re")).status, 409);

    // a trava vale também no banco, mesmo por fora da API
    const { db } = await import("../db/client");
    const { sql } = await import("drizzle-orm");
    await assert.rejects(() => db.execute(sql`UPDATE tea_screenings SET answers = '{"marcados":{},"antes36meses":null}'::jsonb WHERE case_id = ${caseId} AND instrument = 'ata'`), /não podem ser alteradas|já enviada/);
  });

  test("escopo: RE de outra escola, médico de outra rede e diretor não entram", async () => {
    assert.equal((await call("GET", `/api/cases/${caseId}/tea`, "reOutra")).status, 404);
    assert.equal((await call("GET", `/api/cases/${caseId}/tea`, "mdB")).status, 404);
    assert.equal((await call("GET", `/api/cases/${caseId}/tea`, "dir")).status, 403, "gestão não lê respostas clínicas");
  });

  test("médico: preenche o ASQ (com a regra da pergunta 1) e lê o que os outros enviaram", async () => {
    const sim = allItems(40, "sim");
    const nonverbal = await call("PUT", `/api/cases/${caseId}/tea/asq`, "md", { answers: { items: { ...sim, "1": "nao" } }, respondent: "mae_pai", appliedOn: TODAY });
    assert.equal(nonverbal.status, 200);
    assert.equal(nonverbal.body.screening.score.max, 32);
    const verbal = await call("PUT", `/api/cases/${caseId}/tea/asq`, "md", { answers: { items: sim }, respondent: "mae_pai", appliedOn: TODAY });
    assert.equal(verbal.body.screening.score.total, 15);
    assert.equal(verbal.body.screening.score.max, 39);
    assert.equal((await call("POST", `/api/cases/${caseId}/tea/asq/submit`, "md")).status, 200);

    const view = await call("GET", `/api/cases/${caseId}/tea`, "md");
    assert.equal(view.body.instruments.length, 5, "médico lê os 5");
    const ata = view.body.instruments.find((i: any) => i.code === "ata");
    assert.equal(ata.canFill, false);
    assert.equal(ata.screening.status, "enviado");
    assert.ok(ata.screening.score.total > 0);
    assert.equal(ata.screening.score.reference, undefined);
  });

  test("especialistas: cada um só o seu instrumento; sem delegação não entra", async () => {
    // Fonoaudiologia → SRS-2
    const srs = { answers: { items: allItems(65, 2) }, respondent: "professor", appliedOn: TODAY };
    assert.equal((await call("PUT", `/api/cases/${caseId}/tea/srs2`, "fono", srs)).status, 200);
    const s = await call("POST", `/api/cases/${caseId}/tea/srs2/submit`, "fono");
    assert.equal(s.status, 200);
    assert.equal(s.body.screening.score.total, null, "SRS-2 não soma sem as tabelas da editora");
    assert.equal((await call("PUT", `/api/cases/${caseId}/tea/abc`, "fono", { answers: { items: {} } })).status, 403);
    assert.equal((await call("GET", `/api/cases/${caseId}/tea`, "fonoSem")).status, 403, "sem seção atribuída");

    // Assistente social → M-CHAT (incompleto não envia)
    assert.equal((await call("PUT", `/api/cases/${caseId}/tea/mchat`, "as", { answers: { items: allItems(10, "sim") }, respondent: "mae_pai", appliedOn: TODAY })).status, 200);
    const inc = await call("POST", `/api/cases/${caseId}/tea/mchat/submit`, "as");
    assert.equal(inc.status, 422);
    assert.match(inc.body.error, /13 resposta/);
    assert.equal((await call("PUT", `/api/cases/${caseId}/tea/mchat`, "as", { answers: { items: allItems(23, "sim") }, respondent: "mae_pai", appliedOn: TODAY })).status, 200);
    const m = await call("POST", `/api/cases/${caseId}/tea/mchat/submit`, "as");
    assert.equal(m.status, 200);
    assert.equal(m.body.screening.score.total, null, "M-CHAT não calcula risco");

    // Psicologia → ABC
    const abcItems = { "1": true, "2": true, "3": true, "4": false };
    const abc = await call("PUT", `/api/cases/${caseId}/tea/abc`, "psi", { answers: { items: abcItems }, respondent: "professor", appliedOn: TODAY });
    assert.equal(abc.status, 200);
    const w = (n: number) => ABC_TEA_ITEMS.find((i) => i.n === n)!.weight;
    assert.equal(abc.body.screening.score.total, w(1) + w(2) + w(3), "soma dos pesos dos itens 1 a 3 do formulário");
    assert.equal((await call("POST", `/api/cases/${caseId}/tea/abc/submit`, "psi")).status, 200);

    const psiView = await call("GET", `/api/cases/${caseId}/tea`, "psi");
    assert.deepEqual(psiView.body.instruments.map((i: any) => i.code), ["abc"], "psicólogo não lê as respostas dos outros");
  });

  test("faixa de referência só aparece quando o Admin Master liga a caixinha", async () => {
    const off = await call("GET", `/api/cases/${caseId}/tea`, "md");
    assert.ok(off.body.instruments.every((i: any) => !i.screening || i.screening.score?.reference === undefined));

    const put = await call("PUT", "/api/admin/privileges/roles", "admin", {
      changes: [{ scope: tenantA, role: "md1", capability: "tea.reference.view", allowed: true }],
    });
    assert.equal(put.status, 409, "dado sensível pede confirmação");
    assert.equal((await call("PUT", "/api/admin/privileges/roles", "admin", {
      changes: [{ scope: tenantA, role: "md1", capability: "tea.reference.view", allowed: true }], confirmSensitive: true,
    })).status, 200);
    const on = await call("GET", `/api/cases/${caseId}/tea`, "md");
    const ata = on.body.instruments.find((i: any) => i.code === "ata");
    assert.ok(ata.screening.score.reference.notes.length > 0);
    assert.equal(typeof ata.screening.score.reference.reached[0].value, "boolean");
    const abc = on.body.instruments.find((i: any) => i.code === "abc");
    assert.equal(abc.screening.score.reference.reached, undefined, "ABC: o sistema não aplica nenhum dos dois cortes");

    await call("PUT", "/api/admin/privileges/roles", "admin", { changes: [{ scope: tenantA, role: "md1", capability: "tea.reference.view", allowed: null }] });
    const back = await call("GET", `/api/cases/${caseId}/tea`, "md");
    assert.equal(back.body.instruments.find((i: any) => i.code === "ata").screening.score.reference, undefined);
  });

  test("sumário: por regras, sem identificação, e respeitando o que cada pessoa pode ler", async () => {
    const md = await call("POST", `/api/cases/${caseId}/tea/summary`, "md");
    assert.equal(md.status, 200);
    assert.equal(md.body.source, "regras");
    assert.equal(md.body.instruments.length, 5);
    assert.ok(md.body.notice.includes("Não é diagnóstico"));
    assert.ok(JSON.stringify(md.body.summary).includes("Não sorri"), "traz o comportamento marcado na ATA");
    assert.ok(!md.raw.includes(studentCode), "sem código do aluno");

    const re = await call("POST", `/api/cases/${caseId}/tea/summary`, "re");
    assert.equal(re.status, 200);
    assert.deepEqual(re.body.instruments, ["ata"], "o RE só resume o que ele pode ler");

    assert.equal((await call("POST", `/api/cases/${caseId}/tea/summary`, "fono")).status, 403, "especialista não tem a caixinha de IA por padrão");
  });

  test("sumário com assistente: aceita saída válida; recusa diagnóstico, número inventado e formato torto", async () => {
    process.env.BI_RAG_URL = "http://rag.test";
    process.env.BI_RAG_TOKEN = "t";
    let reply: unknown = null;
    let sent: any = null;
    globalThis.fetch = (async (input: any, init?: any) => {
      if (String(input).startsWith("http://rag.test")) {
        sent = JSON.parse(init.body);
        return new Response(JSON.stringify({ summary: reply, source: "llm" }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return realFetch(input, init);
    }) as typeof fetch;

    try {
      const good = { visao_geral: "Foram enviados 4 instrumentos.", por_instrumento: [{ instrumento: "ata", pontos: ["Foi marcado: Não sorri."] }], lacunas: [], perguntas_ao_profissional: ["Os comportamentos são coerentes com a consulta?"] };
      reply = good;
      const ok = await call("POST", `/api/cases/${caseId}/tea/summary`, "md");
      assert.equal(ok.body.source, "ia");
      assert.equal(ok.body.summary.visaoGeral, good.visao_geral);
      assert.ok(ok.body.summary.lacunas.length > 0, "lacunas calculadas pelas regras nunca somem");
      assert.ok(!JSON.stringify(sent).includes(studentCode), "o assistente não recebe o código do aluno");
      assert.ok(!("studentCode" in sent.digest));

      for (const bad of [
        { ...good, visao_geral: "Há diagnóstico de autismo confirmado." },
        { ...good, visao_geral: "A criança tem autismo." },
        { ...good, visao_geral: "Alta probabilidade com 99 pontos." },
        { ...good, perguntas_ao_profissional: ["Recomendamos iniciar tratamento."] },
        { visao_geral: 42 },
        "texto solto",
      ]) {
        reply = bad;
        const r = await call("POST", `/api/cases/${caseId}/tea/summary`, "md");
        assert.equal(r.status, 200);
        assert.equal(r.body.source, "regras", JSON.stringify(bad).slice(0, 60));
      }
    } finally {
      globalThis.fetch = realFetch;
      delete process.env.BI_RAG_URL;
    }
  });

  test("caixinha desligada bloqueia o preenchimento; caso encerrado trava tudo", async () => {
    await call("PUT", "/api/admin/privileges/roles", "admin", { changes: [{ scope: tenantA, role: "ppi", capability: "tea.ata.fill", allowed: false }] });
    const { db } = await import("../db/client");
    const shared = await import("@periscopio/shared");
    const { eq, and } = await import("drizzle-orm");
    await db.delete(shared.teaScreenings).where(and(eq(shared.teaScreenings.caseId, caseId), eq(shared.teaScreenings.instrument, "ata"))).catch(() => undefined);
    assert.equal((await call("PUT", `/api/cases/${caseId}/tea/ata`, "re", { answers: { marcados: {}, antes36meses: null } })).status, 403);
    assert.equal((await call("GET", "/api/tea/catalog", "re")).status, 403, "sem nenhuma caixinha TEA, o RE nem recebe o catálogo");
    await call("PUT", "/api/admin/privileges/roles", "admin", { changes: [{ scope: tenantA, role: "ppi", capability: "tea.ata.fill", allowed: null }] });

    const closed = await call("PUT", `/api/cases/${closedCaseId}/tea/asq`, "md", { answers: { items: { "1": "sim" } } });
    assert.equal(closed.status, 403);
    assert.match(closed.body.error, /encerrado/);
  });

  test("envios ficam na linha do tempo do caso e na auditoria", async () => {
    const { db } = await import("../db/client");
    const shared = await import("@periscopio/shared");
    const { eq, and } = await import("drizzle-orm");
    const tl = await db.select().from(shared.caseTimeline).where(and(eq(shared.caseTimeline.caseId, caseId), eq(shared.caseTimeline.event, "tea:submitted")));
    assert.ok(tl.length >= 4);
    const logs = await db.select({ action: shared.auditLogs.action }).from(shared.auditLogs);
    const actions = logs.map((l) => l.action);
    assert.ok(actions.includes("tea.submit") && actions.includes("tea.read") && actions.includes("tea.ai_summary"));
  });
});
