import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { cases, students } from "@periscopio/shared";
import { db } from "../db/client";
import { requireActor } from "../security/actor";
import { canAccessSchool } from "../security/tenancy";
import { canProceedToMedical, calculateAbcScore, calculateSnapIvScore } from "../services/triagem.service";

const clinicalRoles = ["admin_platform", "municipal_manager", "school_manager", "ppi", "md1"] as const;

export async function triagemRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string }; Body: { isCrisisBypass?: boolean } }>(
    "/api/cases/:id/forward",
    async (request, reply) => {
      const actor = await requireActor(request, reply, clinicalRoles);
      if (!actor) return;

      const [caseItem] = await db
        .select({ tenantId: cases.tenantId, schoolId: students.schoolId })
        .from(cases)
        .innerJoin(students, eq(cases.studentId, students.id))
        .where(eq(cases.id, request.params.id))
        .limit(1);
      if (!caseItem || !canAccessSchool(actor, caseItem.tenantId, caseItem.schoolId)) {
        return reply.status(404).send({ error: "Caso não encontrado" });
      }

      try {
        await canProceedToMedical(request.params.id, request.body?.isCrisisBypass === true);
        return { ok: true, caseId: request.params.id };
      } catch (error) {
        return reply.status(422).send({ error: error instanceof Error ? error.message : "Não foi possível encaminhar o caso" });
      }
    }
  );

  app.post<{ Body: { respostas?: number[] } }>("/api/scoring/snap-iv", async (request, reply) => {
    const actor = await requireActor(request, reply, clinicalRoles);
    if (!actor) return;
    if (!Array.isArray(request.body?.respostas) || request.body.respostas.length !== 18) {
      return reply.status(400).send({ error: "Informe as 18 respostas da escala" });
    }
    return { resultado: calculateSnapIvScore(request.body.respostas) };
  });

  app.post<{ Body: { totalScore?: number } }>("/api/scoring/abc", async (request, reply) => {
    const actor = await requireActor(request, reply, clinicalRoles);
    if (!actor) return;
    const totalScore = request.body?.totalScore;
    if (typeof totalScore !== "number" || !Number.isFinite(totalScore)) {
      return reply.status(400).send({ error: "Informe uma pontuação válida" });
    }
    return { resultado: calculateAbcScore(totalScore) };
  });
}
