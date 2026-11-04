type Env = Record<string, string | undefined>;

/**
 * Endereço-base do projeto Supabase. Aceita SUPABASE_URL ou SUPABASE_PROJECT_REF e tolera
 * barra final e sufixos copiados do painel (/rest/v1, /storage/v1, /auth/v1).
 * Devolve null se não houver nada configurado e lança se o valor não for um endereço http(s).
 */
export function resolveSupabaseUrl(env: Env = process.env): string | null {
  const raw = env.SUPABASE_URL?.trim();
  const ref = env.SUPABASE_PROJECT_REF?.trim();
  const candidate = raw || (ref ? `https://${ref}.supabase.co` : "");
  if (!candidate) return null;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("SUPABASE_URL não é um endereço válido (esperado: https://<projeto>.supabase.co).");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("SUPABASE_URL precisa começar com https://.");
  }
  return parsed.origin;
}

const NETWORK_CODES: Record<string, string> = {
  ENOTFOUND: "o endereço não existe (DNS)",
  EAI_AGAIN: "o DNS não respondeu",
  ECONNREFUSED: "a conexão foi recusada",
  ECONNRESET: "a conexão foi interrompida",
  ETIMEDOUT: "o tempo de conexão esgotou",
  UND_ERR_CONNECT_TIMEOUT: "o tempo de conexão esgotou",
  ABORT_ERR: "o tempo de espera esgotou",
  CERT_HAS_EXPIRED: "o certificado TLS expirou",
  DEPTH_ZERO_SELF_SIGNED_CERT: "o certificado TLS não é confiável",
  ERR_TLS_CERT_ALTNAME_INVALID: "o certificado TLS não bate com o endereço",
};

/** Procura o código de erro de rede (ex.: ENOTFOUND) em erro, cause e originalError. */
export function networkErrorCode(err: unknown, depth = 0): string | null {
  if (!err || typeof err !== "object" || depth > 4) return null;
  const e = err as { code?: unknown; name?: unknown; cause?: unknown; originalError?: unknown };
  if (typeof e.code === "string" && e.code in NETWORK_CODES) return e.code;
  if (e.name === "AbortError") return "ABORT_ERR";
  return networkErrorCode(e.cause, depth + 1) ?? networkErrorCode(e.originalError, depth + 1);
}

/** "fetch failed" do Node/Supabase significa que a requisição nem chegou a ter resposta HTTP. */
export function isNetworkFailure(err: unknown): boolean {
  if (networkErrorCode(err)) return true;
  const msg = err && typeof err === "object" ? String((err as { message?: unknown }).message ?? "") : "";
  return /fetch failed/i.test(msg);
}

/** Mensagem curta e sem segredo para uma falha de rede com o Supabase. */
export function describeNetworkError(err: unknown): string {
  const code = networkErrorCode(err);
  const motivo = code ? NETWORK_CODES[code] : "a requisição não obteve resposta";
  return `Sem conexão com o Supabase: ${motivo}${code ? ` (${code})` : ""}. Confira SUPABASE_URL e se o projeto não está pausado.`;
}
