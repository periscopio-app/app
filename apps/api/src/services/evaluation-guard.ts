/**
 * Guardrails de /api/evaluations.
 * O servidor NÃO aceita pontuação vinda do cliente: não existe regra de cálculo
 * clinicamente aprovada para M-CHAT/FOGAP/SRQ-20, então o score fica nulo até haver aprovação.
 */
export const EVALUATION_SCALES = ["mchat", "fogap", "srq20"] as const;
export type EvaluationScale = (typeof EVALUATION_SCALES)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_PAYLOAD_BYTES = 20_000;

export const EVALUATION_NOTICE =
  "Registro de apoio. Não é diagnóstico nem classificação; a interpretação é do profissional habilitado.";

export type EvaluationInput = { studentId: string; scale: EvaluationScale; payload: Record<string, unknown> };

export function validateEvaluationInput(
  body: unknown,
): { ok: true; value: EvaluationInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Corpo inválido." };
  const b = body as Record<string, unknown>;

  if (typeof b.studentId !== "string" || !UUID_RE.test(b.studentId)) {
    return { ok: false, error: "studentId inválido." };
  }
  if (typeof b.scale !== "string" || !(EVALUATION_SCALES as readonly string[]).includes(b.scale)) {
    return { ok: false, error: "Escala não reconhecida." };
  }
  const payload = b.payload ?? {};
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return { ok: false, error: "payload deve ser um objeto." };
  }
  if (Buffer.byteLength(JSON.stringify(payload), "utf8") > MAX_PAYLOAD_BYTES) {
    return { ok: false, error: "payload excede o tamanho permitido." };
  }
  return {
    ok: true,
    value: { studentId: b.studentId, scale: b.scale as EvaluationScale, payload: payload as Record<string, unknown> },
  };
}
