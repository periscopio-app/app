import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import {
  auditLogs,
  caseSummaries,
  caseTimeline,
  cases,
  reAssessments,
  schools,
  students,
  users,
} from "@periscopio/shared";
import { requireActor, type Actor } from "../security/actor";
import { canAccessSchool } from "../security/tenancy";
import { SPECIALIST_CLINICAL_ROLES } from "../security/roles";
import { ageBracketOf, generateStudentCode, validateBirth } from "../services/student-code";
import { filterPeerSections, medicalFinalSummary } from "../services/specialist-view.service";
import {
  FOGAP_FORM_CODE,
  FOGAP_VERSION,
  prontoParaRevisao,
  validarPayloadFogap,
  type FogapPayload,
  SNAP4_FORM_CODE,
  SNAP4_VERSION,
  validarPayloadSnap4,
} from "@periscopio/shared";
import {
  allSectionsDone,
  applyTransitionInTx,
  transitionCase,
  type JourneyState,
} from "../services/case-state.service";
import { notificar } from "../services/notifications.service";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@periscopio/shared";

type AnyDb = NodePgDatabase<typeof schema>;

const schoolMgmtRoles = ["admin_platform", "municipal_manager", "school_manager", "ppi"] as const;

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

async function caseVisibleTo(actor: Actor, caseId: string) {
  const [caseItem] = await db
    .select()
    .from(cases)
    .where(and(eq(cases.id, caseId), eq(cases.tenantId, actor.tenantId)))
    .limit(1);
  if (!caseItem) return null;
  const student = await studentVisibleTo(actor, caseItem.studentId);
  return student ? { caseItem, student } : null;
}

async function insertStudent(school: { id: string; tenantId: string; slug: string | null }, birthYear: number, birthMonth: number) {
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
    const actor = await requireActor(request, reply, schoolMgmtRoles);
    if (!actor) return;

    const body = (request.body ?? {}) as { schoolId?: string; birthYear?: number; birthMonth?: number };
    if (!body.schoolId) return reply.status(400).send({ error: "ID da escola é obrigatório" });

    const school = await schoolVisibleTo(actor, body.schoolId);
    if (!school) return reply.status(404).send({ error: "Escola não encontrada" });

    const birth = validateBirth(body);
    if (!birth.ok) return reply.status(400).send({ error: birth.error });

    const student = await insertStudent(school, birth.birthYear, birth.birthMonth);
    return reply.status(201).send({ success: true, student });
  });

  // Importação em lote (planilha/colar): só ano e mês de nascimento — nenhum dado de identificação.
  app.post("/api/schools/:schoolId/students/bulk", async (request, reply) => {
    const actor = await requireActor(request, reply, schoolMgmtRoles);
    if (!actor) return;
    const { schoolId } = request.params as { schoolId: string };
    const school = await schoolVisibleTo(actor, schoolId);
    if (!school) return reply.status(404).send({ error: "Escola não encontrada" });

    const rows = (request.body as { students?: Record<string, unknown>[] } | undefined)?.students;
    if (!Array.isArray(rows) || rows.length === 0) return reply.status(400).send({ error: "Envie ao menos um aluno" });
    if (rows.length > 500) return reply.status(400).send({ error: "Máximo de 500 alunos por importação" });

    const errors: { row: number; error: string }[] = [];
    const valid: { birthYear: number; birthMonth: number }[] = [];
    rows.forEach((r, i) => {
      const extra = Object.keys(r ?? {}).filter((k) => k !== "birthYear" && k !== "birthMonth");
      if (extra.length > 0) {
        errors.push({ row: i + 1, error: `Campo não permitido: ${extra.join(", ")}. Envie só ano e mês de nascimento.` });
        return;
      }
      const b = validateBirth(r ?? {});
      if (!b.ok) errors.push({ row: i + 1, error: b.error });
      else valid.push({ birthYear: b.birthYear, birthMonth: b.birthMonth });
    });
    if (errors.length > 0) return reply.status(400).send({ error: "Planilha com erros; nada foi importado", errors: errors.slice(0, 20) });

    const created = [];
    for (const v of valid) created.push(await insertStudent(school, v.birthYear, v.birthMonth));
    return reply.status(201).send({ success: true, imported: created.length, students: created });
  });

  app.get("/api/schools/:schoolId/students", async (request, reply) => {
    const actor = await requireActor(request, reply, schoolMgmtRoles);
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
    const actor = await requireActor(request, reply, schoolMgmtRoles);
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

  // ── Casos ───────────────────────────────────────────────────────────────

  app.post("/api/cases", async (request, reply) => {
    const actor = await requireActor(request, reply, schoolMgmtRoles);
    if (!actor) return;

    const body = request.body as { studentId?: string; dataInicioIntervencao?: string };
    if (!body.studentId) return reply.status(400).send({ error: "ID do aluno é obrigatório" });

    const student = await studentVisibleTo(actor, body.studentId);
    if (!student) return reply.status(404).send({ error: "Aluno não encontrado" });

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

    return reply.status(201).send({ success: true, case: caseItem });
  });

  app.get("/api/cases", async (request, reply) => {
    const actor = await requireActor(request, reply, ["ppi", "md1", "specialist", "board"]);
    if (!actor) return;

    const query = request.query as { states?: string };
    const stateList = query.states
      ? (query.states.split(",").map((s) => s.trim()).filter(Boolean) as JourneyState[])
      : [];

    const conditions = [eq(cases.tenantId, actor.tenantId)];
    if (stateList.length === 1) conditions.push(eq(cases.journeyState, stateList[0]));
    else if (stateList.length > 1) conditions.push(inArray(cases.journeyState, stateList));
    if (actor.role === "specialist") {
      // Especialista só vê casos em que tem seção atribuída — retorna via my-delegated-sections
      return reply.status(403).send({ error: "Especialistas usam /api/cases/my-delegated-sections" });
    }

    const list = await db
      .select({
        id: cases.id,
        journeyState: cases.journeyState,
        status: cases.status,
        createdAt: cases.createdAt,
        updatedAt: cases.updatedAt,
        studentCode: students.studentCode,
        birthYear: students.birthYear,
        birthMonth: students.birthMonth,
      })
      .from(cases)
      .innerJoin(students, eq(cases.studentId, students.id))
      .where(and(...conditions))
      .orderBy(desc(cases.updatedAt));

    return { cases: list };
  });

  // ── Avaliação do RE (rascunho → enviado → devolvido) ────────────────────

  const reAssessmentBodySchema = z.object({
    payload: z.record(z.unknown()),
  });

  app.get("/api/cases/:caseId/re-assessment", async (request, reply) => {
    const actor = await requireActor(request, reply, ["ppi", "md1"]);
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };
    const { formCode } = request.query as { formCode?: string };
    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });

    const conditions = [
      eq(reAssessments.caseId, caseId),
      eq(reAssessments.tenantId, actor.tenantId),
    ];
    if (formCode) conditions.push(eq(reAssessments.formCode, formCode));

    const [assessment] = await db
      .select()
      .from(reAssessments)
      .where(and(...conditions))
      .orderBy(desc(reAssessments.createdAt))
      .limit(1);

    return { assessment: assessment ?? null };
  });

  app.post("/api/cases/:caseId/re-assessment", async (request, reply) => {
    const actor = await requireActor(request, reply, ["ppi"]);
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };
    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });

    const { formCode: formCodeQuery } = request.query as { formCode?: string };
    const formCode = formCodeQuery === SNAP4_FORM_CODE ? SNAP4_FORM_CODE : FOGAP_FORM_CODE;
    const formVersion = formCode === SNAP4_FORM_CODE ? SNAP4_VERSION : FOGAP_VERSION;

    const parse = reAssessmentBodySchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ error: "Payload inválido", issues: parse.error.issues });

    // Verificar se já existe rascunho aberto para este instrumento
    const [existing] = await db
      .select({ id: reAssessments.id, status: reAssessments.status })
      .from(reAssessments)
      .where(
        and(
          eq(reAssessments.caseId, caseId),
          eq(reAssessments.tenantId, actor.tenantId),
          eq(reAssessments.formCode, formCode)
        )
      )
      .limit(1);

    if (existing) {
      return reply.status(409).send({
        error: "Já existe uma avaliação para este instrumento neste caso",
        id: existing.id,
        status: existing.status,
      });
    }

    const [assessment] = await db
      .insert(reAssessments)
      .values({
        tenantId: actor.tenantId,
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
    const actor = await requireActor(request, reply, ["ppi"]);
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };
    const { formCode: formCodeQuery } = request.query as { formCode?: string };
    const formCode = formCodeQuery === SNAP4_FORM_CODE ? SNAP4_FORM_CODE : FOGAP_FORM_CODE;

    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });

    const parse = reAssessmentBodySchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ error: "Payload inválido", issues: parse.error.issues });

    const [existing] = await db
      .select()
      .from(reAssessments)
      .where(
        and(
          eq(reAssessments.caseId, caseId),
          eq(reAssessments.tenantId, actor.tenantId),
          eq(reAssessments.formCode, formCode)
        )
      )
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
    const actor = await requireActor(request, reply, ["ppi"]);
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };
    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });

    const [existing] = await db
      .select()
      .from(reAssessments)
      .where(
        and(
          eq(reAssessments.caseId, caseId),
          eq(reAssessments.tenantId, actor.tenantId),
          eq(reAssessments.formCode, FOGAP_FORM_CODE)
        )
      )
      .limit(1);

    if (!existing) return reply.status(404).send({ error: "Nenhuma avaliação em rascunho para enviar" });
    if (existing.status !== "rascunho" && existing.status !== "devolvido") {
      return reply.status(409).send({ error: "Avaliação já enviada" });
    }

    // Valida prontoParaRevisao — todos os itens do grupo devem estar respondidos
    const { pronto, pendencias } = prontoParaRevisao(existing.payload as FogapPayload);
    if (!pronto) {
      return reply.status(422).send({
        error: "Não é possível enviar: informe a idade da criança e confirme que ela está na faixa do piloto.",
        pendencias,
      });
    }

    let submitted: typeof existing;

    await db.transaction(async (tx) => {
      const txDb = tx as unknown as AnyDb;

      const [updated] = await txDb
        .update(reAssessments)
        .set({ status: "enviado", submittedAt: new Date(), submittedBy: actor.id, updatedAt: new Date() })
        .where(eq(reAssessments.id, existing.id))
        .returning();

      submitted = updated;

      await applyTransitionInTx(txDb, caseId, "enviado_re", actor, "RE enviou avaliação FOGAP");
      await applyTransitionInTx(txDb, caseId, "revisao_medica", actor, "Caso encaminhado para revisão médica");
    });

    // Notifica RE que enviou (transitória) + médico do caso (persistente)
    const eventBase = `protocolo.enviado:${existing.id}`;
    const studentCode = visible.student.studentCode;
    await notificar({
      tenantId: actor.tenantId,
      eventId: `${eventBase}:re`,
      eventType: "protocolo.enviado",
      recipientId: actor.id,
      caseId,
      instrument: existing.formCode,
      studentCode,
      transient: true,
    });

    // Notifica médico(s) do tenant com role md1
    const medicos = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, actor.tenantId), eq(users.role, "md1")));
    for (const medico of medicos) {
      await notificar({
        tenantId: actor.tenantId,
        eventId: `${eventBase}:md1:${medico.id}`,
        eventType: "protocolo.enviado",
        recipientId: medico.id,
        caseId,
        instrument: existing.formCode,
        studentCode,
        transient: false,
      });
    }

    return { success: true, assessment: submitted!, message: "Avaliação enviada. Caso encaminhado ao médico." };
  });

  // ── Delegação (md1 apenas) ──────────────────────────────────────────────

  const VALID_SPECIALTIES = new Set([
    "fonoaudiologia",
    "medicina",
    "neuropsicologia",
    "psicologia",
    "psicopedagogia",
    "psicomotricidade",
    "servico_social",
  ]);

  const delegateSchema = z.object({
    delegations: z.array(
      z.object({
        specialty: z.string().refine((s) => VALID_SPECIALTIES.has(s), { message: "Especialidade inválida" }),
        professionalId: z.string().uuid(),
        notes: z.string().optional(),
      })
    ).min(1),
    reason: z.string().min(1),
    // Decisão do médico (Dra., 07/out/2026): 1 = precisa de avaliação neuropsicológica, 0 = não. Sem ordem automática.
    needsNeuropsych: z.boolean().optional(),
  });

  app.post("/api/cases/:caseId/delegate", async (request, reply) => {
    const actor = await requireActor(request, reply, ["md1"]);
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };
    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });

    if (visible.caseItem.journeyState !== "revisao_medica") {
      return reply.status(409).send({ error: "Delegação disponível apenas quando o caso está em revisão médica" });
    }

    const parse = delegateSchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ error: "Dados inválidos", issues: parse.error.issues });

    const { delegations, reason, needsNeuropsych } = parse.data;

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

      await applyTransitionInTx(txDb, caseId, "delegado", actor, reason);

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
    const actor = await requireActor(request, reply, ["md1"]);
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
    const actor = await requireActor(request, reply, SPECIALIST_CLINICAL_ROLES);
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

  // Contexto do caso para o especialista: FOGAP + resumo final do médico e dos demais (ver specialist-view.service)
  app.get("/api/cases/:caseId/specialist-view", async (request, reply) => {
    const actor = await requireActor(request, reply, SPECIALIST_CLINICAL_ROLES);
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };

    const sections = await db
      .select({
        id: caseSummaries.id,
        specialty: caseSummaries.specialty,
        status: caseSummaries.status,
        summary: caseSummaries.summary,
        completedAt: caseSummaries.completedAt,
        assignedProfessionalId: caseSummaries.assignedProfessionalId,
      })
      .from(caseSummaries)
      .where(and(eq(caseSummaries.caseId, caseId), eq(caseSummaries.tenantId, actor.tenantId)));

    // Só quem tem seção atribuída neste caso (mesmo tenant) enxerga o contexto
    if (!sections.some((s) => s.assignedProfessionalId === actor.id)) {
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

    const [assessment] = await db
      .select({ payload: reAssessments.payload, status: reAssessments.status })
      .from(reAssessments)
      .where(and(eq(reAssessments.caseId, caseId), eq(reAssessments.tenantId, actor.tenantId)))
      .limit(1);

    const [closed] = await db
      .select({ payload: caseTimeline.payload, createdAt: caseTimeline.createdAt })
      .from(caseTimeline)
      .where(and(eq(caseTimeline.caseId, caseId), eq(caseTimeline.tenantId, actor.tenantId), eq(caseTimeline.event, "case:closed")))
      .orderBy(desc(caseTimeline.createdAt))
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
      fogap: assessment ? { status: assessment.status, payload: assessment.payload } : null,
      peerSections: filterPeerSections(sections, actor.id),
      medicalFinalSummary: closed ? { ...medicalFinalSummary(closed.payload), closedAt: closed.createdAt } : null,
    };
  });

  const sectionPatchSchema = z.object({
    summary: z.record(z.unknown()).optional(),
    notes: z.string().optional(),
    markAsCompleted: z.boolean().optional(),
  });

  app.patch("/api/cases/sections/:sectionId", async (request, reply) => {
    const actor = await requireActor(request, reply, SPECIALIST_CLINICAL_ROLES);
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
    const actor = await requireActor(request, reply, ["md1"]);
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };
    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });

    const [assessment] = await db
      .select()
      .from(reAssessments)
      .where(and(eq(reAssessments.caseId, caseId), eq(reAssessments.tenantId, actor.tenantId)))
      .limit(1);

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
      student: { studentCode: visible.student.studentCode, birthYear: visible.student.birthYear },
      reAssessment: assessment ?? null,
      sections,
    };
  });

  // ── Encerramento (md1 apenas) ────────────────────────────────────────────

  // Opções confirmadas pela Dra. (07/out/2026). Só o médico encerra; acompanhamento é semestral ou anual até a alta.
  const closeSchema = z
    .object({
      decision: z.enum(["encaminhamento", "acompanhamento", "alta", "abandono", "interrupcao_justificada"]),
      followUp: z.enum(["semestral", "anual"]).optional(),
      reason: z.string().min(1),
    })
    .refine((d) => d.decision !== "acompanhamento" || !!d.followUp, {
      message: "Informe a periodicidade do acompanhamento (semestral ou anual).",
      path: ["followUp"],
    });

  app.post("/api/cases/:caseId/close", async (request, reply) => {
    const actor = await requireActor(request, reply, ["md1"]);
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
    const actor = await requireActor(request, reply, ["md1"]);
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
    const actor = await requireActor(request, reply, ["md1", "board"]);
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

    return { case: visible.caseItem, student: visible.student, sections };
  });
}
