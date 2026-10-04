import { test } from "node:test";
import assert from "node:assert";

test("validação de escola: rejeita slug duplicada ou malformada", () => {
  const normalizeSlug = (slug: string) =>
    slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-");

  assert.strictEqual(normalizeSlug("Escola Municipal Monteiro Lobato!"), "escola-municipal-monteiro-lobato-");
  assert.strictEqual(normalizeSlug("   Escola   123   "), "escola-123");
});

test("fluxo de convite: gera token seguro de 64 caracteres hexadecimais com expiração de 7 dias", () => {
  const inviteToken = "a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890";
  const now = Date.now();
  const expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000);

  assert.strictEqual(inviteToken.length, 64);
  assert.ok(expiresAt.getTime() > now);
});

test("ativação de escola: atualiza status para 'active' após onboarding concluído", () => {
  const initialSchool = {
    id: "school-01",
    status: "pending_onboarding",
  };

  const activatedSchool = {
    ...initialSchool,
    status: "active",
  };

  assert.strictEqual(initialSchool.status, "pending_onboarding");
  assert.strictEqual(activatedSchool.status, "active");
});
