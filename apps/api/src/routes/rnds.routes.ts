import type { FastifyInstance } from "fastify";
import {
  generateRelBundle,
  validateRndsPayload,
  CBO_REFERENCE,
  type RelInput,
} from "../services/rnds.service";

export async function rndsRoutes(app: FastifyInstance) {
  // 1. Informações e status do conector RNDS / SUS
  app.get(
    "/api/rnds/status",
    {
      schema: {
        description: "Disponibilidade do gerador experimental de Bundle FHIR R4; não representa conexão ou homologação RNDS.",
        tags: ["RNDS / SUS"],
        response: {
          200: {
            description: "Informações de conectividade e conformidade técnica do conector RNDS",
            type: "object",
            properties: {
              status: { type: "string", example: "prototype" },
              protocol: { type: "string", example: "HL7 FHIR R4 (RNDS - REL v1.0)" },
              version: { type: "string", example: "2.0.0" },
              environment: { type: "string", example: "not-configured" },
              supportedDocTypes: {
                type: "array",
                items: { type: "string" },
                example: ["REL (gerador experimental; ainda sem validação oficial)"],
              },
              activeCbos: { type: "object", additionalProperties: true },
            },
          },
        },
      },
    },
    async () => {
      return {
        status: "prototype",
        protocol: "HL7 FHIR R4 (RNDS - REL v1.0)",
        version: "2.0.0",
        environment: "not-configured",
        supportedDocTypes: ["REL (gerador experimental; ainda sem validação oficial)"],
        activeCbos: CBO_REFERENCE,
      };
    }
  );

  // 2. Validação prévia de payload para a RNDS
  app.post<{ Body: Partial<RelInput> }>(
    "/api/rnds/rel/validate",
    {
      schema: {
        description: "Checagens preliminares do payload; não substituem validação oficial de perfis RNDS.",
        tags: ["RNDS / SUS"],
        body: {
          type: "object",
          additionalProperties: true,
          properties: {
            caseId: { type: "string", example: "caso-taruma-001" },
            patient: { type: "object", additionalProperties: true },
            practitioner: { type: "object", additionalProperties: true },
            organization: { type: "object", additionalProperties: true },
            encounter: { type: "object", additionalProperties: true },
            clinicalFindings: { type: "object", additionalProperties: true },
            referral: { type: "object", additionalProperties: true },
          },
        },
        response: {
          200: {
            description: "Resultado da validação do payload RNDS",
            type: "object",
            additionalProperties: true,
            properties: {
              valid: { type: "boolean", example: true },
              errors: { type: "array", items: { type: "string" }, example: [] },
              warnings: { type: "array", items: { type: "string" }, example: [] },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const result = validateRndsPayload(request.body || {});
      return reply.send(result);
    }
  );

  // 3. Geração local de Bundle experimental. Nenhum dado é transmitido à RNDS.
  app.post<{ Body: RelInput }>(
    "/api/rnds/rel/bundle",
    {
      schema: {
        description: "Gera um Bundle FHIR R4 experimental para validação local; não transmite dados nem atesta conformidade RNDS.",
        tags: ["RNDS / SUS"],
        body: {
          type: "object",
          required: ["caseId", "practitioner", "organization", "encounter"],
          additionalProperties: true,
          properties: {
            caseId: { type: "string", example: "caso-taruma-001" },
            patient: {
              type: "object",
              additionalProperties: true,
              properties: {
                nome: { type: "string", example: "Aluno Demonstrativo" },
                cns: { type: "string", example: "700000000000001" },
                dataNascimento: { type: "string", example: "2016-04-12" },
                sexo: { type: "string", enum: ["M", "F", "O"], example: "M" },
                municipioIbge: { type: "string", example: "3553957" },
              },
            },
            practitioner: {
              type: "object",
              required: ["nome", "cbo"],
              additionalProperties: true,
              properties: {
                nome: { type: "string", example: "Dra. Maria Helena" },
                cns: { type: "string", example: "898000000000002" },
                cbo: { type: "string", example: "225125" },
                conselho: {
                  type: "object",
                  additionalProperties: true,
                  properties: {
                    tipo: { type: "string", example: "CRM" },
                    numero: { type: "string", example: "123456" },
                    uf: { type: "string", example: "SP" },
                  },
                },
              },
            },
            organization: {
              type: "object",
              required: ["nome"],
              additionalProperties: true,
              properties: {
                nome: { type: "string", example: "EMEF Gilberto Lex - Tarumã" },
                cnes: { type: "string", example: "1234567" },
                municipioIbge: { type: "string", example: "3553957" },
              },
            },
            encounter: {
              type: "object",
              required: ["motivoConsulta"],
              additionalProperties: true,
              properties: {
                dataInicio: { type: "string", example: "2026-10-10T09:00:00Z" },
                modalidade: { type: "string", enum: ["presencial", "teleatendimento", "domiciliar", "escolar"], example: "escolar" },
                motivoConsulta: { type: "string", example: "Dificuldade acentuada de aprendizagem e desatenção" },
              },
            },
            clinicalFindings: {
              type: "object",
              additionalProperties: true,
              properties: {
                cid10: { type: "string", example: "F90.0" },
                descricaoQueixa: { type: "string", example: "Queixa de desatenção e hiperatividade em ambiente de sala de aula" },
                hipoteseDiagnostica: { type: "string", example: "Transtorno do Déficit de Atenção e Hiperatividade" },
              },
            },
            referral: {
              type: "object",
              additionalProperties: true,
              properties: {
                destinoTipo: { type: "string", example: "CAPS_IJ" },
                prioridade: { type: "string", example: "prioritario" },
                justificativaClinica: { type: "string", example: "Necessidade de avaliação psiquiátrica infantil e suporte psicossocial" },
                prazoAcolhimentoDias: { type: "number", example: 90 },
              },
            },
          },
        },
        response: {
          200: {
            description: "Bundle FHIR R4 gerado com sucesso",
            type: "object",
            additionalProperties: true,
            properties: {
              success: { type: "boolean", example: true },
              warnings: { type: "array", items: { type: "string" } },
              bundle: {
                type: "object",
                additionalProperties: true,
                properties: {
                  resourceType: { type: "string", example: "Bundle" },
                  type: { type: "string", example: "document" },
                  id: { type: "string" },
                  entry: { type: "array", items: { type: "object", additionalProperties: true } },
                },
              },
            },
          },
        },
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
