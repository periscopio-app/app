import assert from "node:assert/strict";
import test from "node:test";
import { sendEmail } from "./index";

test("does not initialize Resend when the API key is absent", async () => {
  const previousKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;

  await assert.rejects(
    sendEmail("equipe@example.test", "Teste", "<p>Teste</p>"),
    /RESEND_API_KEY is not configured/
  );

  if (previousKey) {
    process.env.RESEND_API_KEY = previousKey;
  }
});
