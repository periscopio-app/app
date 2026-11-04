import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recordAiUsageFromReply } from "./ai-usage";
import { rawMetrics, resetMetrics } from "./metrics";

describe("recordAiUsageFromReply", () => {
  it("soma o uso devolvido pelo serviço de IA", () => {
    resetMetrics();
    recordAiUsageFromReply("resumo_tea", { summary: "x", usage: [{ provider: "gemini", model: "g", input_tokens: 40, output_tokens: 8, ok: true }, { provider: "gemini", model: "g", input_tokens: 0, output_tokens: 0, ok: false }] });
    const [a] = rawMetrics().ai;
    assert.deepEqual([a.feature, a.provider, a.inputTokens, a.outputTokens, a.ok, a.failed], ["resumo_tea", "gemini", 40, 8, 1, 1]);
  });

  it("ignora resposta antiga, campo inválido ou valor estranho sem lançar erro", () => {
    resetMetrics();
    for (const r of [null, undefined, "texto", {}, { usage: "x" }, { usage: [null, 3, "a"] }]) recordAiUsageFromReply("f", r);
    assert.equal(rawMetrics().ai.length, 0);
  });
});
