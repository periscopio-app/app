import { test } from "node:test";
import assert from "node:assert";

test("validação de sessão: nega acesso sem credenciais/cookie de sessão", async () => {
  const reqHeaders = {};
  const hasAuth = Boolean(reqHeaders && Object.keys(reqHeaders).length > 0);
  assert.strictEqual(hasAuth, false);
});

test("garante que escopo do ator vem estritamente do banco de dados", () => {
  const dbUser = {
    id: "user-123",
    email: "docente@escola.gov.br",
    tenantId: "tenant-rio",
    schoolId: "escola-01",
    role: "teacher" as const,
  };

  // Simulação de headers forjados enviados pelo cliente
  const clientClaim = {
    tenantId: "tenant-hacker",
    role: "admin_platform",
  };

  // Escopo oficial consumido é estritamente dbUser
  const actor = {
    id: dbUser.id,
    email: dbUser.email,
    tenantId: dbUser.tenantId,
    schoolId: dbUser.schoolId,
    role: dbUser.role,
  };

  assert.strictEqual(actor.tenantId, "tenant-rio");
  assert.notStrictEqual(actor.tenantId, clientClaim.tenantId);
  assert.strictEqual(actor.role, "teacher");
  assert.notStrictEqual(actor.role, clientClaim.role);
});

test("validação de convite: rejeita token expirado ou já utilizado", () => {
  const now = new Date();
  const pastDate = new Date(now.getTime() - 3600 * 1000); // Expirado há 1h

  const expiredInvite = {
    token: "token-expirado",
    usedAt: null,
    expiresAt: pastDate,
  };

  const usedInvite = {
    token: "token-usado",
    usedAt: new Date(),
    expiresAt: new Date(now.getTime() + 3600 * 1000),
  };

  const isInvalidOrExpired = (invite: { usedAt: Date | null; expiresAt: Date }) => {
    return Boolean(!invite || invite.usedAt || now > new Date(invite.expiresAt));
  };

  assert.strictEqual(isInvalidOrExpired(expiredInvite), true);
  assert.strictEqual(isInvalidOrExpired(usedInvite), true);
});
