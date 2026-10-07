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

import { professionalInviteEmail, specialtyLabel } from "./templates";

test("convite do profissional cita escola e especialidade e escapa HTML", () => {
  const mail = professionalInviteEmail({
    name: "Ana",
    schoolName: "Escola <Modelo>",
    specialty: "fonoaudiologia",
    confirmUrl: "https://exemplo.test/api/onboarding/confirm-professional?token=abc",
  });
  assert.ok(mail.html.includes("Escola &lt;Modelo&gt;"));
  assert.ok(mail.html.includes("Fonoaudiologia"));
  assert.ok(mail.html.includes("confirm-professional?token=abc"));
  assert.ok(mail.subject.includes("Escola <Modelo>"));
  assert.equal(specialtyLabel(null), "Profissional da equipe");
});
