import { test } from "node:test";
import assert from "node:assert";
import {
  createFormAddendum,
  validateSpecialistSectionEdit,
  scheduleMeetingSlot,
  type VersionedFormSubmission,
  type CaseDelegation,
  type MeetingSlot,
} from "./clinical-workflow.service";

test("formulário versionado: cria retificação aditiva preservando a versão original imutável", () => {
  const originalForm: VersionedFormSubmission = {
    id: "form-v1",
    tenantId: "tenant-rio",
    studentId: "student-100",
    formType: "fogap",
    version: 1,
    status: "submetido",
    payload: { score: 12, observations: "Relato inicial do professor" },
    authorId: "user-re-01",
    authorRole: "school_manager",
    submittedAt: "2026-10-01T10:00:00Z",
  };

  const addendum = createFormAddendum(
    originalForm,
    { score: 14, observations: "Retificação do relato inicial com dados complementares" },
    "user-re-01",
    "school_manager"
  );

  assert.strictEqual(addendum.version, 2);
  assert.strictEqual(addendum.status, "retificado");
  assert.strictEqual(addendum.previousVersionId, "form-v1");
  assert.strictEqual(addendum.studentId, originalForm.studentId);
});

test("delegação multiprofissional: impede edição de seção atribuída a outro especialista", () => {
  const delegation: CaseDelegation = {
    caseId: "case-55",
    tenantId: "tenant-rio",
    assignedByDoctorId: "user-md1-01",
    specialistId: "user-fono-01",
    specialty: "fonoaudiologia",
    status: "em_andamento",
  };

  // 1. Fonoaudióloga atribuída pode editar
  const validEdit = validateSpecialistSectionEdit(delegation, "user-fono-01", "specialist");
  assert.strictEqual(validEdit.allowed, true);

  // 2. Outro especialista tenta editar seção alheia -> Negado
  const invalidEdit = validateSpecialistSectionEdit(delegation, "user-psico-02", "specialist");
  assert.strictEqual(invalidEdit.allowed, false);
  assert.match(invalidEdit.reason || "", /você só pode alterar seções atribuídas/);
});

test("agendamento de reuniões/Meet: bloqueia choque de horários e gera link sem PII da criança", () => {
  const scheduledTime = "2026-10-10T14:00:00Z";

  const existingSlots: MeetingSlot[] = [
    {
      id: "slot-01",
      caseId: "case-10",
      organizerId: "user-md1-01",
      participantIds: ["user-fono-01"],
      scheduledAt: scheduledTime,
      timezone: "America/Sao_Paulo",
      meetLink: "https://meet.google.com/periscopio-call-abc12345",
      status: "agendado",
    },
  ];

  // 1. Tentativa de dupla reserva no mesmo horário -> Conflito
  const conflictRes = scheduleMeetingSlot({
    caseId: "case-20",
    organizerId: "user-md1-01",
    participantIds: ["user-psico-01"],
    scheduledAt: scheduledTime,
    existingSlots,
  });

  assert.strictEqual(conflictRes.success, false);
  assert.match(conflictRes.error || "", /Conflito de agenda/);

  // 2. Agendamento em horário livre -> Sucesso com fuso America/Sao_Paulo e link limpo
  const freeTime = "2026-10-10T15:00:00Z";
  const successRes = scheduleMeetingSlot({
    caseId: "case-20",
    organizerId: "user-md1-01",
    participantIds: ["user-psico-01"],
    scheduledAt: freeTime,
    existingSlots,
  });

  assert.strictEqual(successRes.success, true);
  assert.ok(successRes.slot);
  assert.strictEqual(successRes.slot?.timezone, "America/Sao_Paulo");
  assert.ok(successRes.slot?.meetLink?.includes("meet.google.com/periscopio-call-"));
  assert.doesNotMatch(successRes.slot?.meetLink || "", /joao|maria|silva|cpf/i); // Sem PII no link
});
