import { test } from "node:test";
import assert from "node:assert/strict";
import { validateMeetingRequest, validateMeetUrl, validateSlotRange } from "./expert-meeting-guard";
import { escapeVar } from "../email/templated";

const slotId = "11111111-1111-4111-8111-111111111111";
const ok = { slotId, professionalName: "Ana Souza", topic: "Dúvida sobre encaminhamento do caso A-001" };

test("aceita pedido válido", () => assert.equal(validateMeetingRequest(ok).ok, true));
test("rejeita CPF, telefone e e-mail no assunto", () => {
  for (const t of ["Aluno com CPF 123.456.789-09 precisa", "Ligar para (11) 91234-5678 sobre o caso", "Contato mae@email.com sobre o caso"]) {
    assert.equal(validateMeetingRequest({ ...ok, topic: t }).ok, false);
  }
});
test("rejeita assunto curto/longo e slot inválido", () => {
  assert.equal(validateMeetingRequest({ ...ok, topic: "curto" }).ok, false);
  assert.equal(validateMeetingRequest({ ...ok, topic: "x".repeat(601) }).ok, false);
  assert.equal(validateMeetingRequest({ ...ok, slotId: "abc" }).ok, false);
});
test("valida URL do Meet", () => {
  assert.equal(validateMeetUrl("https://meet.google.com/abc-defg-hij").ok, true);
  assert.equal(validateMeetUrl("https://evil.com/abc-defg-hij").ok, false);
});
test("valida intervalo do slot", () => {
  const now = new Date("2026-10-10T10:00:00Z");
  assert.equal(validateSlotRange("2026-10-11T13:00:00Z", "2026-10-11T14:00:00Z", now).ok, true);
  assert.equal(validateSlotRange("2026-10-09T13:00:00Z", "2026-10-09T14:00:00Z", now).ok, false);
  assert.equal(validateSlotRange("2026-10-11T13:00:00Z", "2026-10-11T13:05:00Z", now).ok, false);
});
test("escapa HTML nas variáveis de template", () => {
  assert.equal(escapeVar('<script>"x"</script>'), "&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
});
