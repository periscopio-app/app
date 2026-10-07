import crypto from "crypto";

/**
 * Link de "primeiro acesso / esqueci a senha": token sem estado, assinado com HMAC.
 * Carrega e-mail, validade e uma impressão digital da credencial atual. Quando a
 * senha muda, a impressão digital muda e o link deixa de valer (uso único na prática).
 */
export const ACCESS_LINK_TTL_MS = 60 * 60 * 1000;

function secret(): string {
  return (
    process.env.BETTER_AUTH_SECRET ||
    process.env.AUTH_SECRET ||
    "dev_only_secret_replace_in_production"
  );
}

function sign(body: string): string {
  return crypto.createHmac("sha256", secret()).update(body).digest("base64url");
}

export function createAccessToken(email: string, fingerprint: string, now = Date.now()): string {
  const payload = { e: email.toLowerCase().trim(), f: fingerprint, x: now + ACCESS_LINK_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyAccessToken(
  token: string,
  now = Date.now(),
): { email: string; fingerprint: string } | null {
  if (typeof token !== "string") return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;

  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof payload.e !== "string" || typeof payload.f !== "string" || typeof payload.x !== "number") {
      return null;
    }
    if (now > payload.x) return null;
    return { email: payload.e, fingerprint: payload.f };
  } catch {
    return null;
  }
}
