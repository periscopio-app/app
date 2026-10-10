import type { FastifyInstance } from "fastify";
import {
  generateRelBundle,
  validateRndsPayload,
  CBO_REFERENCE,
  type RelInput,
} from "../services/rnds.service";

export async function rndsRoutes(app: FastifyInstance) {
  // Informações e status do conector RNDS / SUS
  app.get(
    "/api/rnds/status",
    {
      schema: {
        description: "Status do conector RNDS (Rede Nacional de Dados em Saúde / Ministério da Saúde)",
        tags: ["RNDS / SUS"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              protocol: { type: "string" },
              version: { type: "string" },
              environment: { type: "string" },
              supportedDocTypes: { type: "array", items: { type: "string" } },
              activeCbos: { type: "object", additionalProperties: true },
            },
          },
        },
      },
    },
    async () => {
      const isProduction = process.env.NODE_ENV === "production";
      return {
        status: "ready",
        protocol: "HL7 FHIR R4 (RNDS - REL v1.0)",
        version: "2.0.0",
        environment: isProduction ? "homologacao" : "sandbox",
        supportedDocTypes: [
          "REL (Registro Eletrônico de Atendimento Clínico e Encaminhamento)",
          "RAC (Registro de Atendimento Clínico)",
          "SUM_ALTA (Sumário de Alta)",
        ],
        activeCbos: CBO_REFERENCE,
      };
    }
  );

  // Validação prévia de payload para a RNDS
  app.post<{ Body: Partial<RelInput> }>(
    "/api/rnds/rel/validate",
    {
      schema: {
        description: "Valida se um caso clínico possui todos os campos e requisitos para transmissão à RNDS",
        tags: ["RNDS / SUS"],
      },
    },
    async (request, reply) => {
      const result = validateRndsPayload(request.body || {});
      return reply.send(result);
    }
  );

  // Geração do Bundle FHIR R4 REL para envio ou integração
  app.post<{ Body: RelInput }>(
    "/api/rnds/rel/bundle",
    {
      schema: {
        description: "Gera o Bundle FHIR R4 oficial (Documento REL) para envio à RNDS do Ministério da Saúde",
        tags: ["RNDS / SUS"],
      },
    },
    async (request, reply) => {
      const validation = validateRndsPayload(request.body || {});
      if (!validation.valid) {
        return reply.status(400).send({
          error: "Payload clínico inválido para o padrão RNDS.",
          details: validation.errors,
          warnings: validation.warnings,
        });
      }

      try {
        const bundle = generateRelBundle(request.body);
        return reply.send({
          success: true,
          warnings: validation.warnings,
          bundle,
        });
      } catch (err: any) {
        return reply.status(500).send({
          error: `Erro ao gerar Bundle FHIR RNDS: ${err.message}`,
        });
      }
    }
  );
}
