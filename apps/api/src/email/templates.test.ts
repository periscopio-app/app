import test from "node:test";
import assert from "node:assert/strict";
import { verificationEmail, escapeHtml } from "./templates";

test("e-mail de confirmação usa identidade do projeto e escapa o nome", () => {
  process.env.APP_URL = "https://exemplo.test";
  const mail = verificationEmail('<b>Ana</b>', "https://exemplo.test/api/auth/verify-email?token=x");
  assert.ok(mail.html.includes("#682880"));
  assert.ok(mail.html.includes("https://exemplo.test/landing-logo.webp"));
  assert.ok(!mail.html.includes("<b>Ana</b>"));
  assert.equal(escapeHtml('"&'), "&quot;&amp;");
});
