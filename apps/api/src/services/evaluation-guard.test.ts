import { test } from "node:test";
import assert from "node:assert";
import { validateEvaluationInput, MAX_PAYLOAD_BYTES } from "./evaluation-guard";

const id = "0b9f3c1e-8a1d-4f3b-9d2e-5a6b7c8d9e0f";

test("aceita entrada válida e ignora qualquer score enviado", () => {
  const r = validateEvaluationInput({ studentId: id, scale: "fogap", score: 99, payload: { a: 1 } });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal("score" in r.value, false);
});

test("rejeita studentId que não é uuid, escala desconhecida e payload inválido", () => {
  assert.equal(validateEvaluationInput({ studentId: "1", scale: "fogap" }).ok, false);
  assert.equal(validateEvaluationInput({ studentId: id, scale: "abc" }).ok, false);
  assert.equal(validateEvaluationInput({ studentId: id, scale: "mchat", payload: [] }).ok, false);
  assert.equal(validateEvaluationInput(null).ok, false);
});

test("rejeita payload grande demais", () => {
  const big = { x: "a".repeat(MAX_PAYLOAD_BYTES + 1) };
  assert.equal(validateEvaluationInput({ studentId: id, scale: "srq20", payload: big }).ok, false);
});
