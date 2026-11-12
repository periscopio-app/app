import assert from "node:assert/strict";
import test from "node:test";
import { sendEmail, sendEmailResult } from "./index";
import { DEFAULT_FROM, fromAddress } from "./sender";

test("sem RESEND_API_KEY o envio devolve o motivo em vez de lançar, e sendEmail lança", async () => {
  const previousKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    const result = await sendEmailResult("equipe@example.test", "Teste", "<p>Teste</p>");
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.error, /RESEND_API_KEY/);
    await assert.rejects(sendEmail("equipe@example.test", "Teste", "<p>Teste</p>"), /RESEND_API_KEY/);
  } finally {
    if (previousKey) process.env.RESEND_API_KEY = previousKey;
  }
});

test("[REG-029] o remetente padrão é do domínio verificado no Resend e RESEND_FROM_EMAIL o substitui", () => {
  const previous = process.env.RESEND_FROM_EMAIL;
  try {
    delete process.env.RESEND_FROM_EMAIL;
    assert.equal(fromAddress(), DEFAULT_FROM);
    assert.match(DEFAULT_FROM, /@projetoperiscopio\.com\.br>$/, "o padrão antigo (periscopiosaude.com.br) não está verificado no Resend");
    process.env.RESEND_FROM_EMAIL = "  Outra <outra@projetoperiscopio.com.br> ";
    assert.equal(fromAddress(), "Outra <outra@projetoperiscopio.com.br>");
  } finally {
    if (previous === undefined) delete process.env.RESEND_FROM_EMAIL;
    else process.env.RESEND_FROM_EMAIL = previous;
  }
});
