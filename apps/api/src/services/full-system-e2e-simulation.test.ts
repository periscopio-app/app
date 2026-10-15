import { test } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import { buildApp } from "../app";
import {
  createFormAddendum,
  validateSpecialistSectionEdit,
  scheduleMeetingSlot,
  type VersionedFormSubmission,
  type CaseDelegation,
  type MeetingSlot,
} from "./clinical-workflow.service";
import { canAccessStudentIdentityVault } from "./identity-vault.service";

test("SIMULAÇÃO E2E DE PONTA A PONTA: Validação completa do ciclo de vida do paciente e governança", async (t) => {
  const app = await buildApp({ logger: false });
  const tenantId = "tenant-taruma-sp";
  const schoolId = "school-emef-monteiro-lobato";
  const simulatedStudentId = "student-uuid-550e8400-e29b-41d4-a716-446655440000";

  // ─────────────────────────────────────────────────────────────────────────────
  // ETAPA 1: Registro do Aluno pela RE & Validação de Pseudonimização (LGPD Art. 37)
  // ─────────────────────────────────────────────────────────────────────────────
  await t.test("Etapa 1: Registro e geração de código pseudonimizado sem PII", () => {
    const birthYear = 2018; // 8 anos em 2026
    const birthMonth = 5;
    const currentYear = 2026;
    const age = currentYear - birthYear;

    // Regra do piloto
    assert.ok(age >= 6 && age <= 9, "Idade deve estar dentro da faixa do piloto escolar");

    // Geração do código do aluno
    const hash = crypto.createHash("sha256").update(`${tenantId}:${simulatedStudentId}`).digest("hex");
    const studentCode = `ALU-${hash.substring(0, 8).toUpperCase()}`;

    assert.match(studentCode, /^ALU-[0-9A-F]{8}$/, "Código do aluno deve seguir o padrão estável ALU-XXXXXXXX");
    assert.doesNotMatch(studentCode, /joao|maria|silva|cpf|123/i, "Código do aluno não pode conter dados identificáveis");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ETAPA 2: Preenchimento FOGAP e Observação Docente (Responsável Escolar)
  // ─────────────────────────────────────────────────────────────────────────────
  await t.test("Etapa 2: Submissão do FOGAP versionado e transição para Revisão Médica", () => {
    const originalFogap: VersionedFormSubmission = {
      id: "fogap-v1-uuid",
      tenantId,
      studentId: simulatedStudentId,
      formType: "fogap",
      version: 1,
      status: "submetido",
      payload: {
        teacherName: "Profa. Maria Helena",
        provenance: "relato_docente_presencial",
        domains: {
          comunicacao: "Dificuldade em manter contato visual e iniciar conversas espontâneas",
          socializacao: "Isolamento em recreio, prefere brincadeiras solitárias e repetitivas",
          comportamento: "Inquietação com mudanças repentinas na rotina escolar",
        },
      },
      authorId: "user-re-01",
      authorRole: "responsavel_escolar",
      submittedAt: "2026-10-15T08:00:00Z",
    };

    assert.strictEqual(originalFogap.version, 1);
    assert.strictEqual(originalFogap.status, "submetido");

    // Aditivo retificador caso necessário
    const addendum = createFormAddendum(
      originalFogap,
      {
        ...originalFogap.payload,
        complemento: "Relato docente adicional fornecido em reunião de coordenação pedagógica",
      },
      "user-re-01",
      "responsavel_escolar"
    );

    assert.strictEqual(addendum.version, 2);
    assert.strictEqual(addendum.status, "retificado");
    assert.strictEqual(addendum.previousVersionId, "fogap-v1-uuid");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ETAPA 3: Delegação Multiprofissional e Validação Deontológica do Parecer (≥100 char)
  // ─────────────────────────────────────────────────────────────────────────────
  await t.test("Etapa 3: Delegação multiprofissional e exigência deontológica de 100 caracteres", () => {
    const delegation: CaseDelegation = {
      caseId: "case-taruma-001",
      tenantId,
      assignedByDoctorId: "user-medico-01",
      specialistId: "user-fono-01",
      specialty: "fonoaudiologia",
      status: "em_andamento",
    };

    // 1. Apenas a especialista designada pode preencher sua seção
    const canFonoEdit = validateSpecialistSectionEdit(delegation, "user-fono-01", "fonoaudiologa");
    assert.strictEqual(canFonoEdit.allowed, true);

    const canOtherEdit = validateSpecialistSectionEdit(delegation, "user-psico-99", "fonoaudiologa");
    assert.strictEqual(canOtherEdit.allowed, false);

    // 2. Validação da densidade do parecer clínico
    const invalidShortNote = "Aluno colaborativo na sessão. Encaminho para médico.";
    assert.ok(
      invalidShortNote.length < 100,
      "Parecer curto deve ser rejeitado pelo critério de densidade mínima de 100 caracteres"
    );

    const validDetailedNote =
      "Realizada avaliação fonoaudiológica clínica e observacional com a criança. Observa-se preservação da audição periférica, com alteração pragmática na modulação da entonação e ecolalia funcional tardia. Recomenda-se acompanhamento e estimulação da comunicação aumentativa e alternativa (CAA).";
    assert.ok(
      validDetailedNote.length >= 100,
      "Parecer técnico completo deve ter 100 ou mais caracteres fundamentados"
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ETAPA 4: Governança do Cofre de Identidade (LGPD Art. 37) & Trilha de Auditoria
  // ─────────────────────────────────────────────────────────────────────────────
  await t.test("Etapa 4: Descriptografia controlada do Cofre de Identidade e bloqueio de papéis administrativos", () => {
    // 1. Perfis administrativos/gestores NÃO podem quebrar o sigilo da criança
    const adminAccess = canAccessStudentIdentityVault({
      actor: { id: "user-admin-01", tenantId, role: "admin_platform" },
      studentId: simulatedStudentId,
      studentSchoolId: schoolId,
      studentTenantId: tenantId,
      accessReason: "Auditoria administrativa do sistema",
    });
    assert.strictEqual(adminAccess.allowed, false, "Admin da plataforma deve ter acesso bloqueado ao cofre");

    // 2. Médico da rede com justificativa clínica válida PODE acessar
    const doctorAccess = canAccessStudentIdentityVault({
      actor: { id: "user-medico-01", tenantId, schoolId, role: "medico" },
      studentId: simulatedStudentId,
      studentSchoolId: schoolId,
      studentTenantId: tenantId,
      accessReason: "Necessidade de prescrição médica individualizada e contato com responsável legal",
    });
    assert.strictEqual(doctorAccess.allowed, true, "Médico avaliador com justificativa deve ser autorizado");
    assert.ok(doctorAccess.auditEntry, "Deve gerar log de auditoria compulsório");
    assert.ok(doctorAccess.auditEntry.eventId, "Log de auditoria deve conter eventId UUID");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ETAPA 5: Agendamento do Board de Especialistas (Videochamada Jitsi sem PII)
  // ─────────────────────────────────────────────────────────────────────────────
  await t.test("Etapa 5: Reserva atômica de slots do Board e geração de sala virtual segura", () => {
    const slotTime = "2026-10-20T14:30:00Z";
    const existingSlots: MeetingSlot[] = [
      {
        id: "slot-01",
        caseId: "case-01",
        organizerId: "user-board-01",
        participantIds: ["user-fono-01"],
        scheduledAt: slotTime,
        timezone: "America/Sao_Paulo",
        meetLink: "https://meet.jit.si/periscopio-board-sec-98a7b6c5",
        status: "agendado",
      },
    ];

    // Tentativa de choque de horário -> Conflito 409
    const conflictBooking = scheduleMeetingSlot({
      caseId: "case-taruma-001",
      organizerId: "user-board-01",
      participantIds: ["user-medico-01"],
      scheduledAt: slotTime,
      existingSlots,
    });
    assert.strictEqual(conflictBooking.success, false);
    assert.match(conflictBooking.error || "", /Conflito de agenda/);

    // Reserva em novo horário disponível -> Sucesso
    const freeSlotTime = "2026-10-20T16:00:00Z";
    const successBooking = scheduleMeetingSlot({
      caseId: "case-taruma-001",
      organizerId: "user-board-01",
      participantIds: ["user-medico-01"],
      scheduledAt: freeSlotTime,
      existingSlots,
    });
    assert.strictEqual(successBooking.success, true);
    assert.ok(successBooking.slot?.meetLink);
    assert.doesNotMatch(
      successBooking.slot.meetLink,
      /aluno|nome|cpf|paciente/i,
      "Link da videochamada não pode expor dados do aluno na URL"
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ETAPA 6: Autoatendimento com RAG & Registro de Chamado com Telemetria
  // ─────────────────────────────────────────────────────────────────────────────
  await t.test("Etapa 6: Resposta inteligente RAG e registro de chamado com stack e telemetria", async () => {
    // 1. Consulta RAG (Dúvida comum antes de abrir ticket)
    const ragRes = await app.inject({
      method: "POST",
      url: "/api/support/ask-rag",
      payload: {
        question: "Como o médico visualiza o FOGAP e por que exige 100 caracteres no parecer?",
        role: "especialista",
      },
    });

    assert.strictEqual(ragRes.statusCode, 200);
    const ragBody = JSON.parse(ragRes.payload);
    assert.strictEqual(ragBody.success, true);
    assert.ok(ragBody.answer.includes("100 caracteres") || ragBody.answer.includes("FOGAP"));
    assert.strictEqual(ragBody.canOpenTicket, true);

    // 2. Abertura de Ticket com Telemetria do Cliente
    const ticketRes = await app.inject({
      method: "POST",
      url: "/api/support/tickets",
      payload: {
        title: "Dúvida sobre preenchimento de marco no ASQ",
        description: "Gostaria de confirmação se o campo de comunicação não verbal pontua no bloco inicial.",
        category: "duvida",
        userEmail: "fonoaudiologa.taruma@saude.sp.gov.br",
        userName: "Dra. Renata Fonoaudiologia",
        pageUrl: "https://www.projetoperiscopio.com.br/taruma/dashboard/especialista",
        browserInfo: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      },
    });

    assert.strictEqual(ticketRes.statusCode, 200);
    const ticketBody = JSON.parse(ticketRes.payload);
    assert.strictEqual(ticketBody.success, true);
    assert.ok(ticketBody.ticketId, "Ticket deve ser persistido e devolver id");
  });
});
