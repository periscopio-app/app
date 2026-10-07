import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client";
import { evaluations, students } from "@periscopio/shared";
import { canAccessSchool } from "../security/tenancy";
import { EVALUATION_NOTICE, validateEvaluationInput } from "../services/evaluation-guard";
import { requireActor } from "../security/actor";
import { CLINICAL_ROLES } from "../security/roles";

export async function evaluationsRoutes(app: FastifyInstance) {
  // Submeter avaliação de escala clínica (M-CHAT, FOGAP, SRQ-20) - Exige papel clínico
  app.post("/api/evaluations", async (request, reply) => {
    const actor = await requireActor(request, reply, CLINICAL_ROLES);
    if (!actor) return;

    const parsed = validateEvaluationInput(request.body);
    if (!parsed.ok) return reply.status(400).send({ error: parsed.error });

    // Aluno precisa existir e estar no escopo (tenant/escola) do profissional; fora dele, 404.
    const [student] = await db
      .select({ id: students.id, tenantId: students.tenantId, schoolId: students.schoolId })
      .from(students)
      .where(eq(students.id, parsed.value.studentId))
      .limit(1);
    if (!student || !canAccessSchool(actor, student.tenantId, student.schoolId)) {
      return reply.status(404).send({ error: "Aluno não encontrado." });
    }

    // score nunca vem do cliente: fica nulo até existir regra de cálculo aprovada clinicamente.
    const [inserted] = await db
      .insert(evaluations)
      .values({
        tenantId: student.tenantId,
        studentId: student.id,
        scale: parsed.value.scale,
        score: null,
        payload: parsed.value.payload,
      })
      .returning();

    return reply.status(201).send({
      success: true,
      notice: EVALUATION_NOTICE,
      evaluation: inserted,
    });
  });

  // Listar avaliações clínicas por aluno ou escala - Exige papel clínico
  app.get("/api/evaluations", async (request, reply) => {
    const actor = await requireActor(request, reply, CLINICAL_ROLES);
    if (!actor) return;

    const { studentId, scale } = request.query as { studentId?: string; scale?: string };

    // Escopo: admin não chega aqui (papel não clínico); demais ficam no próprio tenant.
    const conditions = [eq(evaluations.tenantId, actor.tenantId)];
    if (studentId) conditions.push(eq(evaluations.studentId, studentId));
    if (scale) conditions.push(eq(evaluations.scale, scale));

    if (actor.schoolId) conditions.push(eq(students.schoolId, actor.schoolId));

    const records = (
      await db
        .select({ evaluation: evaluations })
        .from(evaluations)
        .innerJoin(students, eq(students.id, evaluations.studentId))
        .where(and(...conditions))
    ).map((r) => r.evaluation);

    return reply.send({
      total: records.length,
      evaluations: records,
    });
  });
}
