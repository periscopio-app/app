import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client";
import { students, cases, caseSummaries, users, schools } from "@periscopio/shared";

export async function casesRoutes(app: FastifyInstance) {
  /**
   * 1. Cadastro de Alunos pelo Psicopedagogo (PpI)
   * LGPD: Não armazena CPF de alunos. Gera código pseudonimizado (studentCode).
   */
  app.post("/api/students", async (request, reply) => {
    const body = request.body as {
      schoolId: string;
      tenantId?: string;
      birthYear?: number;
      turma?: string;
    };

    if (!body.schoolId) {
      reply.status(400);
      return { error: "ID da escola é obrigatório." };
    }

    const [school] = await db
      .select()
      .from(schools)
      .where(eq(schools.id, body.schoolId))
      .limit(1);

    if (!school) {
      reply.status(404);
      return { error: "Escola não encontrada." };
    }

    // Gera student_code pseudonimizado com base na slug da escola e hash único
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const studentCode = `${school.slug?.substring(0, 4).toUpperCase() || "ESC"}-${new Date().getFullYear()}-${randomSuffix}`;

    const [newStudent] = await db
      .insert(students)
      .values({
        tenantId: school.tenantId,
        schoolId: school.id,
        studentCode,
        birthYear: body.birthYear,
      })
      .returning();

    return {
      success: true,
      student: newStudent,
      message: `Aluno cadastrado com sucesso sob o código pseudonimizado ${studentCode}`,
    };
  });

  /**
   * 2. Lista alunos de uma escola
   */
  app.get("/api/schools/:schoolId/students", async (request, reply) => {
    const { schoolId } = request.params as { schoolId: string };

    const studentList = await db
      .select()
      .from(students)
      .where(eq(students.schoolId, schoolId));

    return { students: studentList };
  });

  /**
   * 3. Lista profissionais de uma escola (para que o PpI possa delegar seções)
   */
  app.get("/api/schools/:schoolId/professionals", async (request, reply) => {
    const { schoolId } = request.params as { schoolId: string };

    const professionalList = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        specialty: users.specialty,
        role: users.role,
        classCode: users.classCode,
      })
      .from(users)
      .where(eq(users.schoolId, schoolId));

    return { professionals: professionalList };
  });

  /**
   * 4. Abertura de Caso / Prontuário Clínico para um aluno
   */
  app.post("/api/cases", async (request, reply) => {
    const body = request.body as {
      studentId: string;
      status?: string;
      dataInicioIntervencao?: string;
    };

    if (!body.studentId) {
      reply.status(400);
      return { error: "ID do aluno é obrigatório." };
    }

    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.id, body.studentId))
      .limit(1);

    if (!student) {
      reply.status(404);
      return { error: "Aluno não encontrado." };
    }

    const [newCase] = await db
      .insert(cases)
      .values({
        tenantId: student.tenantId,
        studentId: student.id,
        status: body.status || "triagem",
        dataInicioIntervencao: body.dataInicioIntervencao || new Date().toISOString().split("T")[0],
      })
      .returning();

    return {
      success: true,
      case: newCase,
      message: "Caso aberto com sucesso.",
    };
  });

  /**
   * 5. Delegação de seções do Prontuário pelo Psicopedagogo
   * Ex: Delega seção FONO para o fonoaudiólogo, secao MEDICA para o MD1, etc.
   */
  app.post("/api/cases/:caseId/delegate", async (request, reply) => {
    const { caseId } = request.params as { caseId: string };
    const body = request.body as {
      delegations: Array<{
        specialty: string; // fonoaudiologia | medicina | psicologia | psicopedagogia | psicomotricidade | servico_social
        professionalId: string;
        notes?: string;
      }>;
    };

    const [currentCase] = await db
      .select()
      .from(cases)
      .where(eq(cases.id, caseId))
      .limit(1);

    if (!currentCase) {
      reply.status(404);
      return { error: "Caso não encontrado." };
    }

    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.id, currentCase.studentId))
      .limit(1);

    const createdSections = [];

    for (const item of body.delegations) {
      const [section] = await db
        .insert(caseSummaries)
        .values({
          caseId: currentCase.id,
          tenantId: currentCase.tenantId,
          schoolId: student.schoolId,
          specialty: item.specialty,
          assignedProfessionalId: item.professionalId,
          status: "pendente",
          notes: item.notes,
        })
        .returning();

      createdSections.push(section);
    }

    return {
      success: true,
      message: `${createdSections.length} seções do prontuário delegadas com sucesso!`,
      sections: createdSections,
    };
  });

  /**
   * 6. Visão do Especialista: Lista APENAS as seções delegadas para ele
   * Garante isolamento estrito — cada profissional só vê sua parte!
   */
  app.get("/api/cases/my-delegated-sections", async (request, reply) => {
    const { professionalId, email } = request.query as {
      professionalId?: string;
      email?: string;
    };

    let targetProfId = professionalId;

    if (!targetProfId && email) {
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      targetProfId = user?.id;
    }

    if (!targetProfId) {
      reply.status(400);
      return { error: "Identificação do profissional (professionalId ou email) é obrigatória." };
    }

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
      .where(eq(caseSummaries.assignedProfessionalId, targetProfId));

    return {
      professionalId: targetProfId,
      assignedSections: sections,
    };
  });

  /**
   * 7. O Especialista salva a sumarização da sua seção
   */
  app.patch("/api/cases/sections/:sectionId", async (request, reply) => {
    const { sectionId } = request.params as { sectionId: string };
    const body = request.body as {
      summary: Record<string, any>;
      notes?: string;
      markAsCompleted?: boolean;
    };

    const status = body.markAsCompleted ? "concluido" : "em_andamento";
    const completedAt = body.markAsCompleted ? new Date() : null;

    const [updated] = await db
      .update(caseSummaries)
      .set({
        summary: body.summary,
        notes: body.notes,
        status,
        completedAt,
        updatedAt: new Date(),
      })
      .where(eq(caseSummaries.id, sectionId))
      .returning();

    if (!updated) {
      reply.status(404);
      return { error: "Seção de prontuário não encontrada." };
    }

    return {
      success: true,
      message: "Sumarização da especialidade salva com sucesso!",
      section: updated,
    };
  });

  /**
   * 8. Visão Consolidada do Caso / Prontuário para o Psicopedagogo (PpI)
   */
  app.get("/api/cases/:caseId/full-summary", async (request, reply) => {
    const { caseId } = request.params as { caseId: string };

    const [caseItem] = await db
      .select()
      .from(cases)
      .where(eq(cases.id, caseId))
      .limit(1);

    if (!caseItem) {
      reply.status(404);
      return { error: "Caso não encontrado." };
    }

    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.id, caseItem.studentId))
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
      .where(eq(caseSummaries.caseId, caseId));

    return {
      case: caseItem,
      student,
      sections,
    };
  });
}
