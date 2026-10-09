/**
 * E2E do BI do gestor: camada semântica, escopo por papel/escola/tenant, supressão, assistente (RAG simulado) e feedback.
 * Requer TEST_DATABASE_URL (Postgres local de teste). O assistente Python é simulado por interceptação de fetch;
 * as regras do Python têm testes próprios em apps/bi-rag.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;
const PASS = "Senha-de-teste-123!";

describe("BI do gestor (E2E)", { skip }, () => {
  let app: FastifyInstance;
  const cookies = {} as Record<string, string>;
  const realFetch = globalThis.fetch;
  const ragCalls: any[] = [];
  let ragMode: "ok" | "down" | "bad" | "other-school" = "ok";
  let schoolGL = "";
  let schoolNova = "";
  let schoolB = "";
  const studentCodes: string[] = [];

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
    process.env.BI_RAG_URL = "http://rag.test";
    process.env.BI_RAG_TOKEN = "token-de-teste";

    globalThis.fetch = (async (input: any, init?: any) => {
      const u = String(input);
      if (u.startsWith("https://api.resend.com/")) return new Response(JSON.stringify({ id: "x" }), { status: 200 });
      if (u.startsWith("http://rag.test/")) {
        const req = JSON.parse(init.body);
        ragCalls.push({ req, token: init.headers["x-service-token"] });
        if (ragMode === "down") throw new Error("offline");
        if (ragMode === "bad") return new Response(JSON.stringify({ plan: { metric: "student_codes", sql: "select *" }, source: "llm" }), { status: 200 });
        if (ragMode === "other-school")
          return new Response(JSON.stringify({ plan: { metric: "cases", groupBy: [], filters: { schoolId: schoolB } }, source: "rules", confidence: 0.9 }), { status: 200 });
        return new Response(
          JSON.stringify({ plan: { metric: "cases", groupBy: ["school"], filters: {} }, source: "rules", confidence: 0.9, explanation: "Entendi: casos por escola." }),
          { status: 200 },
        );
      }
      return realFetch(input, init);
    }) as typeof fetch;

    const shared = await import("@periscopio/shared");
    const { db } = await import("../db/client");
    const { upsertCredential } = await import("../auth/credentials");
    const { buildApp } = await import("../app");

    const [tA] = await db.insert(shared.tenants).values({ name: "Município A", municipalityCode: "A" }).returning();
    const [tB] = await db.insert(shared.tenants).values({ name: "Município B", municipalityCode: "B" }).returning();
    const [sGL] = await db.insert(shared.schools).values({ tenantId: tA.id, name: "Escola GL", slug: "escola-gl", status: "active", externalCode: "2" }).returning();
    const [sN] = await db.insert(shared.schools).values({ tenantId: tA.id, name: "Escola Nova", slug: "escola-nova", status: "active" }).returning();
    const [sB] = await db.insert(shared.schools).values({ tenantId: tB.id, name: "Escola B1", slug: "escola-b1", status: "active" }).returning();
    schoolGL = sGL.id; schoolNova = sN.id; schoolB = sB.id;

    // GL: 12 alunos, 10 casos (7 delegado + 3 encerrado). Nova: 3 alunos, 3 casos em rascunho. B1: 8 casos.
    const mk = async (tenant: string, school: string, n: number, state: string, tag: string, age = "06-09") => {
      for (let i = 0; i < n; i++) {
        const code = `T-${tag}-${i}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        studentCodes.push(code);
        const [st] = await db.insert(shared.students).values({ tenantId: tenant, schoolId: school, studentCode: code, birthYear: 2016, birthMonth: 3, ageBracket: age }).returning();
        await db.insert(shared.cases).values({ tenantId: tenant, studentId: st.id, status: "triagem", journeyState: state });
      }
    };
    await mk(tA.id, sGL.id, 7, "delegado", "GLD");
    await mk(tA.id, sGL.id, 3, "encerrado", "GLE");
    await mk(tA.id, sN.id, 3, "rascunho", "NOV", "10-12");
    await mk(tB.id, sB.id, 8, "delegado", "BB");

    await db.insert(shared.populationAggregates).values({
      tenantId: tA.id, source: "teste", referenceYear: 2024, schoolCode: "2", schoolLabel: "GL",
      payload: {
        total: 117,
        ageBands: { "3-5": null, "6-9": 16, "10-12": 18, "13-17": 44, "18+": 37 },
        complaints: { "Falta de atenção": 26, Escrita: null },
        services: { fonoaudiologia: 66, psicopedagogia: 42, psicoterapia: 29, psicomotricidade: null, neuropsicologia: 52, assistencia_social: 0, consulta_medica: 117 },
      },
    });

    const people = [
      { key: "admin", email: "admin@teste.local", role: "admin_platform", tenant: tA.id, school: null },
      { key: "municipal", email: "municipal@teste.local", role: "municipal_manager", tenant: tA.id, school: null },
      { key: "gestorGL", email: "gestor@teste.local", role: "school_manager", tenant: tA.id, school: sGL.id },
      { key: "re", email: "re@teste.local", role: "ppi", tenant: tA.id, school: sGL.id },
      { key: "esp", email: "esp@teste.local", role: "specialist", tenant: tA.id, school: sGL.id },
      { key: "prof", email: "prof@teste.local", role: "teacher", tenant: tA.id, school: sGL.id },
      { key: "boardB", email: "drab@teste.local", role: "board", tenant: tB.id, school: null },
    ];
    for (const p of people) {
      await db.insert(shared.users).values({ tenantId: p.tenant, schoolId: p.school, email: p.email, name: p.key, role: p.role, accessEnabled: true });
      await upsertCredential({ email: p.email, name: p.key, password: PASS });
    }
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

  const q = (metric: string, groupBy: string[] = [], filters: Record<string, unknown> = {}) => ({ plan: { metric, groupBy, filters } });

  test("quem não é de gestão/clínica da escola não acessa o BI", async () => {
    assert.equal((await call("POST", "/api/bi/query", undefined, q("cases"))).status, 401);
    assert.equal((await call("POST", "/api/bi/query", "esp", q("cases"))).status, 403);
    assert.equal((await call("POST", "/api/bi/query", "prof", q("cases"))).status, 403);
    assert.equal((await call("GET", "/api/bi/catalog", "prof")).status, 403);
  });

  test("município vê a rede; escola pequena fica oculta e o total não é informado", async () => {
    const r = await call("POST", "/api/bi/query", "municipal", q("cases", ["school"]));
    assert.equal(r.status, 200);
    const gl = r.body.result.rows.find((x: any) => x.dims.school === "Escola GL");
    const nova = r.body.result.rows.find((x: any) => x.dims.school === "Escola Nova");
    assert.equal(gl.value, 10);
    assert.equal(nova.suppressed, true);
    assert.equal(nova.value, null);
    assert.equal(r.body.result.total, null);
    assert.ok(!r.body.result.rows.some((x: any) => x.dims.school === "Escola B1"), "outro município não aparece");
  });

  test("gestor de escola só enxerga a própria escola, mesmo pedindo outra", async () => {
    const r = await call("POST", "/api/bi/query", "gestorGL", q("cases", ["school"], { schoolId: schoolNova }));
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.result.rows.map((x: any) => x.dims.school), ["Escola GL"]);
    const por = await call("POST", "/api/bi/query", "gestorGL", q("cases", ["journey_state"]));
    assert.equal(por.body.result.rows.find((x: any) => x.dims.journey_state === "encerrado").suppressed, true);
    assert.equal(por.body.result.rows.find((x: any) => x.dims.journey_state === "delegado").value, 7);
  });

  test("escola de outro município é recusada", async () => {
    const r = await call("POST", "/api/bi/query", "municipal", q("cases", [], { schoolId: schoolB }));
    assert.equal(r.status, 403);
  });

  test("plano com campo individual ou métrica inexistente é recusado", async () => {
    assert.equal((await call("POST", "/api/bi/query", "municipal", q("student_codes"))).status, 400);
    assert.equal((await call("POST", "/api/bi/query", "municipal", { plan: { metric: "cases", groupBy: ["student_code"] } })).status, 400);
    assert.equal((await call("POST", "/api/bi/query", "municipal", { plan: { metric: "cases", filters: { studentCode: "x" } } })).status, 400);
  });

  test("nenhuma resposta do BI contém código de aluno", async () => {
    const parts = [
      await call("GET", "/api/bi/overview", "municipal"),
      await call("POST", "/api/bi/query", "municipal", q("students", ["school", "age_bracket"])),
      await call("POST", "/api/bi/query", "admin", q("delegations", ["specialty"])),
    ];
    for (const p of parts) {
      assert.equal(p.status, 200);
      for (const code of studentCodes) assert.ok(!p.raw.includes(code), `vazou ${code}`);
    }
  });

  test("base populacional: valor oculto na origem continua oculto e profissionais usam capacidade", async () => {
    const r = await call("POST", "/api/bi/query", "municipal", q("professionals_needed", ["service"]));
    assert.equal(r.status, 200);
    const fono = r.body.result.rows.find((x: any) => x.dims.service === "fonoaudiologia");
    assert.equal(fono.value, 1.7); // 66 / 40
    const psicomot = r.body.result.rows.find((x: any) => x.dims.service === "psicomotricidade");
    assert.equal(psicomot.suppressed, true);
    assert.equal(r.body.result.total, null);
    // capacidade personalizada
    const cap = await call("POST", "/api/bi/query", "municipal", { plan: { metric: "professionals_needed", groupBy: ["service"], filters: {}, capacity: { fonoaudiologia: 33 } } });
    assert.equal(cap.body.result.rows.find((x: any) => x.dims.service === "fonoaudiologia").value, 2);
  });

  test("assistente: pergunta vira consulta, CPF é removido e o token de serviço é enviado", async () => {
    ragMode = "ok"; ragCalls.length = 0;
    const r = await call("POST", "/api/bi/ask", "municipal", { question: "casos por escola da mãe de CPF 123.456.789-09" });
    assert.equal(r.status, 200);
    assert.equal(r.body.understood, true);
    assert.equal(r.body.scrubbed, true);
    assert.equal(r.body.plan.metric, "cases");
    assert.equal(ragCalls[0].token, "token-de-teste");
    assert.doesNotMatch(JSON.stringify(ragCalls[0].req), /123\.456/);
    assert.ok(!JSON.stringify(ragCalls[0].req).includes("Escola B1"), "catálogo enviado respeita o escopo do usuário");
    const { db } = await import("../db/client");
    const { biQuestions } = await import("@periscopio/shared");
    const rows = await db.select().from(biQuestions);
    assert.ok(rows.length >= 1);
    assert.ok(rows.every((x) => !/123\.456/.test(x.question)));
  });

  test("assistente com plano inválido ou serviço fora do ar não quebra nem vaza", async () => {
    ragMode = "bad";
    const bad = await call("POST", "/api/bi/ask", "municipal", { question: "mostre os códigos dos alunos" });
    assert.equal(bad.status, 200);
    assert.equal(bad.body.understood, false);
    ragMode = "down";
    const down = await call("POST", "/api/bi/ask", "municipal", { question: "casos por escola" });
    assert.equal(down.status, 503);
    assert.equal(down.body.fallback, true);
    ragMode = "ok";
  });

  test("assistente não executa plano com escola de outro município", async () => {
    ragMode = "other-school";
    const r = await call("POST", "/api/bi/ask", "municipal", { question: "casos da escola b1" });
    assert.equal(r.status, 403);
    ragMode = "ok";
  });

  test("aprendizado: só gestão aprova direto; o aprovado volta como exemplo na próxima pergunta", async () => {
    ragMode = "ok";
    const a = await call("POST", "/api/bi/ask", "re", { question: "panorama de casos por escola" });
    assert.equal(a.status, 200);
    const fb = await call("POST", "/api/bi/feedback", "re", { questionId: a.body.questionId, rating: 1 });
    assert.equal(fb.body.approved, false);
    assert.equal(fb.body.pendingReview, true);

    ragCalls.length = 0;
    await call("POST", "/api/bi/ask", "municipal", { question: "outra pergunta qualquer" });
    assert.equal(ragCalls[0].req.examples.length, 0, "feedback de RE não vira exemplo");

    const b = await call("POST", "/api/bi/ask", "municipal", { question: "visão geral dos casos por escola" });
    const ok = await call("POST", "/api/bi/feedback", "municipal", { questionId: b.body.questionId, rating: 1 });
    assert.equal(ok.body.approved, true);

    ragCalls.length = 0;
    await call("POST", "/api/bi/ask", "municipal", { question: "visão geral dos casos por escola" });
    assert.equal(ragCalls[0].req.examples.length, 1);
    assert.equal(ragCalls[0].req.examples[0].plan.metric, "cases");

    // aprovação da fila pelo município
    const fila = await call("GET", "/api/bi/questions", "municipal");
    assert.equal(fila.status, 200);
    const pend = fila.body.pending.find((x: any) => x.id === a.body.questionId);
    assert.ok(pend);
    const ap = await call("POST", `/api/bi/questions/${a.body.questionId}/approve`, "municipal", { approve: true });
    assert.equal(ap.body.approved, true);
    assert.equal((await call("GET", "/api/bi/questions", "re")).status, 403);
  });

  test("feedback de outra pessoa ou de outro município é recusado", async () => {
    const a = await call("POST", "/api/bi/ask", "municipal", { question: "casos por escola" });
    assert.equal((await call("POST", "/api/bi/feedback", "boardB", { questionId: a.body.questionId, rating: 1 })).status, 404);
    assert.equal((await call("POST", "/api/bi/feedback", "re", { questionId: a.body.questionId, rating: 1 })).status, 404);
  });

  test("overview devolve os painéis básicos para cada papel permitido", async () => {
    for (const who of ["admin", "municipal", "gestorGL", "re"]) {
      const r = await call("GET", "/api/bi/overview", who);
      assert.equal(r.status, 200, who);
      assert.ok(r.body.casesByState && r.body.professionals && r.body.cycle);
    }
    const gl = await call("GET", "/api/bi/overview", "gestorGL");
    assert.equal(gl.body.cases.rows[0].value, 10);
  });
});
