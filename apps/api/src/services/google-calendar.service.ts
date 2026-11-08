/**
 * Google Calendar + Meet para a agenda do Board, sem SDK: só `fetch` e `node:crypto`.
 *
 * - OAuth "Aplicativo da Web" (authorization code + refresh token). Escopo mínimo: calendar.events.
 * - O refresh token é cifrado (AES-256-GCM) com GOOGLE_TOKEN_ENC_KEY antes de ir ao banco.
 * - O `state` do OAuth é assinado (HMAC) e amarrado ao usuário e ao tenant que iniciaram a conexão.
 * - Falha do Google NUNCA derruba a confirmação da reunião: quem chama cai no plano B (Jitsi + .ics).
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { googleCalendarConnections } from "@periscopio/shared";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const CALENDAR_TZ = "America/Sao_Paulo";
const STATE_TTL_MS = 10 * 60 * 1000;
const MEET_LINK_RE = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

// ─── configuração ────────────────────────────────────────────────────────────

export type GoogleConfig = { clientId: string; clientSecret: string; redirectUri: string };

function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Devolve null quando a integração não está configurada neste ambiente (o resto do sistema segue sem ela). */
export function googleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  const key = process.env.GOOGLE_TOKEN_ENC_KEY?.trim();
  if (!clientId || !clientSecret || !key || Buffer.byteLength(key, "utf8") < 32) return null;
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim() || `${appUrl()}/api/integrations/google/callback`;
  return { clientId, clientSecret, redirectUri };
}

export class GoogleApiError extends Error {
  constructor(
    public readonly code: "not_configured" | "invalid_grant" | "no_refresh_token" | "scope_missing" | "http" | "network" | "no_meet_link",
    public readonly status?: number,
  ) {
    super(`Google API: ${code}${status ? ` (${status})` : ""}`);
    this.name = "GoogleApiError";
  }
}

// ─── cifra do token e do state ───────────────────────────────────────────────

function derivedKey(label: "token" | "state"): Buffer {
  const secret = process.env.GOOGLE_TOKEN_ENC_KEY?.trim();
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) throw new GoogleApiError("not_configured");
  return createHmac("sha256", secret).update(`periscopio:google:${label}`).digest();
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", derivedKey("token"), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decryptToken(envelope: string): string {
  const parts = envelope.split(".");
  if (parts.length !== 3) throw new GoogleApiError("invalid_grant");
  try {
    const [iv, tag, data] = parts.map((p) => Buffer.from(p, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", derivedKey("token"), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch (err) {
    if (err instanceof GoogleApiError) throw err;
    throw new GoogleApiError("invalid_grant"); // chave trocada ou registro adulterado: exige reconectar
  }
}

export type OAuthState = { tenantId: string; userId: string; returnTo: string };

/** Só caminhos relativos do próprio site: bloqueia `//outro.site`, `https://...` e `\\`. */
export function safeReturnTo(value: unknown): string {
  return typeof value === "string" && /^\/[A-Za-z0-9_\-/]*$/.test(value) && !value.startsWith("//") ? value : "/";
}

function sign(payload: string): string {
  return createHmac("sha256", derivedKey("state")).update(payload).digest("base64url");
}

export function signState(input: OAuthState, now = Date.now()): string {
  const body = Buffer.from(
    JSON.stringify({ t: input.tenantId, u: input.userId, r: safeReturnTo(input.returnTo), n: randomBytes(12).toString("base64url"), e: now + STATE_TTL_MS }),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyState(state: unknown, now = Date.now()): OAuthState | null {
  if (typeof state !== "string") return null;
  const [body, mac, extra] = state.split(".");
  if (!body || !mac || extra !== undefined) return null;
  try {
    const expected = Buffer.from(sign(body));
    const received = Buffer.from(mac);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { t?: unknown; u?: unknown; r?: unknown; e?: unknown };
    if (typeof data.t !== "string" || typeof data.u !== "string" || typeof data.e !== "number" || data.e < now) return null;
    return { tenantId: data.t, userId: data.u, returnTo: safeReturnTo(data.r) };
  } catch {
    return null;
  }
}

// ─── OAuth ───────────────────────────────────────────────────────────────────

export function buildAuthUrl(cfg: GoogleConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: "offline", // devolve o refresh token
    prompt: "consent", // sem isto o Google só entrega o refresh token na 1ª vez
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function postForm(url: string, form: Record<string, string>): Promise<{ status: number; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, data };
  } catch {
    throw new GoogleApiError("network");
  }
}

export async function exchangeCode(cfg: GoogleConfig, code: string): Promise<{ refreshToken: string; scope: string }> {
  const { status, data } = await postForm(TOKEN_URL, {
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: "authorization_code",
  });
  if (status < 200 || status >= 300) throw new GoogleApiError(data.error === "invalid_grant" ? "invalid_grant" : "http", status);
  const scope = typeof data.scope === "string" ? data.scope : "";
  if (!scope.split(" ").includes(GOOGLE_CALENDAR_SCOPE)) throw new GoogleApiError("scope_missing");
  if (typeof data.refresh_token !== "string" || !data.refresh_token) throw new GoogleApiError("no_refresh_token");
  return { refreshToken: data.refresh_token, scope };
}

export async function refreshAccessToken(cfg: GoogleConfig, refreshToken: string): Promise<string> {
  const { status, data } = await postForm(TOKEN_URL, {
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "refresh_token",
  });
  if (status < 200 || status >= 300) throw new GoogleApiError(data.error === "invalid_grant" ? "invalid_grant" : "http", status);
  if (typeof data.access_token !== "string" || !data.access_token) throw new GoogleApiError("http", status);
  return data.access_token;
}

/** Melhor esforço: se falhar, a conexão local é removida do mesmo jeito. */
export async function revokeToken(refreshToken: string): Promise<void> {
  try {
    await postForm(REVOKE_URL, { token: refreshToken });
  } catch {
    /* ignorado de propósito */
  }
}

// ─── Calendar ────────────────────────────────────────────────────────────────

type CalendarEvent = {
  id?: string;
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
};

function meetLinkOf(event: CalendarEvent): string | null {
  const candidates = [event.hangoutLink, ...(event.conferenceData?.entryPoints ?? []).filter((e) => e.entryPointType === "video").map((e) => e.uri)];
  return candidates.find((u): u is string => typeof u === "string" && MEET_LINK_RE.test(u)) ?? null;
}

async function calendarFetch(accessToken: string, url: string, init: RequestInit = {}): Promise<{ status: number; data: CalendarEvent }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...init.headers },
    });
    const data = (res.status === 204 ? {} : await res.json().catch(() => ({}))) as CalendarEvent;
    return { status: res.status, data };
  } catch {
    throw new GoogleApiError("network");
  }
}

/** ID de evento do Google: base32hex minúsculo, 5–1024 caracteres. O UUID sem hífens serve e torna a criação idempotente. */
export const eventIdFor = (meetingId: string) => meetingId.replace(/-/g, "").toLowerCase();

export type CreateEventInput = {
  meetingId: string;
  startsAt: Date;
  endsAt: Date;
  attendees: string[];
  /** Sala fixa da Dra.: o evento aponta para ela e o Google não cria outro Meet. */
  fixedMeetUrl?: string | null;
};

const EVENT_SUMMARY = "Reunião do Board de experts – Periscópio";

export async function createCalendarEvent(accessToken: string, input: CreateEventInput): Promise<{ eventId: string; meetUrl: string | null }> {
  const id = eventIdFor(input.meetingId);
  // Texto genérico de propósito: nada de tema, código de aluno, caso ou escola no convite.
  const body: Record<string, unknown> = {
    id,
    summary: EVENT_SUMMARY,
    description: input.fixedMeetUrl
      ? `Reunião com o Board de experts do Periscópio.\nSala: ${input.fixedMeetUrl}`
      : "Reunião com o Board de experts do Periscópio.",
    start: { dateTime: input.startsAt.toISOString(), timeZone: CALENDAR_TZ },
    end: { dateTime: input.endsAt.toISOString(), timeZone: CALENDAR_TZ },
    attendees: [...new Set(input.attendees.map((e) => e.trim().toLowerCase()).filter(Boolean))].map((email) => ({ email })),
    guestsCanModify: false,
    guestsCanInviteOthers: false,
    reminders: { useDefault: true },
  };
  if (input.fixedMeetUrl) body.location = input.fixedMeetUrl;
  else body.conferenceData = { createRequest: { requestId: id, conferenceSolutionKey: { type: "hangoutsMeet" } } };

  const url = `${EVENTS_URL}?conferenceDataVersion=1&sendUpdates=all`;
  let res = await calendarFetch(accessToken, url, { method: "POST", body: JSON.stringify(body) });
  if (res.status === 409) {
    // Repetição da mesma confirmação: o evento já existe, só lemos de volta (não duplica convite).
    res = await calendarFetch(accessToken, `${EVENTS_URL}/${id}`);
  }
  if (res.status === 401) throw new GoogleApiError("invalid_grant", 401);
  if (res.status < 200 || res.status >= 300) throw new GoogleApiError("http", res.status);

  let event = res.data;
  if (input.fixedMeetUrl) return { eventId: event.id ?? id, meetUrl: input.fixedMeetUrl };

  // O Google às vezes cria o Meet de forma assíncrona: espera um pouco antes de desistir.
  for (let attempt = 0; !meetLinkOf(event) && attempt < 3; attempt++) {
    await new Promise((r) => setTimeout(r, 400));
    const again = await calendarFetch(accessToken, `${EVENTS_URL}/${id}?conferenceDataVersion=1`);
    if (again.status >= 200 && again.status < 300) event = again.data;
  }
  return { eventId: event.id ?? id, meetUrl: meetLinkOf(event) };
}

/** Melhor esforço. `notify` só quando o convite já tinha saído para os convidados. */
export async function deleteCalendarEvent(accessToken: string, eventId: string, notify: boolean): Promise<void> {
  try {
    await calendarFetch(accessToken, `${EVENTS_URL}/${eventId}?sendUpdates=${notify ? "all" : "none"}`, { method: "DELETE" });
  } catch {
    /* ignorado de propósito */
  }
}

// ─── conexão guardada por tenant ─────────────────────────────────────────────

export async function getConnection(tenantId: string) {
  const [row] = await db.select().from(googleCalendarConnections).where(eq(googleCalendarConnections.tenantId, tenantId)).limit(1);
  return row ?? null;
}

export async function saveConnection(tenantId: string, connectedBy: string | null, refreshToken: string, scope: string) {
  const values = { tenantId, connectedBy, refreshTokenEnc: encryptToken(refreshToken), scope, updatedAt: new Date() };
  await db
    .insert(googleCalendarConnections)
    .values(values)
    .onConflictDoUpdate({ target: googleCalendarConnections.tenantId, set: { connectedBy, refreshTokenEnc: values.refreshTokenEnc, scope, updatedAt: values.updatedAt, createdAt: new Date() } });
}

export async function deleteConnection(tenantId: string): Promise<string | null> {
  const [row] = await db.delete(googleCalendarConnections).where(eq(googleCalendarConnections.tenantId, tenantId)).returning();
  if (!row) return null;
  try {
    return decryptToken(row.refreshTokenEnc);
  } catch {
    return null;
  }
}

// ─── fachada usada pela confirmação ──────────────────────────────────────────

export type CalendarOutcome =
  | { kind: "google"; eventId: string; meetUrl: string | null }
  | { kind: "skipped"; reason: "not_configured" | "not_connected" }
  | { kind: "failed"; reason: "reauth_required" | "google_error" | "no_meet_link" };

/** Cria o evento (com Meet, ou apontando para a sala fixa) na agenda da Dra. Nunca lança. */
export async function createBoardMeetingEvent(tenantId: string, input: CreateEventInput): Promise<CalendarOutcome> {
  const cfg = googleConfig();
  if (!cfg) return { kind: "skipped", reason: "not_configured" };
  const connection = await getConnection(tenantId);
  if (!connection) return { kind: "skipped", reason: "not_connected" };

  let accessToken: string;
  try {
    accessToken = await refreshAccessToken(cfg, decryptToken(connection.refreshTokenEnc));
  } catch (err) {
    if (err instanceof GoogleApiError && err.code === "invalid_grant") {
      await deleteConnection(tenantId); // token revogado/expirado: some do "conectado" e a Dra. reconecta
      return { kind: "failed", reason: "reauth_required" };
    }
    return { kind: "failed", reason: "google_error" };
  }

  try {
    const created = await createCalendarEvent(accessToken, input);
    if (!created.meetUrl) {
      await deleteCalendarEvent(accessToken, created.eventId, false);
      return { kind: "failed", reason: "no_meet_link" };
    }
    return { kind: "google", eventId: created.eventId, meetUrl: created.meetUrl };
  } catch (err) {
    if (err instanceof GoogleApiError && err.code === "invalid_grant") {
      await deleteConnection(tenantId);
      return { kind: "failed", reason: "reauth_required" };
    }
    return { kind: "failed", reason: "google_error" };
  }
}

/** Remove um evento criado, quando a confirmação perdeu a corrida no banco. Nunca lança. */
export async function discardBoardMeetingEvent(tenantId: string, eventId: string): Promise<void> {
  const cfg = googleConfig();
  const connection = await getConnection(tenantId);
  if (!cfg || !connection) return;
  try {
    const accessToken = await refreshAccessToken(cfg, decryptToken(connection.refreshTokenEnc));
    await deleteCalendarEvent(accessToken, eventId, true);
  } catch {
    /* ignorado de propósito */
  }
}
