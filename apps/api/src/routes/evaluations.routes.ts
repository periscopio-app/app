import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client";
import { evaluations } from "@periscopio/shared";
import { requireActor } from "../security/actor";
import { CLINICAL_ROLES } from "../security/roles";

export async function evaluationsRoutes(app: FastifyInstance) {
  // Submeter avaliação de escala clínica (M-CHAT, FOGAP, SRQ-20) - Exige papel clínico
  app.post("/api/evaluations", async (request, reply) => {
    const actor = await requireActor(request, reply, CLINICAL_ROLES);
    if (!actor) return;

    const body = request.body as {
      studentId: string;
      scale: "mchat" | "fogap" | "srq20";
      score: number;
      payload: Record<string, any>;
    };

    if (!body.studentId || !body.scale || body.score === undefined) {
      return reply.status(400).send({ error: "studentId, scale e score são obrigatórios." });
    }

    const [inserted] = await db
      .insert(evaluations)
      .values({
        tenantId: actor.tenantId,
        studentId: body.studentId,
        scale: body.scale,
        score: body.score,
        payload: body.payload || {},
      })
      .returning();

    return reply.status(201).send({
      success: true,
      evaluation: inserted,
    });
  });

  // Listar avaliações clínicas por aluno ou escala - Exige papel clínico
  app.get("/api/evaluations", async (request, reply) => {
    const actor = await requireActor(request, reply, CLINICAL_ROLES);
    if (!actor) return;

    const { studentId, scale } = request.query as { studentId?: string; scale?: string };

    const conditions = [eq(evaluations.tenantId, actor.tenantId)];
    if (studentId) conditions.push(eq(evaluations.studentId, studentId));
    if (scale) conditions.push(eq(evaluations.scale, scale));

    const records = await db
      .select()
      .from(evaluations)
      .where(and(...conditions));

    return reply.send({
      total: records.length,
      evaluations: records,
    });
  });
}
