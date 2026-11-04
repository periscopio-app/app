import { recordAiUsage } from "./metrics";

/** Item de uso devolvido pelo serviço de IA (bi-rag) em cada resposta. */
type RagUsageItem = { provider?: unknown; model?: unknown; input_tokens?: unknown; output_tokens?: unknown; ok?: unknown };

/**
 * Lê o campo `usage` da resposta do assistente e soma nas métricas. Aceita qualquer formato (resposta antiga,
 * campo ausente ou inválido) sem lançar erro: medir o gasto nunca pode atrapalhar a resposta ao usuário.
 */
export function recordAiUsageFromReply(feature: string, reply: unknown): void {
  try {
    const usage = reply && typeof reply === "object" ? (reply as { usage?: unknown }).usage : undefined;
    if (!Array.isArray(usage)) return;
    const items = (usage as RagUsageItem[])
      .filter((u) => u && typeof u === "object")
      .map((u) => ({
        provider: String(u.provider ?? "desconhecido"),
        model: String(u.model ?? "desconhecido"),
        inputTokens: Number(u.input_tokens) || 0,
        outputTokens: Number(u.output_tokens) || 0,
        ok: u.ok !== false,
      }));
    if (items.length) recordAiUsage(feature, items);
  } catch {
    // medição nunca derruba a requisição
  }
}
