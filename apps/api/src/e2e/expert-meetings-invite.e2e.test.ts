/**
 * E2E da confirmação do Board com Google Agenda/Meet e plano B (Jitsi + .ics).
 * Requer TEST_DATABASE_URL (Postgres local de teste). Google e Resend são simulados: nada sai da máquina.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;
const PASS = "Senha-de-teste-123!";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const MEET = "https://meet.google.com/abc-defg-hij";
const FIXED = "https://meet.google.com/fix-edro-oom";
const TEAM = "equipe@projetoperiscopio.com.br";
const JITSI = /^https:\/\/meet\.jit\.si\/periscopio-[0-9a-f]{32}$/;

describe("agenda do Board: Google Agenda/Meet e plano B (E2E)", { skip }, () => {
  let app: FastifyInstance;
  let tenantA = "";
  const cookies = {} as Record<string, string>;
  const sent: any[] = [];
  const google: { url: string; method: string; body: any }[] = [];
  let googleRefresh: "ok" | "expired" = "ok";
  let resendRejectsAttachments = false;
  const realFetch = globalThis.fetch;
  const slots: { id: string; start: Date }[] = [];

  async function call(method: string, path: string, who?: string, body?: unknown) {
    const headers: Record<string, string> = { origin: "http://localhost:3000" };
    if (who) headers.cookie = cookies[who];
    if (body !== undefined) headers["content-type"] = "application/json";
    const r = await app.inject({ method: method as any, url: path, headers, payload: body === undefined ? undefined : JSON.stringify(body) });
    let parsed: any = null;
    try { parsed = r.json(); } catch { parsed = r.body; }
    return { status: r.statusCode, body: parsed, headers: r.headers, raw: r.body };
  }

  const future = (days: number, hour: number) => {
    const d = new Date(Date.now() + days * 86400000);
    d.setUTCHours(hour, 0, 0, 0);
    return d;
  };

  /** Cria um pedido pendente no próximo horário livre. */
  async function pending(professionalName = "Ana RE") {
    const slot = slots.shift();
    assert.ok(slot, "acabaram os horários do teste");
    const r = await call("POST", "/api/expert-meetings", "re", { slotId: slot.id, professionalName, topic: "Dúvida sobre conduta em caso de teste", studentCode: "ESCO-2026-A1" });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return { id: r.body.meeting.id as string, start: slot.start };
  }

  const confirmedMail = () => sent.filter((s) => s.template.id === "expert-meeting-confirmed");
  const decode = (att: any) => Buffer.from(att.content, "base64").toString("utf8");
  const unfold = (ics: string) => ics.replace(/\r\n /g, "");

  async function connectGoogle() {
    const c = await call("GET", "/api/integrations/google/connect?returnTo=/escola-a1/dashboard/agenda", "board");
    assert.equal(c.status, 200, JSON.stringify(c.body));
    const state = new URL(c.body.url).searchParams.get("state")!;
    const cb = await call("GET", `/api/integrations/google/callback?code=codigo-de-teste&state=${encodeURIComponent(state)}`, "board");
    assert.equal(cb.status, 302);
    assert.equal(cb.headers.location, "/escola-a1/dashboard/agenda?google=connected");
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
    process.env.APP_URL = "http://localhost:3000";
    process.env.RESEND_API_KEY = "re_teste";
    delete process.env.EXPERT_MEET_URL;
    delete process.env.EXPERT_BOARD_EMAIL;
    // Valores fictícios, só para este teste.
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "test-client-secret";
    process.env.GOOGLE_TOKEN_ENC_KEY = "chave-de-teste-com-mais-de-32-caracteres!!";
    delete process.env.GOOGLE_CALENDAR_REDIRECT_URI;

    globalThis.fetch = (async (input: any, init?: any) => {
      const u = String(input);
      if (u.startsWith("https://api.resend.com/")) {
        const body = JSON.parse(init.body);
        if (resendRejectsAttachments && body.attachments) return new Response(JSON.stringify({ message: "attachments not allowed with template" }), { status: 422 });
        sent.push(body);
        return new Response(JSON.stringify({ id: "email_fake" }), { status: 200 });
      }
      if (u === "https://oauth2.googleapis.com/token") {
        const form = new URLSearchParams(String(init.body));
        google.push({ url: u, method: "POST", body: Object.fromEntries(form) });
        if (form.get("grant_type") === "authorization_code") {
          return new Response(JSON.stringify({ access_token: "acesso-de-teste", refresh_token: "refresh-de-teste", scope: SCOPE }), { status: 200 });
        }
        return googleRefresh === "expired"
          ? new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })
          : new Response(JSON.stringify({ access_token: "acesso-de-teste" }), { status: 200 });
      }
      if (u === "https://oauth2.googleapis.com/revoke") {
        google.push({ url: u, method: "POST", body: Object.fromEntries(new URLSearchParams(String(init.body))) });
        return new Response("{}", { status: 200 });
      }
      if (u.startsWith("https://www.googleapis.com/calendar/v3/")) {
        const method = init?.method ?? "GET";
        const body = init?.body ? JSON.parse(init.body) : null;
        google.push({ url: u, method, body });
        if (method === "DELETE") return new Response(null, { status: 204 });
        if (method === "POST") {
          return new Response(JSON.stringify({ id: body.id, ...(body.conferenceData ? { hangoutLink: MEET } : {}) }), { status: 200 });
        }
        return new Response(JSON.stringify({ id: "x", hangoutLink: MEET }), { status: 200 });
      }
      return realFetch(input, init);
    }) as typeof fetch;

    const shared = await import("@periscopio/shared");
    const { db } = await import("../db/client");
    const { upsertCredential } = await import("../auth/credentials");
    const { buildApp } = await import("../app");

    const [tA] = await db.insert(shared.tenants).values({ name: "Município A", municipalityCode: "A" }).returning();
    const [tB] = await db.insert(shared.tenants).values({ name: "Município B", municipalityCode: "B" }).returning();
    tenantA = tA.id;
    const [sA] = await db.insert(shared.schools).values({ tenantId: tA.id, name: "Escola A1", slug: "escola-a1", status: "active" }).returning();
    const people = [
      { key: "re", email: "re@teste.local", role: "ppi", tenant: tA.id, school: sA.id },
      { key: "re2", email: "re2@teste.local", role: "ppi", tenant: tA.id, school: sA.id },
      { key: "board", email: "dra@teste.local", role: "board", tenant: tA.id, school: null },
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
    for (let i = 0; i < 9; i++) {
      const start = future(2 + i, 13);
      const r = await call("POST", "/api/expert-meetings/slots", "board", { startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3600000).toISOString() });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      slots.push({ id: r.body.slot.id, start });
    }
  });

  after(async () => {
    globalThis.fetch = realFetch;
    await app?.close();
    const { db } = await import("../db/client");
    await (db as any).$client.end();
  });

  let jitsiMeeting = { id: "", url: "" };
  let pendingMeetingId = "";

  test("sem Google: sala Jitsi aleatória, .ics anexado e a cópia da equipe leva o mesmo link", async () => {
    const m = await pending();
    pendingMeetingId = (await pending()).id; // fica pendente para os testes de 404 do .ics
    sent.length = 0;
    const r = await call("PATCH", `/api/expert-meetings/${m.id}/confirm`, "board", {});
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.match(r.body.meeting.meetUrl, JITSI);
    assert.equal(r.body.meeting.meetProvider, "jitsi");
    assert.equal(r.body.meeting.googleEventId, null);
    assert.deepEqual(r.body.calendar, { provider: "jitsi", googleInvite: false, notice: null });
    jitsiMeeting = { id: m.id, url: r.body.meeting.meetUrl };

    const mails = confirmedMail();
    assert.deepEqual(mails.map((s) => s.to).sort(), [TEAM, "re@teste.local"]);
    for (const mail of mails) {
      assert.equal(mail.template.variables.MEET_URL, jitsiMeeting.url, "mesma sala para quem pediu e para a equipe");
      assert.equal(mail.attachments.length, 1);
      assert.equal(mail.attachments[0].filename, "reuniao-board-periscopio.ics");
      assert.match(mail.attachments[0].content_type, /^text\/calendar/);
      const ics = unfold(decode(mail.attachments[0]));
      assert.ok(ics.includes("METHOD:REQUEST"));
      assert.ok(ics.includes(`URL:${jitsiMeeting.url}`));
      assert.ok(ics.includes("mailto:re@teste.local"));
      assert.ok(ics.includes(`DTSTART:${m.start.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`));
      assert.ok(!ics.includes("ESCO-2026-A1") && !ics.includes("Dúvida sobre conduta"), "convite genérico");
    }
    assert.equal(google.length, 0, "sem conexão, o Google nem é chamado");
  });

  test(".ics: quem pediu e a Dra. baixam; outra escola, outro tenant, pendente, uuid ruim e anônimo não", async () => {
    const path = `/api/expert-meetings/${jitsiMeeting.id}/calendar.ics`;
    const own = await call("GET", path, "re");
    assert.equal(own.status, 200);
    assert.match(String(own.headers["content-type"]), /^text\/calendar/);
    assert.match(String(own.headers["content-disposition"]), /attachment; filename="reuniao-board-periscopio\.ics"/);
    assert.equal(own.headers["cache-control"], "private, no-store");
    assert.ok(unfold(own.raw).includes(`URL:${jitsiMeeting.url}`));
    assert.equal((await call("GET", path, "board")).status, 200);

    assert.equal((await call("GET", path, "re2")).status, 404, "outro solicitante do mesmo tenant");
    assert.equal((await call("GET", path, "boardB")).status, 404, "outro tenant");
    assert.equal((await call("GET", `/api/expert-meetings/${pendingMeetingId}/calendar.ics`, "board")).status, 404, "pendente");
    assert.equal((await call("GET", "/api/expert-meetings/nao-e-uuid/calendar.ics", "board")).status, 404);
    assert.equal((await call("GET", "/api/expert-meetings/00000000-0000-4000-8000-000000000000/calendar.ics", "board")).status, 404);
    assert.equal((await call("GET", path)).status, 401);
  });

  test("conexão com o Google: só a coordenação; state de outro usuário é recusado; token vai cifrado", async () => {
    const { decryptToken } = await import("../services/google-calendar.service");
    const { db } = await import("../db/client");
    const shared = await import("@periscopio/shared");
    const { eq } = await import("drizzle-orm");

    assert.equal((await call("GET", "/api/integrations/google/status", "re")).status, 403);
    assert.equal((await call("GET", "/api/integrations/google/connect", "re")).status, 403);
    assert.equal((await call("GET", "/api/integrations/google/status")).status, 401);

    const before = await call("GET", "/api/integrations/google/status", "board");
    assert.equal(before.body.configured, true);
    assert.equal(before.body.connected, false);
    assert.equal(before.body.redirectUri, "http://localhost:3000/api/integrations/google/callback");

    const c = await call("GET", "/api/integrations/google/connect?returnTo=https://evil.example", "board");
    const authUrl = new URL(c.body.url);
    assert.equal(authUrl.searchParams.get("client_id"), "test-client-id.apps.googleusercontent.com");
    assert.equal(authUrl.searchParams.get("scope"), SCOPE);
    assert.ok(!c.body.url.includes("test-client-secret"));

    // state assinado para OUTRO usuário (mesmo tenant): inválido
    const { signState } = await import("../services/google-calendar.service");
    const foreign = signState({ tenantId: tenantA, userId: "00000000-0000-4000-8000-0000000000aa", returnTo: "/x" });
    const bad = await call("GET", `/api/integrations/google/callback?code=c&state=${encodeURIComponent(foreign)}`, "board");
    assert.equal(bad.status, 302);
    assert.equal(bad.headers.location, "/?google=invalid");
    assert.equal((await call("GET", "/api/integrations/google/callback?code=c&state=lixo", "board")).headers.location, "/?google=invalid");
    assert.equal((await call("GET", "/api/integrations/google/status", "board")).body.connected, false);

    // o "denied" do Google volta para a tela sem conectar
    const okState = new URL((await call("GET", "/api/integrations/google/connect?returnTo=/escola-a1/dashboard/agenda", "board")).body.url).searchParams.get("state")!;
    const denied = await call("GET", `/api/integrations/google/callback?error=access_denied&state=${encodeURIComponent(okState)}`, "board");
    assert.equal(denied.headers.location, "/escola-a1/dashboard/agenda?google=denied");

    await connectGoogle();
    const [row] = await db.select().from(shared.googleCalendarConnections).where(eq(shared.googleCalendarConnections.tenantId, tenantA));
    assert.ok(row);
    assert.ok(!row.refreshTokenEnc.includes("refresh-de-teste"), "token nunca em texto puro");
    assert.equal(decryptToken(row.refreshTokenEnc), "refresh-de-teste");
    const after = await call("GET", "/api/integrations/google/status", "board");
    assert.equal(after.body.connected, true);
    assert.ok(!JSON.stringify(after.body).includes("refresh"), "nenhuma rota devolve o token");
    // Outro tenant não enxerga a conexão
    assert.equal((await call("GET", "/api/integrations/google/status", "boardB")).body.connected, false);
  });

  test("com Google: evento e Meet criados na agenda da Dra., convite do Google, sem .ics duplicado", async () => {
    const m = await pending();
    sent.length = 0;
    google.length = 0;
    const r = await call("PATCH", `/api/expert-meetings/${m.id}/confirm`, "board", {});
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.meeting.meetUrl, MEET);
    assert.equal(r.body.meeting.meetProvider, "google");
    assert.equal(r.body.meeting.googleEventId, m.id.replace(/-/g, ""));
    assert.deepEqual(r.body.calendar, { provider: "google", googleInvite: true, notice: null });

    const insert = google.find((g) => g.url.includes("/events?") && g.method === "POST")!;
    assert.match(insert.url, /conferenceDataVersion=1/);
    assert.match(insert.url, /sendUpdates=all/);
    assert.deepEqual(insert.body.attendees.map((a: any) => a.email).sort(), [TEAM, "re@teste.local"]);
    assert.equal(insert.body.conferenceData.createRequest.conferenceSolutionKey.type, "hangoutsMeet");
    const text = JSON.stringify(insert.body);
    assert.ok(!text.includes("ESCO-2026-A1") && !text.includes("Dúvida sobre conduta") && !text.includes("Escola A1"), "evento genérico");

    for (const mail of confirmedMail()) {
      assert.equal(mail.template.variables.MEET_URL, MEET);
      assert.equal(mail.attachments, undefined, "o convite do Google já chegou");
    }
    // o .ics continua disponível na tela
    assert.equal((await call("GET", `/api/expert-meetings/${m.id}/calendar.ics`, "re")).status, 200);
  });

  test("token do Google expirado: confirma pelo Jitsi com .ics, avisa a Dra. e pede para reconectar", async () => {
    googleRefresh = "expired";
    const m = await pending();
    sent.length = 0;
    const r = await call("PATCH", `/api/expert-meetings/${m.id}/confirm`, "board", {});
    googleRefresh = "ok";
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.match(r.body.meeting.meetUrl, JITSI);
    assert.equal(r.body.calendar.provider, "jitsi");
    assert.match(r.body.calendar.notice, /Reconecte o Google/);
    assert.ok(confirmedMail().every((s) => s.attachments?.length === 1));
    assert.equal((await call("GET", "/api/integrations/google/status", "board")).body.connected, false, "conexão morta sai do ar");
  });

  test("Resend recusa anexo com template: reenvia sem anexo e o e-mail chega", async () => {
    resendRejectsAttachments = true;
    const m = await pending();
    sent.length = 0;
    const r = await call("PATCH", `/api/expert-meetings/${m.id}/confirm`, "board", {});
    resendRejectsAttachments = false;
    assert.equal(r.status, 200);
    assert.equal(r.body.emailSent, true);
    assert.equal(confirmedMail().length, 2);
    assert.ok(confirmedMail().every((s) => s.attachments === undefined && JITSI.test(s.template.variables.MEET_URL)));
  });

  test("texto hostil é escapado nas variáveis do e-mail e não entra no .ics", async () => {
    const hostile = `<img src=x onerror=alert(1)>"&'`;
    const m = await pending(hostile);
    sent.length = 0;
    const r = await call("PATCH", `/api/expert-meetings/${m.id}/confirm`, "board", {});
    assert.equal(r.status, 200);
    for (const mail of confirmedMail()) {
      assert.equal(mail.template.variables.PROFESSIONAL_NAME, "&lt;img src=x onerror=alert(1)&gt;&quot;&amp;&#39;");
      assert.ok(!decode(mail.attachments[0]).includes("onerror"));
    }
  });

  test("recusa não cria sala nem evento e libera o horário", async () => {
    const m = await pending();
    google.length = 0;
    const d = await call("PATCH", `/api/expert-meetings/${m.id}/decline`, "board", { note: "Sem agenda" });
    assert.equal(d.status, 200);
    assert.equal(d.body.meeting.meetUrl, null);
    assert.equal(d.body.meeting.meetProvider, null);
    assert.equal(d.body.calendar, undefined);
    assert.equal(google.length, 0);
    assert.equal((await call("GET", `/api/expert-meetings/${m.id}/calendar.ics`, "re")).status, 404);
  });

  test("sala fixa + Google: o evento aponta para a sala fixa e não cria outro Meet; desconectar revoga", async () => {
    assert.equal((await call("PUT", "/api/expert-meetings/settings", "board", { meetUrl: FIXED })).status, 200);
    await connectGoogle();
    const m = await pending();
    google.length = 0;
    const r = await call("PATCH", `/api/expert-meetings/${m.id}/confirm`, "board", {});
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.meeting.meetUrl, FIXED);
    assert.equal(r.body.meeting.meetProvider, "fixed");
    assert.ok(r.body.meeting.googleEventId);
    const insert = google.find((g) => g.method === "POST" && g.url.includes("/events?"))!;
    assert.equal(insert.body.conferenceData, undefined);
    assert.equal(insert.body.location, FIXED);

    google.length = 0;
    const del = await call("DELETE", "/api/integrations/google", "board");
    assert.equal(del.status, 200);
    assert.deepEqual(del.body, { connected: false });
    assert.ok(google.some((g) => g.url === "https://oauth2.googleapis.com/revoke" && g.body.token === "refresh-de-teste"));
    assert.equal((await call("GET", "/api/integrations/google/status", "board")).body.connected, false);
    assert.equal((await call("DELETE", "/api/integrations/google", "re")).status, 403);
  });

  test("sem Google e com sala fixa: usa a sala fixa e anexa o .ics", async () => {
    const m = await pending();
    sent.length = 0;
    const r = await call("PATCH", `/api/expert-meetings/${m.id}/confirm`, "board", {});
    assert.equal(r.status, 200);
    assert.equal(r.body.meeting.meetUrl, FIXED);
    assert.equal(r.body.meeting.meetProvider, "fixed");
    assert.ok(confirmedMail().every((s) => s.template.variables.MEET_URL === FIXED && s.attachments?.length === 1));
  });

  test("id malformado na confirmação não derruba a API", async () => {
    const r = await call("PATCH", "/api/expert-meetings/nao-e-uuid/confirm", "board", {});
    assert.equal(r.status, 409);
  });
});
