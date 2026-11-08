import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";

// Valores fictícios, só para o teste.
process.env.GOOGLE_CALENDAR_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "test-client-secret";
process.env.GOOGLE_TOKEN_ENC_KEY = "chave-de-teste-com-mais-de-32-caracteres!!";
process.env.APP_URL = "https://www.exemplo.test";
process.env.DATABASE_URL ??= "postgres://postgres@localhost:5432/periscopio_test"; // o módulo importa o db, mas nenhum teste aqui o usa

const realFetch = globalThis.fetch;
let calls: { url: string; init?: RequestInit }[] = [];
let handler: (url: string, init?: RequestInit) => Response | Promise<Response> = () => new Response("{}", { status: 200 });

before(() => {
  globalThis.fetch = (async (input: any, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return handler(String(input), init);
  }) as typeof fetch;
});
after(async () => {
  globalThis.fetch = realFetch;
  const { pool } = await import("../db/client");
  await pool.end();
});

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const MEETING = "11111111-2222-3333-4444-555555555555";
const input = { meetingId: MEETING, startsAt: new Date("2026-11-12T17:00:00Z"), endsAt: new Date("2026-11-12T18:00:00Z"), attendees: ["re@teste.local", "Equipe@Teste.local", "re@teste.local"] };

describe("token cifrado e state assinado", () => {
  test("cifra e decifra; o texto cifrado não contém o token", async () => {
    const { encryptToken, decryptToken } = await import("./google-calendar.service");
    const env = encryptToken("1//refresh-token-de-teste");
    assert.ok(!env.includes("refresh-token"));
    assert.equal(decryptToken(env), "1//refresh-token-de-teste");
    assert.notEqual(encryptToken("x"), encryptToken("x"), "IV aleatório");
  });
  test("registro adulterado ou chave trocada exige reconectar", async () => {
    const { encryptToken, decryptToken, GoogleApiError } = await import("./google-calendar.service");
    const env = encryptToken("segredo");
    const [iv, tag, data] = env.split(".");
    assert.throws(() => decryptToken(`${iv}.${tag}.${Buffer.from("outro").toString("base64url")}`), GoogleApiError);
    assert.throws(() => decryptToken("lixo"), GoogleApiError);
    const original = process.env.GOOGLE_TOKEN_ENC_KEY;
    process.env.GOOGLE_TOKEN_ENC_KEY = "outra-chave-de-teste-com-mais-de-32-caracteres";
    try { assert.throws(() => decryptToken(env), GoogleApiError); } finally { process.env.GOOGLE_TOKEN_ENC_KEY = original; }
    assert.ok(data);
  });
  test("state: ida e volta, adulteração, expiração e returnTo seguro", async () => {
    const { signState, verifyState } = await import("./google-calendar.service");
    const s = signState({ tenantId: "t1", userId: "u1", returnTo: "/escola/dashboard/agenda" });
    assert.deepEqual(verifyState(s), { tenantId: "t1", userId: "u1", returnTo: "/escola/dashboard/agenda" });
    const [body, mac] = s.split(".");
    const forged = Buffer.from(JSON.stringify({ t: "t2", u: "u1", r: "/", n: "x", e: Date.now() + 60000 })).toString("base64url");
    assert.equal(verifyState(`${forged}.${mac}`), null);
    assert.equal(verifyState(`${body}.${mac}x`), null);
    assert.equal(verifyState(`${body}.${mac}.extra`), null);
    assert.equal(verifyState(undefined), null);
    assert.equal(verifyState(s, Date.now() + 11 * 60 * 1000), null, "expira em 10 min");
    assert.equal(verifyState(signState({ tenantId: "t", userId: "u", returnTo: "//evil.example" }))?.returnTo, "/");
    assert.equal(verifyState(signState({ tenantId: "t", userId: "u", returnTo: "https://evil.example" }))?.returnTo, "/");
  });
  test("URL de autorização: escopo mínimo, offline, sem o segredo do cliente", async () => {
    const { googleConfig, buildAuthUrl, GOOGLE_CALENDAR_SCOPE } = await import("./google-calendar.service");
    const cfg = googleConfig()!;
    const url = new URL(buildAuthUrl(cfg, "STATE"));
    assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
    assert.equal(url.searchParams.get("scope"), GOOGLE_CALENDAR_SCOPE);
    assert.equal(url.searchParams.get("access_type"), "offline");
    assert.equal(url.searchParams.get("redirect_uri"), "https://www.exemplo.test/api/integrations/google/callback");
    assert.equal(url.searchParams.get("state"), "STATE");
    assert.ok(!url.toString().includes("test-client-secret"));
  });
  test("sem configuração completa a integração fica desligada", async () => {
    const { googleConfig } = await import("./google-calendar.service");
    const k = process.env.GOOGLE_TOKEN_ENC_KEY;
    process.env.GOOGLE_TOKEN_ENC_KEY = "curta";
    try { assert.equal(googleConfig(), null); } finally { process.env.GOOGLE_TOKEN_ENC_KEY = k; }
  });
});

describe("OAuth com fetch simulado", () => {
  test("troca de código exige refresh token e o escopo do Calendar", async () => {
    const { googleConfig, exchangeCode, GOOGLE_CALENDAR_SCOPE } = await import("./google-calendar.service");
    const cfg = googleConfig()!;
    handler = () => json(200, { access_token: "a", refresh_token: "r", scope: GOOGLE_CALENDAR_SCOPE });
    assert.deepEqual(await exchangeCode(cfg, "codigo"), { refreshToken: "r", scope: GOOGLE_CALENDAR_SCOPE });
    handler = () => json(200, { access_token: "a", scope: GOOGLE_CALENDAR_SCOPE });
    await assert.rejects(() => exchangeCode(cfg, "c"), { code: "no_refresh_token" });
    handler = () => json(200, { access_token: "a", refresh_token: "r", scope: "openid" });
    await assert.rejects(() => exchangeCode(cfg, "c"), { code: "scope_missing" });
    handler = () => json(400, { error: "invalid_grant" });
    await assert.rejects(() => exchangeCode(cfg, "c"), { code: "invalid_grant" });
  });
  test("refresh com invalid_grant é reconhecido", async () => {
    const { googleConfig, refreshAccessToken } = await import("./google-calendar.service");
    handler = () => json(400, { error: "invalid_grant" });
    await assert.rejects(() => refreshAccessToken(googleConfig()!, "r"), { code: "invalid_grant" });
    handler = () => json(200, { access_token: "novo" });
    assert.equal(await refreshAccessToken(googleConfig()!, "r"), "novo");
  });
});

describe("evento do Calendar", () => {
  test("pede Meet novo, convida todos, id determinístico e texto genérico", async () => {
    const { createCalendarEvent, eventIdFor } = await import("./google-calendar.service");
    calls = [];
    handler = () => json(200, { id: eventIdFor(MEETING), hangoutLink: "https://meet.google.com/abc-defg-hij" });
    const out = await createCalendarEvent("tok", input);
    assert.deepEqual(out, { eventId: "11111111222233334444555555555555", meetUrl: "https://meet.google.com/abc-defg-hij" });
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /conferenceDataVersion=1/);
    assert.match(calls[0].url, /sendUpdates=all/);
    assert.equal((calls[0].init!.headers as Record<string, string>).Authorization, "Bearer tok");
    const body = JSON.parse(String(calls[0].init!.body));
    assert.equal(body.id, "11111111222233334444555555555555");
    assert.match(body.id, /^[a-v0-9]{5,1024}$/);
    assert.deepEqual(body.attendees, [{ email: "re@teste.local" }, { email: "equipe@teste.local" }], "sem repetidos, minúsculo");
    assert.equal(body.conferenceData.createRequest.conferenceSolutionKey.type, "hangoutsMeet");
    assert.equal(body.conferenceData.createRequest.requestId, body.id);
    assert.equal(body.start.dateTime, "2026-11-12T17:00:00.000Z");
    assert.equal(body.guestsCanModify, false);
    assert.equal(JSON.stringify(body).includes("ESCO"), false);
  });
  test("sala fixa: não pede Meet novo e aponta para a sala", async () => {
    const { createCalendarEvent } = await import("./google-calendar.service");
    calls = [];
    handler = () => json(200, { id: "x" });
    const out = await createCalendarEvent("tok", { ...input, fixedMeetUrl: "https://meet.google.com/aaa-bbbb-ccc" });
    assert.equal(out.meetUrl, "https://meet.google.com/aaa-bbbb-ccc");
    const body = JSON.parse(String(calls[0].init!.body));
    assert.equal(body.conferenceData, undefined);
    assert.equal(body.location, "https://meet.google.com/aaa-bbbb-ccc");
  });
  test("409 (mesma confirmação repetida) lê o evento existente em vez de duplicar", async () => {
    const { createCalendarEvent } = await import("./google-calendar.service");
    calls = [];
    let n = 0;
    handler = () => (n++ === 0 ? json(409, { error: {} }) : json(200, { id: "e", hangoutLink: "https://meet.google.com/abc-defg-hij" }));
    const out = await createCalendarEvent("tok", input);
    assert.equal(out.meetUrl, "https://meet.google.com/abc-defg-hij");
    assert.equal(calls[1].init?.method ?? "GET", "GET");
  });
  test("link que não é do Meet é descartado", async () => {
    const { createCalendarEvent } = await import("./google-calendar.service");
    handler = () => json(200, { id: "e", hangoutLink: "https://evil.example/abc-defg-hij" });
    const out = await createCalendarEvent("tok", input);
    assert.equal(out.meetUrl, null);
  });
  test("401 vira invalid_grant e 500 vira erro http", async () => {
    const { createCalendarEvent } = await import("./google-calendar.service");
    handler = () => json(401, {});
    await assert.rejects(() => createCalendarEvent("tok", input), { code: "invalid_grant" });
    handler = () => json(500, {});
    await assert.rejects(() => createCalendarEvent("tok", input), { code: "http" });
  });
});
