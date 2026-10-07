/**
 * E2E da agenda do Board de experts. Requer TEST_DATABASE_URL (Postgres local de teste).
 * O fetch para api.resend.com é interceptado: nenhum e-mail real é enviado.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;
const PASS = "Senha-de-teste-123!";

describe("agenda do Board (E2E)", { skip }, () => {
  let app: FastifyInstance;
  const cookies = {} as Record<string, string>;
  const sent: any[] = [];
  const realFetch = globalThis.fetch;
  const slotIds: string[] = [];

  async function call(method: string, path: string, who?: string, body?: unknown) {
    const headers: Record<string, string> = { origin: "http://localhost:3000" };
    if (who) headers.cookie = cookies[who];
    if (body !== undefined) headers["content-type"] = "application/json";
    const r = await app.inject({ method: method as any, url: path, headers, payload: body === undefined ? undefined : JSON.stringify(body) });
    let parsed: any = null;
    try { parsed = r.json(); } catch { parsed = r.body; }
    return { status: r.statusCode, body: parsed };
  }
  const future = (days: number, hour: number) => {
    const d = new Date(Date.now() + days * 86400000);
    d.setUTCHours(hour, 0, 0, 0);
    return d;
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
    process.env.RESEND_API_KEY = "re_teste";
    process.env.EXPERT_MEET_URL = "https://meet.google.com/abc-defg-hij";
    delete process.env.EXPERT_BOARD_EMAIL;

    globalThis.fetch = (async (input: any, init?: any) => {
      if (String(input).startsWith("https://api.resend.com/")) {
        sent.push(JSON.parse(init.body));
        return new Response(JSON.stringify({ id: "email_fake" }), { status: 200 });
      }
      return realFetch(input, init);
    }) as typeof fetch;

    const shared = await import("@periscopio/shared");
    const { db } = await import("../db/client");
    const { upsertCredential } = await import("../auth/credentials");
    const { buildApp } = await import("../app");

    const [tA] = await db.insert(shared.tenants).values({ name: "Município A", municipalityCode: "A" }).returning();
    const [tB] = await db.insert(shared.tenants).values({ name: "Município B", municipalityCode: "B" }).returning();
    const [sA] = await db.insert(shared.schools).values({ tenantId: tA.id, name: "Escola A1", slug: "escola-a1", status: "active" }).returning();
    const people = [
      { key: "gestor", email: "gestor@teste.local", role: "school_manager", tenant: tA.id, school: sA.id },
      { key: "re", email: "re@teste.local", role: "ppi", tenant: tA.id, school: sA.id },
      { key: "board", email: "dra@teste.local", role: "board", tenant: tA.id, school: null },
      { key: "esp", email: "esp@teste.local", role: "specialist", tenant: tA.id, school: sA.id },
      { key: "boardB", email: "drab@teste.local", role: "board", tenant: tB.id, school: null },
    ];
    for (const p of people) {
      await db.insert(shared.users).values({
        tenantId: p.tenant, schoolId: p.school, email: p.email, name: p.key, role: p.role, accessEnabled: true,
      });
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
    const { db } = await import("../db/client");
    await (db as any).$client.end();
  });

  test("só a Dra. (board) cria horários; passado é recusado", async () => {
    const s1 = future(2, 13), s2 = future(3, 13);
    const body = (s: Date) => ({ startsAt: s.toISOString(), endsAt: new Date(s.getTime() + 3600000).toISOString() });
    assert.equal((await call("POST", "/api/expert-meetings/slots", "re", body(s1))).status, 403);
    for (const s of [s1, s2]) {
      const r = await call("POST", "/api/expert-meetings/slots", "board", body(s));
      assert.equal(r.status, 201, JSON.stringify(r.body));
      slotIds.push(r.body.slot.id);
    }
    assert.equal((await call("POST", "/api/expert-meetings/slots", "board", body(s1))).status, 409);
    const past = new Date(Date.now() - 86400000);
    assert.equal((await call("POST", "/api/expert-meetings/slots", "board", body(past))).status, 400);
  });

  test("escola vê só horários livres; outro tenant não vê nada", async () => {
    const r = await call("GET", "/api/expert-meetings/slots", "re");
    assert.equal(r.status, 200);
    assert.equal(r.body.slots.length, 2);
    assert.equal("status" in r.body.slots[0], false);
    assert.equal((await call("GET", "/api/expert-meetings/slots", "boardB")).body.slots.length, 0);
    assert.equal((await call("GET", "/api/expert-meetings/slots", "esp")).status, 403);
  });

  test("pedido com dado pessoal é recusado", async () => {
    const r = await call("POST", "/api/expert-meetings", "re", {
      slotId: slotIds[0], professionalName: "Ana RE", topic: "Aluno com CPF 123.456.789-09 precisa de discussão",
    });
    assert.equal(r.status, 400);
  });

  let meetingId = "";
  test("pedido reserva o horário e avisa a equipe pelo template", async () => {
    sent.length = 0;
    const r = await call("POST", "/api/expert-meetings", "re", {
      slotId: slotIds[0], professionalName: "Ana <b>RE</b>", topic: "Dúvida sobre conduta no caso ESCO-2026-A1", studentCode: "ESCO-2026-A1",
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.emailSent, true);
    meetingId = r.body.meeting.id;
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, "equipe@projetoperiscopio.com.br");
    assert.equal(sent[0].template.id, "expert-meeting-request");
    assert.equal(sent[0].template.variables.PROFESSIONAL_NAME, "Ana &lt;b&gt;RE&lt;/b&gt;");
    assert.equal(sent[0].template.variables.SCHOOL_NAME, "Escola A1");
  });

  test("mesmo horário não pode ser reservado duas vezes", async () => {
    const r = await call("POST", "/api/expert-meetings", "gestor", {
      slotId: slotIds[0], professionalName: "Outro Profissional", topic: "Outro assunto qualquer sobre o caso",
    });
    assert.equal(r.status, 409);
    const free = await call("GET", "/api/expert-meetings/slots", "re");
    assert.equal(free.body.slots.length, 1);
  });

  test("solicitante vê só os seus pedidos; board vê todos", async () => {
    assert.equal((await call("GET", "/api/expert-meetings", "re")).body.meetings.length, 1);
    assert.equal((await call("GET", "/api/expert-meetings", "gestor")).body.meetings.length, 0);
    assert.equal((await call("GET", "/api/expert-meetings", "board")).body.meetings.length, 1);
    assert.equal((await call("GET", "/api/expert-meetings", "boardB")).body.meetings.length, 0);
  });

  test("outro tenant e escola não confirmam; Dra. confirma e quem pediu recebe o Meet fixo", async () => {
    assert.equal((await call("PATCH", `/api/expert-meetings/${meetingId}/confirm`, "re")).status, 403);
    assert.equal((await call("PATCH", `/api/expert-meetings/${meetingId}/confirm`, "boardB")).status, 409);
    sent.length = 0;
    const r = await call("PATCH", `/api/expert-meetings/${meetingId}/confirm`, "board", {});
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.meeting.status, "confirmed");
    assert.equal(r.body.meeting.meetUrl, "https://meet.google.com/abc-defg-hij");
    assert.deepEqual(sent.map((s) => s.to).sort(), ["equipe@projetoperiscopio.com.br", "re@teste.local"]);
    assert.ok(sent.every((s) => s.template.id === "expert-meeting-confirmed"));
    assert.equal(sent[0].template.variables.MEET_URL, "https://meet.google.com/abc-defg-hij");
    assert.equal((await call("PATCH", `/api/expert-meetings/${meetingId}/confirm`, "board", {})).status, 409);
  });

  test("recusa libera o horário e avisa o solicitante", async () => {
    const p = await call("POST", "/api/expert-meetings", "re", {
      slotId: slotIds[1], professionalName: "Ana RE", topic: "Segundo assunto sobre o caso ESCO-2026-A1",
    });
    assert.equal(p.status, 201);
    sent.length = 0;
    const d = await call("PATCH", `/api/expert-meetings/${p.body.meeting.id}/decline`, "board", { note: "Sem agenda nesse dia" });
    assert.equal(d.status, 200);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, "re@teste.local");
    assert.equal(sent[0].template.id, "expert-meeting-declined");
    assert.equal(sent[0].template.variables.NOTE, "Sem agenda nesse dia");
    const free = await call("GET", "/api/expert-meetings/slots", "re");
    assert.equal(free.body.slots.length, 1);
  });

  test("falha do Resend não derruba o pedido", async () => {
    globalThis.fetch = (async (input: any, init?: any) =>
      String(input).startsWith("https://api.resend.com/")
        ? new Response(JSON.stringify({ message: "boom" }), { status: 500 })
        : realFetch(input, init)) as typeof fetch;
    const r = await call("POST", "/api/expert-meetings", "re", {
      slotId: slotIds[1], professionalName: "Ana RE", topic: "Terceiro assunto sobre o caso ESCO-2026-A1",
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.emailSent, false);
  });

  test("Dra. só aceita link do Meet válido", async () => {
    assert.equal((await call("PUT", "/api/expert-meetings/settings", "board", { meetUrl: "https://x.com/a" })).status, 400);
    const ok = await call("PUT", "/api/expert-meetings/settings", "board", { meetUrl: "https://meet.google.com/xyz-abcd-efg" });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.meetUrl, "https://meet.google.com/xyz-abcd-efg");
  });
});
