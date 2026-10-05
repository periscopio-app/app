import { test } from "node:test";
import assert from "node:assert";
import { canAccessStudentIdentityVault } from "./identity-vault.service";

test("nega acesso ao cofre de identidade para admin e gestores", () => {
  const adminRoles = ["admin_platform", "municipal_manager", "school_manager"] as const;

  for (const role of adminRoles) {
    const res = canAccessStudentIdentityVault({
      actor: { id: "user-admin", tenantId: "tenant-1", role },
      studentId: "student-1",
      studentSchoolId: "school-1",
      studentTenantId: "tenant-1",
      accessReason: "Motivo administrativo de auditoria",
    });

    assert.strictEqual(res.allowed, false);
    assert.match(res.reason || "", /perfis administrativos não possuem acesso/);
  }
});

test("exige motivo de acesso válido com pelo menos 5 caracteres", () => {
  const res = canAccessStudentIdentityVault({
    actor: { id: "user-teacher", tenantId: "tenant-1", schoolId: "school-1", role: "teacher" },
    studentId: "student-1",
    studentSchoolId: "school-1",
    studentTenantId: "tenant-1",
    accessReason: "abc",
  });

  assert.strictEqual(res.allowed, false);
  assert.match(res.reason || "", /justificativa válida/);
});

test("bloqueia acesso quando tenant ou escola não coincidem", () => {
  const crossTenantRes = canAccessStudentIdentityVault({
    actor: { id: "user-ppi", tenantId: "tenant-1", schoolId: "school-1", role: "ppi" },
    studentId: "student-1",
    studentSchoolId: "school-1",
    studentTenantId: "tenant-2",
    accessReason: "Avaliação do prontuário do aluno",
  });

  assert.strictEqual(crossTenantRes.allowed, false);
  assert.match(crossTenantRes.reason || "", /município \/ tenant divergente/);

  const crossSchoolRes = canAccessStudentIdentityVault({
    actor: { id: "user-teacher", tenantId: "tenant-1", schoolId: "school-1", role: "teacher" },
    studentId: "student-1",
    studentSchoolId: "school-2",
    studentTenantId: "tenant-1",
    accessReason: "Acompanhamento de encaminhamento",
  });

  assert.strictEqual(crossSchoolRes.allowed, false);
  assert.match(crossSchoolRes.reason || "", /não vinculado à unidade escolar/);
});

test("permite acesso para perfil clínico autorizado e gera entrada de auditoria com eventId UUID", () => {
  const res = canAccessStudentIdentityVault({
    actor: { id: "user-md1", tenantId: "tenant-1", schoolId: "school-1", role: "md1" },
    studentId: "student-100",
    studentSchoolId: "school-1",
    studentTenantId: "tenant-1",
    accessReason: "Verificação de histórico vacinal e laudo anterior",
  });

  assert.strictEqual(res.allowed, true);
  assert.ok(res.auditEntry);
  assert.strictEqual(res.auditEntry?.action, "IDENTITY_VAULT_ACCESS");
  assert.strictEqual(res.auditEntry?.entity, "student_identity_vault");
  assert.strictEqual(res.auditEntry?.entityId, "student-100");
  assert.ok(res.auditEntry?.eventId);
  assert.strictEqual(res.auditEntry?.eventId.length, 36); // UUID v4 format
});
