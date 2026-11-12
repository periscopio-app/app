/** Códigos de erro de rede que o Node devolve quando a requisição nem chega a ter resposta HTTP. */
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
