import { SPECIALIST_CLINICAL_ROLES, CLINICAL_ROLES, hasRole, Role } from "../security/roles";

export interface VersionedFormSubmission {
  id: string;
  tenantId: string;
  studentId: string;
  formType: "fogap" | "mchat" | "srq20" | "observacao_escolar";
  version: number;
  status: "rascunho" | "submetido" | "retificado";
  previousVersionId?: string;
  payload: Record<string, unknown>;
  authorId: string;
  authorRole: Role;
  submittedAt: string;
}

export interface CaseDelegation {
  caseId: string;
  tenantId: string;
  assignedByDoctorId: string;
  specialistId: string;
  specialty: "fonoaudiologia" | "psicologia" | "psicopedagogia" | "medicina" | "servico_social";
  status: "pendente" | "em_andamento" | "concluido";
  notes?: string;
}

export interface MeetingSlot {
  id: string;
  caseId: string;
  organizerId: string;
  participantIds: string[];
  scheduledAt: string; // ISO 8601 UTC
  timezone: "America/Sao_Paulo";
  meetLink?: string;
  status: "agendado" | "cancelado" | "realizado";
}

/**
 * Valida a criação de formulário versionado imutável (Task 07).
 * Retificações nunca sobrescrevem o registro anterior; geram uma nova versão aditiva apontando para a anterior.
 */
export function createFormAddendum(
  previousForm: VersionedFormSubmission,
  newPayload: Record<string, unknown>,
  actorId: string,
  actorRole: Role
): VersionedFormSubmission {
  if (previousForm.status !== "submetido") {
    throw new Error("Apenas formulários submetidos podem receber retificações.");
  }

  return {
    id: crypto.randomUUID(),
    tenantId: previousForm.tenantId,
    studentId: previousForm.studentId,
    formType: previousForm.formType,
    version: previousForm.version + 1,
    status: "retificado",
    previousVersionId: previousForm.id,
    payload: newPayload,
    authorId: actorId,
    authorRole: actorRole,
    submittedAt: new Date().toISOString(),
  };
}

/**
 * Valida delegação clínica de prontuário multidisciplinar (Task 09).
 * Apenas médicos e PpI podem delegar seções a especialistas.
 * Especialistas só podem alterar seções atribuídas diretamente a eles.
 */
export function validateSpecialistSectionEdit(
  delegation: CaseDelegation,
  actorId: string,
  actorRole: Role
): { allowed: boolean; reason?: string } {
  if (!hasRole(actorRole, SPECIALIST_CLINICAL_ROLES)) {
    return { allowed: false, reason: "Acesso negado: apenas especialistas clínicos podem editar seções." };
  }

  if (delegation.specialistId !== actorId) {
    return { allowed: false, reason: "Acesso negado: você só pode alterar seções atribuídas a você." };
  }

  return { allowed: true };
}

/**
 * Valida agendamento de reuniões clínicas/Meet sem choque de horários (Task 09A).
 * Garante fuso horário 'America/Sao_Paulo' e impede dupla reserva de participante no mesmo horário.
 */
export function scheduleMeetingSlot(
  params: {
    caseId: string;
    organizerId: string;
    participantIds: string[];
    scheduledAt: string;
    existingSlots: MeetingSlot[];
  }
): { success: boolean; slot?: MeetingSlot; error?: string } {
  const { caseId, organizerId, participantIds, scheduledAt, existingSlots } = params;

  // 1. Checagem de dupla reserva para qualquer participante
  const hasConflict = existingSlots.some(
    (slot) =>
      slot.status === "agendado" &&
      slot.scheduledAt === scheduledAt &&
      (slot.organizerId === organizerId ||
        slot.participantIds.some((p) => participantIds.includes(p)))
  );

  if (hasConflict) {
    return { success: false, error: "Conflito de agenda: um dos participantes já possui reunião agendada neste horário." };
  }

  // 2. Link do Meet sintético sem dados sensíveis/PII da criança no convite
  const meetRoomId = `periscopio-call-${crypto.randomUUID().substring(0, 8)}`;
  const meetLink = `https://meet.google.com/${meetRoomId}`;

  const slot: MeetingSlot = {
    id: crypto.randomUUID(),
    caseId,
    organizerId,
    participantIds,
    scheduledAt,
    timezone: "America/Sao_Paulo",
    meetLink,
    status: "agendado",
  };

  return { success: true, slot };
}
