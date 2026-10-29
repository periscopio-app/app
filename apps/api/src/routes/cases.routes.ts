import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import {
  auditLogs,
  caseMedicalForms,
  caseSummaries,
  caseTimeline,
  caseTransitions,
  cases,
  reAssessments,
  schools,
  studentIdentityVault,
  students,
  users,
  VALID_SPECIALTIES,
} from "@periscopio/shared";
import { requireActor, requireCapability, type Actor } from "../security/actor";
import { canonicalRole } from "../security/capabilities";
import { can, leituraIntegral } from "../services/privilege.service";
import { encryptText } from "../services/identity-crypto.service";
import { auditarLeituraDoNome, auditarLeituraNaFila, carregarNomes, podeVerNomes } from "../services/student-name.service";
import { canAccessSchool } from "../security/tenancy";
import { isSuperAdminEmail, SPECIALIST_CLINICAL_ROLES } from "../security/roles";
import { CASE_LIST_ROLES, NUCLEO_DIRECTORY_ROLES, REGISTRY_ROLES, STAFF_DIRECTORY_ROLES } from "../security/permissions";
import { ageBracketOf, generateStudentCode, normalizeGrade, validateBirth, validatePilotAge } from "../services/student-code";
import { SUMARIO_MEDICO_FORM_ID, sumarioExecutivoMedico } from "../services/specialist-view.service";
import {
  FOGAP_FORM_CODE,
  FOGAP_VERSION,
  FOGAP_DESTINOS,
  fogapSomenteSumario,
  prontoParaRevisao,
  sumarioComPadroes,
  validarPayloadFogap,
  type FogapPayload,
  type FogapSecaoSumario,
  SNAP4_FORM_CODE,
  SNAP4_VERSION,
  validarPayloadSnap4,
  RE_FORMS,
  RE_JORNADA_FORM_CODE,
} from "@periscopio/shared";
import { carregarJornada, escalasDaJornada, montarPayloadFogap } from "../services/re-journey.service";
import {
  allSectionsDone,
  applyTransitionInTx,
  transitionCase,
  type JourneyState,
} from "../services/case-state.service";
import { notificar } from "../services/notifications.service";
import { recordAudit } from "../services/audit.service";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@periscopio/shared";

type AnyDb = NodePgDatabase<typeof schema>;

/** Perfis que enxergam a rede inteira do município (não ficam presos a uma escola). */
const NETWORK_LEVEL_ROLES = ["md1", "specialist", "municipal_manager", "board", "researcher"];


/**
 * Quem lê o prontuário recebe o sumário de cada seção SÓ depois de concluída. Seção em andamento aparece apenas com o
 * estado (rascunho nunca sai do bloco de notas do profissional).
 */
function apenasConcluidasComConteudo<T extends { status: string; summary: unknown; notes: unknown }>(sections: T[]): T[] {
  return sections.map((s) => (s.status === "concluido" ? s : { ...s, summary: null, notes: null }));
}

// ─── helpers ────────────────────────────────────────────────────────────────

async function schoolVisibleTo(actor: Actor, schoolId: string) {
  const [school] = await db
    .select()
    .from(schools)
    .where(eq(schools.id, schoolId))
    .limit(1);
  if (!school || !canAccessSchool(actor, school.tenantId, school.id)) return null;
  return school;
}

async function studentVisibleTo(actor: Actor, studentId: string) {
  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);
  if (!student || !canAccessSchool(actor, student.tenantId, student.schoolId)) return null;
  return student;
}

export async function caseVisibleTo(actor: Actor, caseId: string) {
  const isSuper =
    actor.role === "admin_platform" ||
    actor.role === "adm_master" ||
    isSuperAdminEmail(actor.email);

  const [caseItem] = await db
    .select()
    .from(cases)
    .where(isSuper ? eq(cases.id, caseId) : and(eq(cases.id, caseId), eq(cases.tenantId, actor.tenantId)))
    .limit(1);
  if (!caseItem) return null;

  if (isSuper) {
    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.id, caseItem.studentId))
      .limit(1);
    return student ? { caseItem, student } : null;
  }

  const student = await studentVisibleTo(actor, caseItem.studentId);
  return student ? { caseItem, student } : null;
}

async function insertStudent(school: { id: string; tenantId: string; slug: string | null }, birthYear: number, birthMonth: number, grade: string | null = null) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const studentCode = generateStudentCode(school.slug);
    try {
      const [student] = await db
        .insert(students)
        .values({
          tenantId: school.tenantId,
          schoolId: school.id,
          studentCode,
          birthYear,
          birthMonth,
          ageBracket: ageBracketOf(birthYear, birthMonth),
          grade,
        })
        .returning();
      return student;
    } catch (err) {
      // colisão do código único: tenta outro (probabilidade desprezível)
      if (attempt === 4) throw err;
    }
  }
  throw new Error("Não foi possível gerar o código do aluno");
}

// ─── route handler ──────────────────────────────────────────────────────────

export async function casesRoutes(app: FastifyInstance) {

  // ── Alunos ──────────────────────────────────────────────────────────────

  app.post("/api/students", async (request, reply) => {
    const actor = await requireCapability(request, reply, "student.register");
    if (!actor) return;

    const body = (request.body ?? {}) as { schoolId?: string; birthYear?: number; birthMonth?: number; grade?: unknown; fullName?: unknown };
    if (!body.schoolId) return reply.status(400).send({ error: "ID da escola é obrigatório" });

    // Nome da criança (opcional): vai direto, cifrado, para o cofre de identidade. O aluno continua sendo identificado pelo código.
    const nomeInformado = typeof body.fullName === "string" ? body.fullName.trim() : "";
    if (body.fullName !== undefined && body.fullName !== null && typeof body.fullName !== "string") {
      return reply.status(400).send({ error: "Informe o nome da criança em texto." });
    }
    if (nomeInformado && (nomeInformado.length < 2 || nomeInformado.length > 160)) {
      return reply.status(400).send({ error: "O nome da criança deve ter entre 2 e 160 letras." });
    }
    if (nomeInformado && !(await can(actor, "vault.register"))) {
      return reply.status(403).send({ error: "Seu perfil não pode guardar o nome da criança.", capability: "vault.register" });
    }

    const school = await schoolVisibleTo(actor, body.schoolId);
    if (!school) return reply.status(404).send({ error: "Escola não encontrada" });

    const birth = validateBirth(body);
    if (!birth.ok) return reply.status(400).send({ error: birth.error });
    const pilotAge = validatePilotAge(birth.birthYear, birth.birthMonth);
    if (!pilotAge.ok) return reply.status(400).send({ error: pilotAge.error });

    const grade = normalizeGrade(body.grade);
    if (!grade.ok) return reply.status(400).send({ error: grade.error });

    const student = await insertStudent(school, birth.birthYear, birth.birthMonth, grade.grade);
    if (nomeInformado) {
      await db.insert(studentIdentityVault).values({
        tenantId: student.tenantId,
        studentId: student.id,
        encryptedFullName: encryptText(nomeInformado),
      });
      await recordAudit(
        {
          tenantId: actor.tenantId,
          userId: actor.id,
          userEmail: actor.email,
          action: "student.vault_updated",
          entityType: "student_identity_vault",
          entityId: student.id,
          payload: { studentCode: student.studentCode, via: "cadastro" },
        },
        request
      );
    }
    await recordAudit(
      {
        tenantId: actor.tenantId,
        userId: actor.id,
        userEmail: actor.email,
        action: "create_student",
        entityType: "student",
        entityId: student.id,
        payload: {
          studentCode: student.studentCode,
          birthYear: student.birthYear,
          birthMonth: student.birthMonth,
          grade: student.grade,
          schoolId: school.id,
        },
      },
      request
    );
    return reply.status(201).send({ success: true, student });
  });

  /**
   * Edição auditada dos dados do aluno (ano/mês de nascimento e série). Cada alteração grava antes e depois na
   * trilha. Depois do envio ao médico o cadastro fica travado até a devolução (a idade define o grupo do FOGAP).
   */
  app.patch("/api/students/:studentId", async (request, reply) => {
    const actor = await requireCapability(request, reply, "student.register");
    if (!actor) return;
    const { studentId } = request.params as { studentId: string };
    const student = await studentVisibleTo(actor, studentId);
    if (!student) return reply.status(404).send({ error: "Aluno não encontrado" });

    const body = (request.body ?? {}) as { birthYear?: unknown; birthMonth?: unknown; grade?: unknown };
    const extra = Object.keys(body).filter((k) => !["birthYear", "birthMonth", "grade"].includes(k));
    if (extra.length > 0) return reply.status(400).send({ error: `Campo não permitido: ${extra.join(", ")}. Só nascimento e série podem ser editados.` });

    const updates: Partial<typeof students.$inferInsert> = {};
    const before = { birthYear: student.birthYear, birthMonth: student.birthMonth, grade: student.grade ?? null };
    const after = { ...before };

    if (body.birthYear !== undefined || body.birthMonth !== undefined) {
      const birth = validateBirth({
        birthYear: body.birthYear ?? student.birthYear,
        birthMonth: body.birthMonth ?? student.birthMonth,
      });
      if (!birth.ok) return reply.status(400).send({ error: birth.error });
      const pilot = validatePilotAge(birth.birthYear, birth.birthMonth);
      if (!pilot.ok) return reply.status(400).send({ error: pilot.error });
      after.birthYear = birth.birthYear;
      after.birthMonth = birth.birthMonth;
      updates.birthYear = birth.birthYear;
      updates.birthMonth = birth.birthMonth;
      updates.ageBracket = ageBracketOf(birth.birthYear, birth.birthMonth);
    }
    if (body.grade !== undefined) {
      const grade = normalizeGrade(body.grade);
      if (!grade.ok) return reply.status(400).send({ error: grade.error });
      after.grade = grade.grade;
      updates.grade = grade.grade;
    }

    const changedFields = (Object.keys(after) as (keyof typeof after)[]).filter((k) => after[k] !== before[k]);
    if (changedFields.length === 0) return { success: true, changed: [], student };

    // Casos já enviados ao médico ficam travados até a devolução.
    const enviados = await db
      .select({ id: cases.id })
      .from(cases)
      .where(and(eq(cases.studentId, student.id), eq(cases.tenantId, student.tenantId), ne(cases.journeyState, "rascunho"), ne(cases.journeyState, "encerrado")))
      .limit(1);
    if (enviados.length > 0) {
      return reply.status(409).send({ error: "O caso já foi enviado ao médico. Peça a devolução para corrigir os dados do aluno." });
    }

    const [updated] = await db
      .update(students)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(students.id, student.id), eq(students.tenantId, student.tenantId)))
      .returning();

    await recordAudit(
      {
        tenantId: student.tenantId,
        userId: actor.id,
        userEmail: actor.email,
        action: "update_student",
        entityType: "student",
        entityId: student.id,
        payload: { studentCode: student.studentCode, changedFields, before, after },
      },
      request
    );
    return { success: true, changed: changedFields, student: updated };
  });

  /** Histórico de criação e edições dos dados do aluno (quem, quando, antes e depois). */
  app.get("/api/students/:studentId/history", async (request, reply) => {
    const actor = await requireCapability(request, reply, "student.list");
    if (!actor) return;
    const { studentId } = request.params as { studentId: string };
    const student = await studentVisibleTo(actor, studentId);
    if (!student) return reply.status(404).send({ error: "Aluno não encontrado" });

    const rows = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        by: auditLogs.userEmail,
        at: auditLogs.createdAt,
        payload: auditLogs.payload,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityId, student.id),
          eq(auditLogs.entity, "student"),
          eq(auditLogs.tenantId, student.tenantId),
          inArray(auditLogs.action, ["create_student", "update_student"])
        )
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(50);
    return { history: rows };
  });

  // Importação em lote (planilha/colar): só ano e mês de nascimento — nenhum dado de identificação.
  app.post("/api/schools/:schoolId/students/bulk", async (request, reply) => {
    const actor = await requireCapability(request, reply, "student.register");
    if (!actor) return;
    const { schoolId } = request.params as { schoolId: string };
    const school = await schoolVisibleTo(actor, schoolId);
    if (!school) return reply.status(404).send({ error: "Escola não encontrada" });

    const rows = (request.body as { students?: Record<string, unknown>[] } | undefined)?.students;
    if (!Array.isArray(rows) || rows.length === 0) return reply.status(400).send({ error: "Envie ao menos um aluno" });
    if (rows.length > 500) return reply.status(400).send({ error: "Máximo de 500 alunos por importação" });

    const errors: { row: number; error: string }[] = [];
    const valid: { birthYear: number; birthMonth: number; grade: string | null }[] = [];
    rows.forEach((r, i) => {
      const extra = Object.keys(r ?? {}).filter((k) => k !== "birthYear" && k !== "birthMonth" && k !== "grade");
      if (extra.length > 0) {
        errors.push({ row: i + 1, error: `Campo não permitido: ${extra.join(", ")}. Envie só ano e mês de nascimento e, se quiser, a série.` });
        return;
      }
      const g = normalizeGrade((r as { grade?: unknown })?.grade);
      if (!g.ok) {
        errors.push({ row: i + 1, error: g.error });
        return;
      }
      const b = validateBirth(r ?? {});
      if (!b.ok) errors.push({ row: i + 1, error: b.error });
      else if (!validatePilotAge(b.birthYear, b.birthMonth).ok) errors.push({ row: i + 1, error: "Fora da faixa do piloto (4 anos a 9 anos e 11 meses)." });
      else valid.push({ birthYear: b.birthYear, birthMonth: b.birthMonth, grade: g.grade });
    });
    if (errors.length > 0) return reply.status(400).send({ error: "Planilha com erros; nada foi importado", errors: errors.slice(0, 20) });

    const created = [];
    for (const v of valid) created.push(await insertStudent(school, v.birthYear, v.birthMonth, v.grade));
    await recordAudit(
      {
        tenantId: actor.tenantId,
        userId: actor.id,
        userEmail: actor.email,
        action: "bulk_create_students",
        entityType: "student",
        entityId: school.id,
        payload: {
          count: created.length,
          schoolId: school.id,
        },
      },
      request
    );
    return reply.status(201).send({ success: true, imported: created.length, students: created });
  });

  app.get("/api/schools/:schoolId/students", async (request, reply) => {
    const actor = await requireCapability(request, reply, "student.list");
    if (!actor) return;

    const { schoolId } = request.params as { schoolId: string };
    const school = await schoolVisibleTo(actor, schoolId);
    if (!school) return reply.status(404).send({ error: "Escola não encontrada" });

    const list = await db
      .select()
      .from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.tenantId, school.tenantId)));
    return { students: list };
  });

  app.get("/api/schools/:schoolId/professionals", async (request, reply) => {
    const actor = await requireCapability(request, reply, "directory.staff");
    if (!actor) return;

    const { schoolId } = request.params as { schoolId: string };
    const school = await schoolVisibleTo(actor, schoolId);
    if (!school) return reply.status(404).send({ error: "Escola não encontrada" });

    const list = await db
      .select({ id: users.id, name: users.name, specialty: users.specialty, role: users.role, classCode: users.classCode })
      .from(users)
      .where(and(eq(users.schoolId, school.id), eq(users.tenantId, school.tenantId)));
    return { professionals: list };
  });

  /** Especialistas do núcleo do município, para o médico escolher a quem delegar. Só id, nome e especialidade. */
  app.get("/api/nucleo/professionals", async (request, reply) => {
    const actor = await requireCapability(request, reply, "directory.nucleo");
    if (!actor) return;
    const list = await db
      .select({ id: users.id, name: users.name, specialty: users.specialty, role: users.role, classCode: users.classCode })
      .from(users)
      .where(and(eq(users.tenantId, actor.tenantId), eq(users.role, "specialist"), eq(users.accessEnabled, true)));
    return { professionals: list };
  });

  // ── Casos ───────────────────────────────────────────────────────────────

  app.post("/api/cases", async (request, reply) => {
    const actor = await requireCapability(request, reply, "case.create");
    if (!actor) return;

    const body = request.body as { studentId?: string; dataInicioIntervencao?: string };
    if (!body.studentId) return reply.status(400).send({ error: "ID do aluno é obrigatório" });

    const student = await studentVisibleTo(actor, body.studentId);
    if (!student) return reply.status(404).send({ error: "Aluno não encontrado" });

    // Forma única do caso na interface: junta código do aluno, nascimento e escola (sem nome nem documento).
    const [school] = await db.select({ name: schools.name }).from(schools).where(eq(schools.id, student.schoolId)).limit(1);
    const present = (c: typeof cases.$inferSelect) => ({
      ...c,
      studentCode: student.studentCode,
      birthYear: student.birthYear,
      birthMonth: student.birthMonth,
      grade: student.grade ?? null,
      schoolName: school?.name ?? null,
    });

    // "Abrir" um aluno que já tem caso em andamento retoma esse caso, em vez de duplicar o prontuário.
    const [open] = await db
      .select()
      .from(cases)
      .where(and(eq(cases.studentId, student.id), eq(cases.tenantId, student.tenantId), ne(cases.journeyState, "encerrado")))
      .orderBy(desc(cases.createdAt))
      .limit(1);
    if (open) return reply.status(200).send({ success: true, reused: true, case: present(open) });

    const [caseItem] = await db
      .insert(cases)
      .values({
        tenantId: student.tenantId,
        studentId: student.id,
        status: "triagem",
        journeyState: "rascunho",
        dataInicioIntervencao: body.dataInicioIntervencao ?? new Date().toISOString().split("T")[0],
      })
      .returning();

    await db.insert(caseTimeline).values({
      tenantId: student.tenantId,
      caseId: caseItem.id,
      actorId: actor.id,
      event: "case:created",
      payload: { actorRole: actor.role },
    });

    return reply.status(201).send({ success: true, case: present(caseItem) });
  });

  app.get("/api/cases", async (request, reply) => {
    const actor = await requireCapability(request, reply, "case.list");
    if (!actor) return;

    const query = request.query as { states?: string };
    const stateList = query.states
      ? (query.states.split(",").map((s) => s.trim()).filter(Boolean) as JourneyState[])
      : [];

    const isSuper =
      actor.role === "admin_platform" ||
      actor.role === "adm_master" ||
      isSuperAdminEmail(actor.email);

    const conditions = [];
    if (!isSuper) {
      conditions.push(eq(cases.tenantId, actor.tenantId));
    }

    if (stateList.length === 1) conditions.push(eq(cases.journeyState, stateList[0]));
    else if (stateList.length > 1) conditions.push(inArray(cases.journeyState, stateList));
    // Perfis da escola (RE, professor, diretor) enxergam só a própria escola, mesmo que o Admin Master
    // libere a fila para eles; médico/núcleo/rede enxergam o município (a lista que recebem dos REs).
    if (!isSuper && actor.schoolId && !NETWORK_LEVEL_ROLES.includes(canonicalRole(actor.role))) {
      conditions.push(eq(students.schoolId, actor.schoolId));
    }

    const list = await db
      .select({
        id: cases.id,
        studentId: cases.studentId,
        tenantId: cases.tenantId,
        schoolId: students.schoolId,
        journeyState: cases.journeyState,
        status: cases.status,
        createdAt: cases.createdAt,
        updatedAt: cases.updatedAt,
        studentCode: students.studentCode,
        birthYear: students.birthYear,
        birthMonth: students.birthMonth,
        grade: students.grade,
        schoolName: schools.name,
        assignedToName: users.name,
        assignedToRole: users.role,
      })
      .from(cases)
      .innerJoin(students, eq(cases.studentId, students.id))
      .leftJoin(schools, eq(students.schoolId, schools.id))
      .leftJoin(users, eq(cases.assignedToId, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(cases.updatedAt));

    // Nome curto ("João S.") só para a equipe do caso e só se a caixinha estiver ligada; senão, só o código.
    const nomes = await carregarNomes(
      actor,
      list.map((c) => ({ studentId: c.studentId, tenantId: c.tenantId, schoolId: c.schoolId, caseId: c.id }))
    );
    if (nomes.size > 0) await auditarLeituraNaFila(actor, actor.tenantId, nomes.size, request);

    return {
      cases: list.map(({ tenantId: _t, schoolId: _s, ...c }) => ({ ...c, studentLabel: nomes.get(c.studentId)?.label ?? null })),
    };
  });

  /**
   * Nome do aluno para a tela do caso. `enabled: false` quando o perfil não tem a caixinha ligada ou não faz parte
   * da equipe daquele caso: a tela cai no fluxo antigo (nome protegido + cofre com justificativa).
   */
  app.get("/api/cases/:caseId/student-identity", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };
    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });

    if (!(await podeVerNomes(actor))) return { enabled: false, fullName: null, label: null };

    const nomes = await carregarNomes(actor, [
      { studentId: visible.student.id, tenantId: visible.student.tenantId, schoolId: visible.student.schoolId, caseId },
    ]);
    const nome = nomes.get(visible.student.id);
    if (!nome) return { enabled: false, fullName: null, label: null };

    await auditarLeituraDoNome(
      actor,
      { tenantId: visible.student.tenantId, studentId: visible.student.id, studentCode: visible.student.studentCode, caseId },
      request
    );
    reply.header("Cache-Control", "no-store");
    return { enabled: true, fullName: nome.fullName, label: nome.label };
  });


  // ── Avaliação do RE (rascunho → enviado → devolvido) ────────────────────

  const reAssessmentBodySchema = z.object({
    payload: z.record(z.string(), z.unknown()),
  });

  app.get("/api/cases/:caseId/re-assessment", async (request, reply) => {
    const actor = await requireCapability(request, reply, "fogap.read");
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };
    const { formCode, completo } = request.query as { formCode?: string; completo?: string };
    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });

    // Bloco de notas do RE: quem não preenche (médico, especialista...) só recebe o sumário.
    // As respostas item a item e os demais formulários (ex.: SNAP-IV do RE) só saem para quem preenche.
    // Médico com o caso encaminhado: leitura integral (somente leitura). Especialista: só o sumário.
    const temLeituraIntegral = await leituraIntegral(actor);
    if (formCode && formCode !== FOGAP_FORM_CODE && !temLeituraIntegral) {
      return reply.status(404).send({ error: "Formulário não encontrado" });
    }

    const conditions = [
      eq(reAssessments.caseId, caseId),
      eq(reAssessments.tenantId, actor.tenantId),
    ];
    conditions.push(eq(reAssessments.formCode, formCode || FOGAP_FORM_CODE));

    const [assessment] = await db
      .select()
      .from(reAssessments)
      .where(and(...conditions))
      .orderBy(desc(reAssessments.createdAt))
      .limit(1);

    let returnReason: string | null = null;
    if (assessment?.status === "devolvido") {
      const [lastTransition] = await db
        .select({ reason: caseTransitions.reason })
        .from(caseTransitions)
        .where(
          and(
            eq(caseTransitions.caseId, caseId),
            eq(caseTransitions.tenantId, actor.tenantId),
            eq(caseTransitions.toState, "rascunho")
          )
        )
        .orderBy(desc(caseTransitions.createdAt))
        .limit(1);
      returnReason = lastTransition?.reason ?? null;
    }

    const integral = temLeituraIntegral && completo === "1";
    const saida =
      assessment && assessment.formCode === FOGAP_FORM_CODE && !integral
        ? { ...assessment, payload: fogapSomenteSumario(assessment.payload) }
        : assessment ?? null;
    reply.header("Cache-Control", "no-store");
    return { assessment: saida, returnReason, somenteSumario: !integral };
  });

  app.post("/api/cases/:caseId/re-assessment", async (request, reply) => {
    const actor = await requireCapability(request, reply, "fogap.fill");
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };
    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });

    const isSuper =
      actor.role === "admin_platform" ||
      actor.role === "adm_master" ||
      isSuperAdminEmail(actor.email);

    const { formCode: formCodeQuery } = request.query as { formCode?: string };
    const formCode = formCodeQuery === SNAP4_FORM_CODE ? SNAP4_FORM_CODE : FOGAP_FORM_CODE;
    const formVersion = formCode === SNAP4_FORM_CODE ? SNAP4_VERSION : FOGAP_VERSION;

    const parse = reAssessmentBodySchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ error: "Payload inválido", issues: parse.error.issues });

    // Verificar se já existe rascunho aberto para este instrumento
    const whereConditions = [
      eq(reAssessments.caseId, caseId),
      eq(reAssessments.formCode, formCode),
    ];
    if (!isSuper) {
      whereConditions.push(eq(reAssessments.tenantId, actor.tenantId));
    }

    const [existing] = await db
      .select({ id: reAssessments.id, status: reAssessments.status })
      .from(reAssessments)
      .where(and(...whereConditions))
      .limit(1);

    // Mesma validação do PUT: sem ela, um rascunho malformado era aceito aqui e derrubava o envio (500).
    const createError = formCode === SNAP4_FORM_CODE
      ? validarPayloadSnap4(parse.data.payload)
      : validarPayloadFogap(parse.data.payload);
    if (createError) return reply.status(400).send({ error: createError });

    if (existing) {
      return reply.status(409).send({
        error: "Já existe uma avaliação para este instrumento neste caso",
        id: existing.id,
        status: existing.status,
      });
    }

    const targetTenantId = visible.caseItem.tenantId || actor.tenantId;

    const [assessment] = await db
      .insert(reAssessments)
      .values({
        tenantId: targetTenantId,
        caseId,
        formCode,
        formVersion,
        status: "rascunho",
        payload: parse.data.payload,
        createdBy: actor.id,
      })
      .returning();

    return reply.status(201).send({ success: true, assessment });
  });

  app.put("/api/cases/:caseId/re-assessment", async (request, reply) => {
    const actor = await requireCapability(request, reply, "fogap.fill");
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };
    const { formCode: formCodeQuery } = request.query as { formCode?: string };
    const formCode = formCodeQuery === SNAP4_FORM_CODE ? SNAP4_FORM_CODE : FOGAP_FORM_CODE;

    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });

    const isSuper =
      actor.role === "admin_platform" ||
      actor.role === "adm_master" ||
      isSuperAdminEmail(actor.email);

    const parse = reAssessmentBodySchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ error: "Payload inválido", issues: parse.error.issues });

    const whereConditions = [
      eq(reAssessments.caseId, caseId),
      eq(reAssessments.formCode, formCode),
    ];
    if (!isSuper) {
      whereConditions.push(eq(reAssessments.tenantId, actor.tenantId));
    }

    const [existing] = await db
      .select()
      .from(reAssessments)
      .where(and(...whereConditions))
      .limit(1);

    if (!existing) return reply.status(404).send({ error: "Avaliação não encontrada" });
    if (existing.status !== "rascunho" && existing.status !== "devolvido") {
      return reply.status(409).send({ error: "Avaliação já enviada — somente leitura. Solicite devolução formal ao médico." });
    }

    const payloadError = formCode === SNAP4_FORM_CODE
      ? validarPayloadSnap4(parse.data.payload)
      : validarPayloadFogap(parse.data.payload);
    if (payloadError) return reply.status(400).send({ error: payloadError });

    const [updated] = await db
      .update(reAssessments)
      .set({ payload: parse.data.payload, updatedAt: new Date() })
      .where(eq(reAssessments.id, existing.id))
      .returning();

    return { success: true, assessment: updated };
  });

  app.post("/api/cases/:caseId/re-assessment/submit", async (request, reply) => {
    const actor = await requireCapability(request, reply, "fogap.fill");
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };
    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });

    const isSuper =
      actor.role === "admin_platform" ||
      actor.role === "adm_master" ||
      isSuperAdminEmail(actor.email);

    const whereConditions = [
      eq(reAssessments.caseId, caseId),
      eq(reAssessments.formCode, FOGAP_FORM_CODE),
    ];
    if (!isSuper) {
      whereConditions.push(eq(reAssessments.tenantId, actor.tenantId));
    }

    const [existing] = await db
      .select()
      .from(reAssessments)
      .where(and(...whereConditions))
      .limit(1);

    // Formulário único A→I: campos em branco são permitidos (regra da Dra. Ana Cecília), mas o RE precisa ver a lista
    // do que falta e confirmar. O servidor confere, não só a tela.
    const confirmou = z.object({ confirmarLacunas: z.boolean().optional() }).safeParse(request.body ?? {});
    const confirmarLacunas = confirmou.success && confirmou.data.confirmarLacunas === true;
    const jornada = await carregarJornada(visible.caseItem.tenantId, caseId);
    const lacunas = jornada.situacao.lacunas;
    // Campos obrigatórios (Formulário I completo, mínimo de caracteres, ATA enviada) não passam nem com "enviar assim mesmo".
    const bloqueantes = lacunas.filter((l) => l.bloqueante);
    if (bloqueantes.length > 0) {
      return reply.status(422).send({
        code: "LACUNAS_BLOQUEANTES",
        error: `Faltam ${bloqueantes.length} campo(s) obrigatório(s). Preencha-os para enviar ao médico.`,
        total: bloqueantes.length,
        lacunas, // a lista completa; as obrigatórias vêm com bloqueante: true
      });
    }
    if (lacunas.length > 0 && !confirmarLacunas) {
      return reply.status(422).send({
        code: "LACUNAS",
        error: `Faltam ${lacunas.length} campo(s) sem resposta. Revise a lista ou confirme o envio assim mesmo.`,
        total: lacunas.length,
        lacunas,
      });
    }

    if (existing && existing.status !== "rascunho" && existing.status !== "devolvido") {
      return reply.status(409).send({ error: "Avaliação já enviada" });
    }

    // Idade, grupo e série vêm do cadastro do aluno (recalculados no envio, caso o cadastro tenha sido corrigido).
    const fogapPayload = montarPayloadFogap({ student: visible.student, atual: existing?.payload });

    // Retrato da ATA e do SNAP-IV (opcional) no momento do envio: o médico vê o mesmo número que o RE viu.
    fogapPayload.escalas = await escalasDaJornada(visible.caseItem.tenantId, caseId, jornada);
    const dataError = validarPayloadFogap(fogapPayload);
    if (dataError) return reply.status(422).send({ error: dataError });

    const { pronto, pendencias } = prontoParaRevisao(fogapPayload);
    if (!pronto) {
      return reply.status(422).send({
        error: "Não é possível enviar: confira a data de nascimento do aluno — a idade precisa estar na faixa do piloto (4 a 9 anos e 11 meses).",
        pendencias,
      });
    }

    let submitted!: typeof reAssessments.$inferSelect;

    await db.transaction(async (tx) => {
      const txDb = tx as unknown as AnyDb;

      if (existing) {
        const [updated] = await txDb
          .update(reAssessments)
          .set({ payload: fogapPayload, status: "enviado", submittedAt: new Date(), submittedBy: actor.id, updatedAt: new Date() })
          .where(eq(reAssessments.id, existing.id))
          .returning();
        submitted = updated;
      } else {
        const [created] = await txDb
          .insert(reAssessments)
          .values({
            tenantId: visible.caseItem.tenantId,
            caseId,
            formCode: FOGAP_FORM_CODE,
            formVersion: FOGAP_VERSION,
            status: "enviado",
            payload: fogapPayload,
            createdBy: actor.id,
            submittedAt: new Date(),
            submittedBy: actor.id,
          })
          .returning();
        submitted = created;
      }

      // Os demais formulários da jornada (A a G e o estado da jornada) travam junto com o Sumário.
      await txDb
        .update(reAssessments)
        .set({ status: "enviado", submittedAt: new Date(), submittedBy: actor.id, updatedAt: new Date() })
        .where(
          and(
            eq(reAssessments.caseId, caseId),
            eq(reAssessments.tenantId, visible.caseItem.tenantId),
            inArray(reAssessments.formCode, [RE_JORNADA_FORM_CODE, SNAP4_FORM_CODE, ...Object.values(RE_FORMS).map((f) => f.code)]),
            inArray(reAssessments.status, ["rascunho", "devolvido"])
          )
        );

      await applyTransitionInTx(txDb, caseId, "enviado_re", actor, "RE enviou avaliação FOGAP");
      await applyTransitionInTx(txDb, caseId, "revisao_medica", actor, "Caso encaminhado para revisão médica");
    });

    // Gera sumário estruturado para o próximo profissional (Médico e Núcleo Assistencial)
    const payload = fogapPayload;
    const studentCode = visible.student.studentCode;
    const sumario = payload.secao_sumario ?? {};
    const diffs = Array.isArray(sumario.dificuldades_persistentes) && sumario.dificuldades_persistentes.length > 0
      ? sumario.dificuldades_persistentes.join(", ")
      : "Nenhuma dificuldade adicional reportada";
    const conduta = sumario.conduta === "sim"
      ? `Conduta escolar prévia: ${sumario.qual || "Sim"} (tempo: ${sumario.tempo || "—"}, resultado: ${sumario.resultado || "—"})`
      : "Escola ainda não havia adotado conduta prévia";
    const f1 = sumarioComPadroes(sumario as Partial<FogapSecaoSumario>);
    const destinos = [
      ...FOGAP_DESTINOS.filter((d) => f1.encaminhado?.[d.key]).map((d) => `${d.label} (${f1.encaminhado![d.key]})`),
      ...(f1.encaminhado?.outro_nome?.trim() ? [`${f1.encaminhado.outro_nome.trim()}${f1.encaminhado.outro ? ` (${f1.encaminhado.outro})` : ""}`] : []),
    ];
    const [escolaDoCaso] = await db.select({ name: schools.name }).from(schools).where(eq(schools.id, visible.student.schoolId)).limit(1);
    const caseSummary = `[Sumário do Caso pelo Responsável Escolar (RE)]
Aluno: ${studentCode} | Nascimento: ${String(visible.student.birthMonth ?? "").padStart(2, "0")}/${visible.student.birthYear ?? "—"} | Série: ${f1.serie?.trim() || "não informada"} | Escola: ${escolaDoCaso?.name ?? "—"} | Grupo FOGAP: ${payload.grupo ?? "Piloto"}
Queixa do professor: ${f1.queixa_professor?.trim() || "não informada"}
Hipótese do RE (registro do profissional): ${f1.hipotese_espectro?.trim() || "não informada"}
Dificuldades persistentes: ${diffs}
Encaminhado a: ${destinos.length ? destinos.join("; ") : "sem destino registrado"}
Histórico de intervenção escolar: ${conduta}
Jornada do RE: ${lacunas.length === 0 ? "todos os campos respondidos" : `${lacunas.length} campo(s) em branco, enviados com confirmação do RE`}; G (SNAP-IV) ${jornada.situacao.passos.find((p) => p.id === "g")?.estado === "pulado" ? "não aplicado (opcional)" : "aplicado ou em branco"}; H (ATA) ${jornada.situacao.passos.find((p) => p.id === "h")?.estado === "aguardando_responsavel" ? "aguardando o responsável" : "registrada"}.
Encaminhamento: Triagem escolar finalizada. Aluno encaminhado para avaliação diagnóstica pelo Médico (MD) e acompanhamento sociofamiliar pelo Assistente Social (AS).`;


    const targetTenantId = visible.caseItem.tenantId || actor.tenantId;

    // Registra evento imutável na trilha de auditoria
    await recordAudit(
      {
        tenantId: targetTenantId,
        userId: actor.id,
        userEmail: actor.email,
        action: "re_assessment.submit_and_summarize",
        entityType: "case",
        entityId: caseId,
        payload: {
          studentCode,
          summary: caseSummary,
          grupo: payload.grupo,
          lacunas: lacunas.length,
          confirmouLacunas: lacunas.length > 0 ? confirmarLacunas : false,
        },
      },
      request
    );

    // Notifica RE que enviou (transitória) + médico do caso (persistente)
    const eventBase = `protocolo.enviado:${submitted.id}`;
    await notificar({
      tenantId: targetTenantId,
      eventId: `${eventBase}:re`,
      eventType: "protocolo.enviado",
      recipientId: actor.id,
      caseId,
      instrument: submitted.formCode,
      studentCode,
      transient: true,
    });

    // Notifica médico(s) do tenant com role md1
    const medicos = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, targetTenantId), eq(users.role, "md1")));
    for (const medico of medicos) {
      await notificar({
        tenantId: targetTenantId,
        eventId: `${eventBase}:md1:${medico.id}`,
        eventType: "protocolo.enviado",
        recipientId: medico.id,
        caseId,
        instrument: submitted.formCode,
        studentCode,
        transient: false,
      });
    }

    return {
      success: true,
      assessment: submitted!,
      summary: caseSummary,
      message: "Avaliação enviada. Caso sumarizado e encaminhado ao médico e ao núcleo assistencial.",
    };
  });


  // ── Delegação (md1 apenas) ──────────────────────────────────────────────

  const VALID_SPECIALTIES_SET = new Set<string>(VALID_SPECIALTIES);

  const delegateSchema = z.object({
    delegations: z.array(
      z.object({
        specialty: z.string().refine((s) => VALID_SPECIALTIES_SET.has(s), { message: "Especialidade inválida" }),
        professionalId: z.string().uuid(),
        notes: z.string().optional(),
      })
    ).min(1),
    reason: z.string().min(1),
    // Decisão do médico (Dra., 07/out/2026): 1 = precisa de avaliação neuropsicológica, 0 = não. Sem ordem automática.
    needsNeuropsych: z.boolean().optional(),
  });

  app.post("/api/cases/:caseId/delegate", async (request, reply) => {
    const actor = await requireCapability(request, reply, "case.delegate");
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };
    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });

    // Primeira delegação: revisão médica → delegado. Depois disso o médico ainda pode acrescentar especialistas
    // de especialidades que ainda não foram designadas (o caso continua "delegado", sem nova transição).
    const estadoAtual = visible.caseItem.journeyState;
    if (estadoAtual !== "revisao_medica" && estadoAtual !== "delegado") {
      return reply.status(409).send({ error: "Delegação disponível quando o caso está em revisão médica ou já delegado" });
    }

    const parse = delegateSchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ error: "Dados inválidos", issues: parse.error.issues });

    const { delegations, reason, needsNeuropsych } = parse.data;

    if (estadoAtual === "delegado") {
      const jaDesignadas = await db
        .select({ specialty: caseSummaries.specialty })
        .from(caseSummaries)
        .where(and(eq(caseSummaries.caseId, caseId), eq(caseSummaries.tenantId, actor.tenantId)));
      const repetidas = delegations.map((d) => d.specialty).filter((sp) => jaDesignadas.some((j) => j.specialty === sp));
      if (repetidas.length > 0) {
        return reply.status(409).send({ error: `Especialidade já designada neste caso: ${[...new Set(repetidas)].join(", ")}` });
      }
    }

    await db.transaction(async (tx) => {
      const txDb = tx as unknown as AnyDb;

      for (const d of delegations) {
        const [professional] = await txDb
          .select({ id: users.id, specialty: users.specialty })
          .from(users)
          .where(and(eq(users.id, d.professionalId), eq(users.tenantId, actor.tenantId)))
          .limit(1);

        if (!professional) {
          throw Object.assign(new Error(`Profissional '${d.professionalId}' não pertence ao município`), { status: 400 });
        }

        await txDb.insert(caseSummaries).values({
          caseId: visible.caseItem.id,
          tenantId: actor.tenantId,
          schoolId: visible.student.schoolId,
          specialty: d.specialty,
          assignedProfessionalId: professional.id,
          status: "pendente",
          notes: d.notes,
        });
      }

      if (estadoAtual === "revisao_medica") {
        await applyTransitionInTx(txDb, caseId, "delegado", actor, reason);
      } else {
        await txDb.insert(caseTimeline).values({
          tenantId: actor.tenantId,
          caseId,
          actorId: actor.id,
          event: "case:delegation_added",
          payload: { specialties: delegations.map((d) => d.specialty), reason, actorRole: actor.role },
        });
      }

      if (needsNeuropsych !== undefined) {
        await txDb.insert(caseTimeline).values({
          tenantId: actor.tenantId,
          caseId,
          actorId: actor.id,
          event: "case:neuropsych_decision",
          payload: { precisaAvaliacaoNeuropsicologica: needsNeuropsych ? 1 : 0, actorRole: actor.role },
        });
      }
    });

    // Notifica cada especialista designado
    for (const d of delegations) {
      await notificar({
        tenantId: actor.tenantId,
        eventId: `delegacao.criada:${caseId}:${d.specialty}:${d.professionalId}`,
        eventType: "delegacao.criada",
        recipientId: d.professionalId,
        caseId,
        specialty: d.specialty,
        studentCode: visible.student.studentCode,
        transient: false,
      });
    }

    return reply.status(201).send({ success: true, delegationsCount: delegations.length });
  });

  // ── Devolução ao RE (md1 apenas) ────────────────────────────────────────

  const returnSchema = z.object({
    reason: z.string().min(1, "Motivo é obrigatório"),
  });

  app.post("/api/cases/:caseId/return", async (request, reply) => {
    const actor = await requireCapability(request, reply, "case.return");
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };
    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });

    if (visible.caseItem.journeyState !== "revisao_medica") {
      return reply.status(409).send({ error: "Devolução disponível apenas quando o caso está em revisão médica" });
    }

    const parse = returnSchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ error: "Dados inválidos", issues: parse.error.issues });

    const { reason } = parse.data;

    await db.transaction(async (tx) => {
      const txDb = tx as unknown as AnyDb;

      // Marca a avaliação RE como devolvida
      await txDb
        .update(reAssessments)
        .set({ status: "devolvido", updatedAt: new Date() })
        .where(and(eq(reAssessments.caseId, caseId), eq(reAssessments.tenantId, actor.tenantId)));

      await applyTransitionInTx(txDb, caseId, "rascunho", actor, reason);
    });

    // Notifica RE do caso (persistente)
    const [reAssessment] = await db
      .select({ createdBy: reAssessments.createdBy, formCode: reAssessments.formCode })
      .from(reAssessments)
      .where(and(eq(reAssessments.caseId, caseId), eq(reAssessments.tenantId, actor.tenantId)))
      .limit(1);

    if (reAssessment) {
      await notificar({
        tenantId: actor.tenantId,
        eventId: `protocolo.devolvido:${caseId}`,
        eventType: "protocolo.devolvido",
        recipientId: reAssessment.createdBy,
        caseId,
        instrument: reAssessment.formCode,
        studentCode: visible.student.studentCode,
        transient: false,
      });
    }

    return { success: true, message: "Caso devolvido ao RE para revisão." };
  });

  // ── Seções do especialista ──────────────────────────────────────────────

  app.get("/api/cases/my-delegated-sections", async (request, reply) => {
    const actor = await requireCapability(request, reply, "section.read");
    if (!actor) return;

    const sections = await db
      .select({
        id: caseSummaries.id,
        caseId: caseSummaries.caseId,
        specialty: caseSummaries.specialty,
        status: caseSummaries.status,
        notes: caseSummaries.notes,
        summary: caseSummaries.summary,
        updatedAt: caseSummaries.updatedAt,
        studentCode: students.studentCode,
        birthYear: students.birthYear,
      })
      .from(caseSummaries)
      .innerJoin(cases, eq(caseSummaries.caseId, cases.id))
      .innerJoin(students, eq(cases.studentId, students.id))
      .where(
        and(
          eq(caseSummaries.assignedProfessionalId, actor.id),
          eq(caseSummaries.tenantId, actor.tenantId)
        )
      );

    return { assignedSections: sections };
  });

  // Contexto do caso para o especialista: SOMENTE o sumário executivo do médico (ver specialist-view.service).
  // Não devolve FOGAP, avaliação do RE, seções de colegas nem a decisão de encerramento.
  app.get("/api/cases/:caseId/specialist-view", async (request, reply) => {
    const actor = await requireCapability(request, reply, "section.read");
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };

    // Só quem tem seção atribuída neste caso (mesmo tenant) enxerga o contexto
    const minhas = await db
      .select({ id: caseSummaries.id })
      .from(caseSummaries)
      .where(
        and(
          eq(caseSummaries.caseId, caseId),
          eq(caseSummaries.tenantId, actor.tenantId),
          eq(caseSummaries.assignedProfessionalId, actor.id)
        )
      )
      .limit(1);
    if (minhas.length === 0) {
      return reply.status(403).send({ error: "Sem seção atribuída neste caso" });
    }

    const [caseItem] = await db
      .select({ id: cases.id, studentId: cases.studentId, journeyState: cases.journeyState })
      .from(cases)
      .where(and(eq(cases.id, caseId), eq(cases.tenantId, actor.tenantId)))
      .limit(1);
    if (!caseItem) return reply.status(404).send({ error: "Caso não encontrado" });

    const [student] = await db
      .select({ studentCode: students.studentCode, birthYear: students.birthYear })
      .from(students)
      .where(eq(students.id, caseItem.studentId))
      .limit(1);

    const [sumarioMedico] = await db
      .select({
        status: caseMedicalForms.status,
        payload: caseMedicalForms.payload,
        completedAt: caseMedicalForms.completedAt,
      })
      .from(caseMedicalForms)
      .where(
        and(
          eq(caseMedicalForms.caseId, caseId),
          eq(caseMedicalForms.tenantId, actor.tenantId),
          eq(caseMedicalForms.formId, SUMARIO_MEDICO_FORM_ID)
        )
      )
      .limit(1);

    await db.insert(auditLogs).values({
      tenantId: actor.tenantId,
      actorId: actor.id,
      action: "specialist-view:read",
      entity: "case",
      entityId: caseId,
    });

    return {
      student,
      journeyState: caseItem.journeyState,
      sumarioExecutivoMedico: sumarioExecutivoMedico(sumarioMedico),
    };
  });

  const sectionPatchSchema = z
    .object({
      summary: z.record(z.string(), z.unknown()).optional(),
      notes: z.string().optional(),
      markAsCompleted: z.boolean().optional(),
    })
    .refine(
      (data) => {
        if (typeof data.notes === "string" && data.notes.trim().length > 0) {
          return data.notes.trim().length >= 100;
        }
        return true;
      },
      {
        message: "O parecer clínico deve conter no mínimo 100 caracteres para fundamentação técnica adequada.",
        path: ["notes"],
      }
    );

  app.patch("/api/cases/sections/:sectionId", async (request, reply) => {
    const actor = await requireCapability(request, reply, "section.fill");
    if (!actor) return;

    const { sectionId } = request.params as { sectionId: string };

    const [section] = await db
      .select()
      .from(caseSummaries)
      .where(and(eq(caseSummaries.id, sectionId), eq(caseSummaries.tenantId, actor.tenantId)))
      .limit(1);

    if (!section) return reply.status(404).send({ error: "Seção não encontrada" });

    if (section.assignedProfessionalId !== actor.id) {
      return reply.status(403).send({ error: "Você só pode editar seções atribuídas ao seu perfil" });
    }

    if (section.status === "concluido") {
      return reply.status(409).send({ error: "Seção já concluída — somente leitura" });
    }

    const parse = sectionPatchSchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ error: "Dados inválidos", issues: parse.error.issues });

    const { summary, notes, markAsCompleted } = parse.data;
    const newStatus = markAsCompleted ? "concluido" : "em_andamento";

    let allDone = false;

    await db.transaction(async (tx) => {
      const txDb = tx as unknown as AnyDb;

      await txDb
        .update(caseSummaries)
        .set({
          summary,
          notes,
          status: newStatus,
          completedAt: markAsCompleted ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(caseSummaries.id, section.id));

      await txDb.insert(caseTimeline).values({
        tenantId: actor.tenantId,
        caseId: section.caseId,
        actorId: actor.id,
        event: markAsCompleted ? "section:completed" : "section:updated",
        payload: { sectionId: section.id, specialty: section.specialty, actorRole: actor.role },
      });

      if (markAsCompleted) {
        allDone = await allSectionsDone(txDb, section.caseId, actor.tenantId);
        if (allDone) {
          await applyTransitionInTx(
            txDb,
            section.caseId,
            "retornado",
            actor,
            "Todas as seções delegadas foram concluídas"
          );
        }
      }
    });

    // Notifica médico(s) quando especialista conclui seção
    if (markAsCompleted) {
      const [caseRow] = await db
        .select({ studentId: cases.studentId })
        .from(cases)
        .where(and(eq(cases.id, section.caseId), eq(cases.tenantId, actor.tenantId)))
        .limit(1);

      let studentCode: string | undefined;
      if (caseRow?.studentId) {
        const [stu] = await db
          .select({ studentCode: students.studentCode })
          .from(students)
          .where(eq(students.id, caseRow.studentId))
          .limit(1);
        studentCode = stu?.studentCode ?? undefined;
      }

      const medicos = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.tenantId, actor.tenantId), eq(users.role, "md1")));

      const eventType = allDone ? "delegacao.todas_devolvidas" : "delegacao.devolvida";
      for (const medico of medicos) {
        await notificar({
          tenantId: actor.tenantId,
          eventId: `${eventType}:${section.caseId}:${section.specialty}:${medico.id}`,
          eventType,
          recipientId: medico.id,
          caseId: section.caseId,
          specialty: section.specialty,
          studentCode,
        });
      }
    }

    return { success: true, newStatus };
  });

  // ── Consolidado (md1 apenas) ─────────────────────────────────────────────

  app.get("/api/cases/:caseId/consolidated", async (request, reply) => {
    const actor = await requireCapability(request, reply, "prontuario.consolidado.read");
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };
    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });

    const [assessment] = await db
      .select()
      .from(reAssessments)
      .where(and(eq(reAssessments.caseId, caseId), eq(reAssessments.tenantId, actor.tenantId), eq(reAssessments.formCode, FOGAP_FORM_CODE)))
      .limit(1);

    const [escolaConsolidado] = await db.select({ name: schools.name }).from(schools).where(eq(schools.id, visible.student.schoolId)).limit(1);

    const sections = await db
      .select({
        id: caseSummaries.id,
        specialty: caseSummaries.specialty,
        status: caseSummaries.status,
        summary: caseSummaries.summary,
        notes: caseSummaries.notes,
        completedAt: caseSummaries.completedAt,
        professionalName: users.name,
        professionalRole: users.role,
        professionalClassCode: users.classCode,
      })
      .from(caseSummaries)
      .leftJoin(users, eq(caseSummaries.assignedProfessionalId, users.id))
      .where(and(eq(caseSummaries.caseId, caseId), eq(caseSummaries.tenantId, actor.tenantId)));

    // Auditoria de leitura do consolidado (append-only)
    await db.insert(auditLogs).values({
      tenantId: actor.tenantId,
      actorId: actor.id,
      action: "consolidated:read",
      entity: "case",
      entityId: caseId,
    });

    return {
      case: visible.caseItem,
      student: {
        studentCode: visible.student.studentCode,
        birthYear: visible.student.birthYear,
        birthMonth: visible.student.birthMonth,
        grade: visible.student.grade ?? null,
        schoolName: escolaConsolidado?.name ?? null,
      },
      reAssessment: assessment ?? null, // médico: leitura integral do que a escola registrou
      sections: apenasConcluidasComConteudo(sections),
    };
  });

  // ── Encerramento (md1 apenas) ────────────────────────────────────────────

  // Opções confirmadas pela Dra. (07/out/2026). Só o médico encerra; acompanhamento é semestral ou anual até a alta.
  const closeSchema = z
    .object({
      decision: z.enum(["encaminhamento", "acompanhamento", "alta", "abandono", "interrupcao_justificada"]),
      followUp: z.enum(["semestral", "anual"]).optional(),
      reason: z.string().trim().min(10, "Justificativa clínica deve ter pelo menos 10 caracteres."),
    })
    .refine((d) => d.decision !== "acompanhamento" || !!d.followUp, {
      message: "Informe a periodicidade do acompanhamento (semestral ou anual).",
      path: ["followUp"],
    });

  app.post("/api/cases/:caseId/close", async (request, reply) => {
    const actor = await requireCapability(request, reply, "case.close");
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };
    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });

    if (visible.caseItem.journeyState !== "retornado") {
      return reply.status(409).send({ error: "Encerramento disponível apenas quando o caso está no estado 'retornado' (todos os especialistas devem ter concluído seus pareceres)" });
    }

    const parse = closeSchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ error: "Dados inválidos", issues: parse.error.issues });

    const { decision, reason, followUp } = parse.data;

    await db.transaction(async (tx) => {
      const txDb = tx as unknown as AnyDb;

      await applyTransitionInTx(txDb, caseId, "encerrado", actor, reason);

      // Registra decisão clínica na timeline
      // Alta é decisão exclusiva do médico; nenhuma lógica aqui infere alta de escore
      await txDb.insert(caseTimeline).values({
        tenantId: actor.tenantId,
        caseId,
        actorId: actor.id,
        event: "case:closed",
        payload: { decision, followUp: decision === "acompanhamento" ? followUp : undefined, reason, actorRole: actor.role },
      });
    });

    return { success: true, decision, followUp, message: "Caso encerrado com sucesso." };
  });

  // ── Trilha de eventos (md1 apenas, paginada) ─────────────────────────────

  app.get("/api/cases/:caseId/events", async (request, reply) => {
    const actor = await requireCapability(request, reply, "case.events.read");
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };
    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });

    const query = request.query as { page?: string; limit?: string };
    const page = Math.max(1, parseInt(query.page ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? "20", 10)));
    const offset = (page - 1) * limit;

    const events = await db
      .select({
        id: caseTimeline.id,
        event: caseTimeline.event,
        payload: caseTimeline.payload,
        createdAt: caseTimeline.createdAt,
        actorName: users.name,
        actorRole: users.role,
      })
      .from(caseTimeline)
      .leftJoin(users, eq(caseTimeline.actorId, users.id))
      .where(and(eq(caseTimeline.caseId, caseId), eq(caseTimeline.tenantId, actor.tenantId)))
      .orderBy(desc(caseTimeline.createdAt))
      .limit(limit)
      .offset(offset);

    return { events, page, limit };
  });

  // ── (Mantido para retrocompatibilidade temporária) ───────────────────────
  // TODO: remover após frontend migrar para /consolidated
  app.get("/api/cases/:caseId/full-summary", async (request, reply) => {
    const actor = await requireCapability(request, reply, "prontuario.full_summary.read");
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };
    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });

    const sections = await db
      .select({
        id: caseSummaries.id,
        specialty: caseSummaries.specialty,
        status: caseSummaries.status,
        summary: caseSummaries.summary,
        notes: caseSummaries.notes,
        completedAt: caseSummaries.completedAt,
        professionalName: users.name,
        professionalRole: users.role,
        professionalClassCode: users.classCode,
      })
      .from(caseSummaries)
      .leftJoin(users, eq(caseSummaries.assignedProfessionalId, users.id))
      .where(and(eq(caseSummaries.caseId, visible.caseItem.id), eq(caseSummaries.tenantId, actor.tenantId)));

    return { case: visible.caseItem, student: visible.student, sections: apenasConcluidasComConteudo(sections) };
  });
}
