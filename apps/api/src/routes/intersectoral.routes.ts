import type { FastifyInstance } from "fastify";
import { requireActor } from "../security/actor";
import {
  createReferral,
  listReferrals,
  updateReferralStatus,
  getIntersectoralMonitoringSummary,
  type IntersectoralDestination,
  type ReferralStatus,
} from "../services/intersectoral.service";

const INTERSECTORAL_ROLES = [
  "admin_platform",
  "adm_master",
  "municipal_manager",
  "gestor_municipal",
  "md1",
  "medico",
  "md",
  "ppi",
  "re",
  "responsavel_escolar",
] as const;

export async function intersectoralRoutes(app: FastifyInstance) {
  // 1. Painel de monitoramento do acolhimento em 90 dias (Lei 13.509 / ECA art. 19 § 2º)
  app.get(
    "/api/intersectoral/monitoring/sla-90d",
    {
      schema: {
        description: "Painel analítico do cumprimento do prazo legal de 90 dias para acolhimento e contrarreferência intersetorial (CRAS, CAPS AJ/IJ, UBS)",
        tags: ["Rede Intersetorial"],
        response: {
          200: {
            description: "Métricas consolidadas de monitoramento da Lei 90d",
            type: "object",
            additionalProperties: true,
            properties: {
              totalCasosEncaminhados: { type: "number", example: 4 },
              taxaConformidadeLei90d: { type: "number", example: 100 },
              distribuicaoPorRede: {
                type: "object",
                additionalProperties: true,
                properties: {
                  CAPS_IJ: { type: "number", example: 1 },
                  CRAS: { type: "number", example: 1 },
                  UBS: { type: "number", example: 1 },
                  CAPS_AJ: { type: "number", example: 1 },
                },
              },
              alertaPrazos90d: {
                type: "object",
                additionalProperties: true,
                properties: {
                  no_prazo: { type: "number", example: 2 },
                  atencao: { type: "number", example: 1 },
                  urgente: { type: "number", example: 1 },
                  prazo_estourado_90d: { type: "number", example: 0 },
                },
              },
              casosCriticos: {
                type: "array",
                items: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const actor = await requireActor(request, reply, INTERSECTORAL_ROLES);
      if (!actor) return;
      return getIntersectoralMonitoringSummary();
    }
  );

  // 2. Listagem de encaminhamentos com filtros e métricas de SLA
  app.get<{ Querystring: { destination?: string; status?: string } }>(
    "/api/intersectoral/referrals",
    {
      schema: {
        description: "Lista encaminhamentos com cálculo em tempo real de dias decorridos, dias restantes e alerta de SLA de 90 dias",
        tags: ["Rede Intersetorial"],
        querystring: {
          type: "object",
          properties: {
            destination: {
              type: "string",
              description: "Filtrar por equipamento público de destino (CRAS, CAPS_IJ, CAPS_AJ, UBS, etc.)",
              example: "CAPS_IJ",
            },
            status: {
              type: "string",
              description: "Filtrar por status do encaminhamento",
              example: "solicitado",
            },
          },
        },
        response: {
          200: {
            type: "object",
            additionalProperties: true,
            properties: {
              total: { type: "number", example: 4 },
              referrals: {
                type: "array",
                items: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const actor = await requireActor(request, reply, INTERSECTORAL_ROLES);
      if (!actor) return;
      const { destination, status } = request.query;
      const destNorm = destination ? (destination.toUpperCase() as IntersectoralDestination) : undefined;
      const referrals = listReferrals({ destination: destNorm, status: status as ReferralStatus });
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
      destination: string;
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
        description: "Emite um novo encaminhamento para CRAS, CAPS IJ, CAPS AJ, UBS ou Conselho Tutelar com contagem de 90 dias",
        tags: ["Rede Intersetorial"],
        body: {
          type: "object",
          required: ["caseId", "studentCode", "destination", "reason"],
          properties: {
            caseId: { type: "string", example: "caso-novo-099" },
            studentCode: { type: "string", example: "TAR-2026-0099" },
            schoolName: { type: "string", example: "EMEF Gilberto Lex" },
            destination: {
              type: "string",
              example: "CAPS_AJ",
            },
            destinationName: { type: "string", example: "CAPS Álcool e Drogas Regional" },
            reason: { type: "string", example: "Suporte e acolhimento para vulnerabilidade psicossocial" },
            specialtyRequired: { type: "string", example: "Apoio Especializado" },
            priority: { type: "string", enum: ["rotina", "prioritario", "urgente"], example: "urgente" },
            requestedBy: { type: "string", example: "Psicólogo Periscópio" },
            slaDeadlineDays: { type: "number", default: 90, example: 90 },
          },
        },
        response: {
          201: {
            description: "Encaminhamento registrado com protocolo intersetorial",
            type: "object",
            additionalProperties: true,
            properties: {
              id: { type: "string", example: "ref-taruma-001" },
              caseId: { type: "string", example: "caso-novo-099" },
              studentCode: { type: "string", example: "TAR-2026-0099" },
              schoolName: { type: "string", example: "EMEF Gilberto Lex" },
              destination: { type: "string", example: "CAPS_AJ" },
              status: { type: "string", example: "solicitado" },
              slaDeadlineDays: { type: "number", example: 90 },
              slaStatus: { type: "string", example: "no_prazo" },
              daysElapsed: { type: "number", example: 0 },
              daysRemaining: { type: "number", example: 90 },
              isBreached: { type: "boolean", example: false },
              createdAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const actor = await requireActor(request, reply, INTERSECTORAL_ROLES);
      if (!actor) return;
      const body = request.body;
      if (!body.caseId || !body.studentCode || !body.destination || !body.reason) {
        return reply.status(400).send({
          error: "Campos obrigatórios: caseId, studentCode, destination e reason.",
        });
      }

      const destUpper = (body.destination || "").toUpperCase() as IntersectoralDestination;

      const created = createReferral({
        caseId: body.caseId,
        studentCode: body.studentCode,
        schoolName: body.schoolName || "Escola Municipal",
        destination: destUpper,
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
        description: "Atualiza status do acolhimento (acolhido, em atendimento, contrarreferência) e registra retorno formal para a escola",
        tags: ["Rede Intersetorial"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "ID do encaminhamento" },
          },
        },
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "string",
              example: "contrarreferencia_concluida",
            },
            feedbackNotes: {
              type: "string",
              description: "Notas de contrarreferência para a equipe escolar",
              example: "Paciente acolhido no CAPS IJ com início de plano terapêutico singular (PTS).",
            },
          },
        },
        response: {
          200: {
            type: "object",
            additionalProperties: true,
            properties: {
              id: { type: "string", example: "ref-taruma-001" },
              status: { type: "string", example: "contrarreferencia_concluida" },
              feedbackNotes: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const actor = await requireActor(request, reply, INTERSECTORAL_ROLES);
      if (!actor) return;
      const { id } = request.params;
      const { status, feedbackNotes } = request.body;

      if (!status) {
        return reply.status(400).send({ error: "Campo 'status' é obrigatório." });
      }

      const updated = updateReferralStatus(id, status, feedbackNotes);
      if (!updated) {
        return reply.status(404).send({ error: "Encaminhamento não encontrado." });
      }

      return reply.send(updated);
    }
  );
}
