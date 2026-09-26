import type { FastifyInstance } from "fastify";
import {
  canProceedToMedical,
  calculateSnapIvScore,
  calculateAbcScore,
} from "../services/triagem.service";

export async function triagemRoutes(app: FastifyInstance) {
  app.post<{
    Params: { id: string };
    Body: { isCrisisBypass: boolean };
    Headers: { "x-tenant-id"?: string };
  }>("/api/cases/:id/forward", async (request, reply) => {
    const tenantId = request.headers["x-tenant-id"];
    if (!tenantId) {
      return reply.status(403).send({ error: "tenant_id obrigatório" });
    }

    const { isCrisisBypass = false } = request.body ?? {};

    try {
      await canProceedToMedical(request.params.id, isCrisisBypass);
      return reply.status(200).send({ ok: true, caseId: request.params.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      return reply.status(422).send({ error: message });
    }
  });

  app.post<{
    Body: { respostas: number[] };
    Headers: { "x-tenant-id"?: string };
  }>("/api/scoring/snap-iv", async (request, reply) => {
    const tenantId = request.headers["x-tenant-id"];
    if (!tenantId) {
      return reply.status(403).send({ error: "tenant_id obrigatório" });
    }

    const { respostas } = request.body;
    const resultado = calculateSnapIvScore(respostas);
    return reply.status(200).send({ resultado });
  });

  app.post<{
    Body: { totalScore: number };
    Headers: { "x-tenant-id"?: string };
  }>("/api/scoring/abc", async (request, reply) => {
    const tenantId = request.headers["x-tenant-id"];
    if (!tenantId) {
      return reply.status(403).send({ error: "tenant_id obrigatório" });
    }

    const { totalScore } = request.body;
    const resultado = calculateAbcScore(totalScore);
    return reply.status(200).send({ resultado });
  });
}
