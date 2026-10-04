import { CLINICAL_ROLES, hasRole, Role } from "../security/roles";

export interface IdentityVaultAccessRequest {
  actor: {
    id: string;
    tenantId: string;
    schoolId?: string;
    role: Role;
  };
  studentId: string;
  studentSchoolId: string;
  studentTenantId: string;
  accessReason: string;
}

export interface IdentityVaultAccessResult {
  allowed: boolean;
  reason?: string;
  auditEntry?: {
    eventId: string;
    action: string;
    entity: string;
    entityId: string;
    actorId: string;
    tenantId: string;
    metadata: Record<string, unknown>;
  };
}

/**
 * Valida autorização para acesso ao Cofre de Identidade do Aluno (Task 01A).
 * Perfis administrativos (admin, gestores) são NUNCA autorizados.
 * Apenas papéis clínicos vinculados à mesma escola/tenant com motivo justificado.
 */
export function canAccessStudentIdentityVault(
  request: IdentityVaultAccessRequest
): IdentityVaultAccessResult {
  const { actor, studentId, studentSchoolId, studentTenantId, accessReason } = request;

  // 1. O papel precisa ser um papel clínico autorizado (Jamais admin/gestores)
  if (!hasRole(actor.role, CLINICAL_ROLES)) {
    return {
      allowed: false,
      reason: "Acesso negado: perfis administrativos não possuem acesso ao cofre de identidade.",
    };
  }

  // 2. Justificativa de acesso é obrigatória
  if (!accessReason || accessReason.trim().length < 5) {
    return {
      allowed: false,
      reason: "Acesso negado: informe uma justificativa válida com no mínimo 5 caracteres.",
    };
  }

  // 3. Validação de isolamento Multi-tenant
  if (actor.tenantId !== studentTenantId) {
    return {
      allowed: false,
      reason: "Acesso negado: município / tenant divergente.",
    };
  }

  // 4. Validação de vinculação escolar (quando aplicável ao perfil)
  if (actor.schoolId && actor.schoolId !== studentSchoolId) {
    return {
      allowed: false,
      reason: "Acesso negado: profissional não vinculado à unidade escolar do aluno.",
    };
  }

  // 5. Sucesso - Gerar log de auditoria associado
  const eventId = crypto.randomUUID();
  return {
    allowed: true,
    auditEntry: {
      eventId,
      action: "IDENTITY_VAULT_ACCESS",
      entity: "student_identity_vault",
      entityId: studentId,
      actorId: actor.id,
      tenantId: actor.tenantId,
      metadata: {
        accessReason,
        role: actor.role,
        accessedAt: new Date().toISOString(),
      },
    },
  };
}
