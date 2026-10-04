import { test } from "node:test";
import assert from "node:assert";
import { hasRole, isRole, ADMINISTRATIVE_ONLY_ROLES, CLINICAL_ROLES, SPECIALIST_CLINICAL_ROLES, TRIAGEM_ROLES } from "./roles";

test("garante que admin e gestores NUNCA possuem acesso a papéis clínicos", () => {
  const adminRoles = ["admin_platform", "municipal_manager", "school_manager"] as const;

  for (const role of adminRoles) {
    assert.strictEqual(
      hasRole(role, CLINICAL_ROLES),
      false,
      `O papel ${role} não pode ter permissão clínica (CLINICAL_ROLES)`
    );
    assert.strictEqual(
      hasRole(role, TRIAGEM_ROLES),
      false,
      `O papel ${role} não pode ter permissão de triagem docente (TRIAGEM_ROLES)`
    );
    assert.strictEqual(
      hasRole(role, SPECIALIST_CLINICAL_ROLES),
      false,
      `O papel ${role} não pode ter permissão de especialista clínico (SPECIALIST_CLINICAL_ROLES)`
    );
  }
});

test("garante que apenas profissionais clínicos possuem papéis clínicos autorizados", () => {
  const clinicalRoles = ["teacher", "ppi", "md1", "board", "specialist"] as const;

  for (const role of clinicalRoles) {
    assert.strictEqual(
      hasRole(role, CLINICAL_ROLES),
      true,
      `O papel clínico ${role} deve possuir permissão em CLINICAL_ROLES`
    );
  }
});

test("validação de papéis válidos e inválidos no sistema", () => {
  assert.strictEqual(isRole("admin_platform"), true);
  assert.strictEqual(isRole("ppi"), true);
  assert.strictEqual(isRole("specialist"), true);
  assert.strictEqual(isRole("hacker_role"), false);
  assert.strictEqual(isRole("superadmin"), false);
});
