import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { caseSummaries, cases, schools, students, users } from "@periscopio/shared";
import { requireActor, type Actor } from "../security/actor";
import { canAccessSchool } from "../security/tenancy";
import { SPECIALIST_CLINICAL_ROLES } from "../security/roles";

const schoolManagementRoles = ["admin_platform", "municipal_manager", "school_manager", "ppi"] as const;
const clinicalSummaryRoles = ["ppi", "md1", "specialist", "board"] as const;

async function schoolVisibleTo(actor: Actor, schoolId: string) {
  const [school] = await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1);
  if (!school || !canAccessSchool(actor, school.tenantId, school.id)) return null;
  return school;
}

async function studentVisibleTo(actor: Actor, studentId: string) {
  const [student] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
  if (!student || !canAccessSchool(actor, student.tenantId, student.schoolId)) return null;
  return student;
}

async function caseVisibleTo(actor: Actor, caseId: string) {
  const [caseItem] = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
  if (!caseItem) return null;
  const student = await studentVisibleTo(actor, caseItem.studentId);
  return student ? { caseItem, student } : null;
}

export async function casesRoutes(app: FastifyInstance) {
  app.post("/api/students", async (request, reply) => {
    const actor = await requireActor(request, reply, schoolManagementRoles);
    if (!actor) return;

    const body = request.body as { schoolId?: string; birthYear?: number };
    if (!body.schoolId) return reply.status(400).send({ error: "ID da escola é obrigatório" });

    const school = await schoolVisibleTo(actor, body.schoolId);
    if (!school) return reply.status(404).send({ error: "Escola não encontrada" });

    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const studentCode = `${school.slug?.substring(0, 4).toUpperCase() || "ESC"}-${new Date().getFullYear()}-${randomSuffix}`;
    const [student] = await db
      .insert(students)
      .values({
        tenantId: school.tenantId,
        schoolId: school.id,
        studentCode,
        birthYear: body.birthYear,
      })
      .returning();

    return reply.status(201).send({ success: true, student });
  });

  app.get("/api/schools/:schoolId/students", async (request, reply) => {
    const actor = await requireActor(request, reply, schoolManagementRoles);
    if (!actor) return;

    const { schoolId } = request.params as { schoolId: string };
    const school = await schoolVisibleTo(actor, schoolId);
    if (!school) return reply.status(404).send({ error: "Escola não encontrada" });

    const studentList = await db
      .select()
      .from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.tenantId, school.tenantId)));
    return { students: studentList };
  });

  app.get("/api/schools/:schoolId/professionals", async (request, reply) => {
    const actor = await requireActor(request, reply, schoolManagementRoles);
    if (!actor) return;

    const { schoolId } = request.params as { schoolId: string };
    const school = await schoolVisibleTo(actor, schoolId);
    if (!school) return reply.status(404).send({ error: "Escola não encontrada" });

    const professionalList = await db
      .select({
        id: users.id,
        name: users.name,
        specialty: users.specialty,
        role: users.role,
        classCode: users.classCode,
      })
      .from(users)
      .where(and(eq(users.schoolId, school.id), eq(users.tenantId, school.tenantId)));
    return { professionals: professionalList };
  });

  app.post("/api/cases", async (request, reply) => {
    const actor = await requireActor(request, reply, schoolManagementRoles);
    if (!actor) return;

    const body = request.body as { studentId?: string; status?: string; dataInicioIntervencao?: string };
    if (!body.studentId) return reply.status(400).send({ error: "ID do aluno é obrigatório" });

    const student = await studentVisibleTo(actor, body.studentId);
    if (!student) return reply.status(404).send({ error: "Aluno não encontrado" });

    const [caseItem] = await db
      .insert(cases)
      .values({
        tenantId: student.tenantId,
        studentId: student.id,
        status: body.status || "triagem",
        dataInicioIntervencao: body.dataInicioIntervencao || new Date().toISOString().split("T")[0],
      })
      .returning();
    return reply.status(201).send({ success: true, case: caseItem });
  });

  app.post("/api/cases/:caseId/delegate", async (request, reply) => {
    const actor = await requireActor(request, reply, ["ppi"]);
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };
    const body = request.body as { delegations?: Array<{ specialty: string; professionalId: string; notes?: string }> };
    if (!body.delegations?.length) return reply.status(400).send({ error: "Informe ao menos uma delegação" });

    const visibleCase = await caseVisibleTo(actor, caseId);
    if (!visibleCase) return reply.status(404).send({ error: "Caso não encontrado" });

    const createdSections = [];
    for (const delegation of body.delegations) {
      const [professional] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, delegation.professionalId), eq(users.tenantId, visibleCase.caseItem.tenantId)))
        .limit(1);
      if (!professional) return reply.status(400).send({ error: "Profissional não pertence ao município do caso" });

      const [section] = await db
        .insert(caseSummaries)
        .values({
          caseId: visibleCase.caseItem.id,
          tenantId: visibleCase.caseItem.tenantId,
          schoolId: visibleCase.student.schoolId,
          specialty: delegation.specialty,
          assignedProfessionalId: professional.id,
          status: "pendente",
          notes: delegation.notes,
        })
        .returning();
      createdSections.push(section);
    }
    return reply.status(201).send({ success: true, sections: createdSections });
  });

  // Endpoints estritamente clínicos — Apenas especialistas e papéis clínicos autorizados
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
      .where(and(eq(caseSummaries.assignedProfessionalId, actor.id), eq(caseSummaries.tenantId, actor.tenantId)));
    return { assignedSections: sections };
  });

  app.patch("/api/cases/sections/:sectionId", async (request, reply) => {
    const actor = await requireActor(request, reply, SPECIALIST_CLINICAL_ROLES);
    if (!actor) return;

    const { sectionId } = request.params as { sectionId: string };
    const body = request.body as { summary?: Record<string, unknown>; notes?: string; markAsCompleted?: boolean };
    const [section] = await db
      .select()
      .from(caseSummaries)
      .where(and(eq(caseSummaries.id, sectionId), eq(caseSummaries.tenantId, actor.tenantId)))
      .limit(1);

    if (!section || section.assignedProfessionalId !== actor.id) {
      return reply.status(403).send({ error: "Acesso negado: você só pode editar seções atribuídas diretamente ao seu perfil profissional" });
    }

    const [updated] = await db
      .update(caseSummaries)
      .set({
        summary: body.summary,
        notes: body.notes,
        status: body.markAsCompleted ? "concluido" : "em_andamento",
        completedAt: body.markAsCompleted ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(caseSummaries.id, section.id))
      .returning();
    return { success: true, section: updated };
  });

  app.get("/api/cases/:caseId/full-summary", async (request, reply) => {
    const actor = await requireActor(request, reply, clinicalSummaryRoles);
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };
    const visibleCase = await caseVisibleTo(actor, caseId);
    if (!visibleCase) return reply.status(404).send({ error: "Caso não encontrado" });

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
      .where(and(eq(caseSummaries.caseId, visibleCase.caseItem.id), eq(caseSummaries.tenantId, visibleCase.caseItem.tenantId)));
    return { case: visibleCase.caseItem, student: visibleCase.student, sections };
  });
}
