import type { FastifyInstance } from "fastify";
import {
  createReferral,
  listReferrals,
  updateReferralStatus,
  getIntersectoralMonitoringSummary,
  type IntersectoralDestination,
  type ReferralStatus,
} from "../services/intersectoral.service";

export async function intersectoralRoutes(app: FastifyInstance) {
  // 1. Painel de monitoramento do acolhimento em 90 dias (Lei 13.509 / ECA art. 19 § 2º)
  app.get(
    "/api/intersectoral/monitoring/sla-90d",
    {
      schema: {
        description: "Painel analítico do cumprimento do prazo legal de 90 dias para acolhimento e contrarreferência intersetorial (CRAS, CAPS AJ/IJ, UBS)",
        tags: ["Rede Intersetorial"],
      },
    },
    async () => {
      return getIntersectoralMonitoringSummary();
    }
  );

  // 2. Listagem de encaminhamentos com filtros e métricas de SLA
  app.get<{ Querystring: { destination?: IntersectoralDestination; status?: ReferralStatus } }>(
    "/api/intersectoral/referrals",
    {
      schema: {
        description: "Lista encaminhamentos com cálculo em tempo real de dias decorridos, dias restantes e alerta de SLA de 90 dias",
        tags: ["Rede Intersetorial"],
      },
    },
    async (request) => {
      const { destination, status } = request.query;
      const referrals = listReferrals({ destination, status });
      return {
        total: referrals.length,
        referrals,
      };
    }
  );

  // 3. Criação de novo encaminhamento intersetorial
  app.post<{
    Body: {
      caseId: string;
      studentCode: string;
      schoolName: string;
      destination: IntersectoralDestination;
      destinationName?: string;
      reason: string;
      specialtyRequired: string;
      priority: "rotina" | "prioritario" | "urgente";
      requestedBy: string;
      slaDeadlineDays?: number;
    };
  }>(
    "/api/intersectoral/referrals",
    {
      schema: {
        description: "Emite um novo encaminhamento para CRAS, CAPS IJ, CAPS AJ, UBS ou Conselho Tutelar",
        tags: ["Rede Intersetorial"],
      },
    },
    async (request, reply) => {
      const body = request.body;
      if (!body.caseId || !body.studentCode || !body.destination || !body.reason) {
        return reply.status(400).send({
          error: "Campos obrigatórios: caseId, studentCode, destination e reason.",
        });
      }

      const created = createReferral({
        caseId: body.caseId,
        studentCode: body.studentCode,
        schoolName: body.schoolName || "Escola Municipal",
        destination: body.destination,
        destinationName: body.destinationName,
        reason: body.reason,
        specialtyRequired: body.specialtyRequired || "Avaliação Multidisciplinar",
        priority: body.priority || "rotina",
        requestedBy: body.requestedBy || "Equipe Multidisciplinar",
        slaDeadlineDays: body.slaDeadlineDays || 90,
      });

      return reply.status(201).send(created);
    }
  );

  // 4. Atualização de status e contrarreferência
  app.patch<{
    Params: { id: string };
    Body: { status: ReferralStatus; feedbackNotes?: string };
  }>(
    "/api/intersectoral/referrals/:id/status",
    {
      schema: {
        description: "Atualiza status do acolhimento (acolhido, em atendimento, contrarreferência) e registra retorno formal",
        tags: ["Rede Intersetorial"],
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { status, feedbackNotes } = request.body;

      if (!status) {
        return reply.status(400).send({ error: "Campo 'status' é obrigatório." });
      }

      const updated = updateReferralStatus(id, status, feedbackNotes);
      if (!updated) {
        return reply.status(404).send({ error: `Encaminhamento '${id}' não encontrado.` });
      }

      return reply.send(updated);
    }
  );
}
