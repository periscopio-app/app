import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { healthRoutes } from "./routes/health";
import { observabilityRoutes } from "./routes/observability.routes";
import { genRequestId, loggerOptions, registerObservability } from "./observability/http";
import { triagemRoutes } from "./routes/triagem.routes";
import { authRoutes } from "./routes/auth.routes";
import { onboardingRoutes } from "./routes/onboarding.routes";
import { accessRoutes } from "./routes/access.routes";
import { casesRoutes } from "./routes/cases.routes";
import { leadsRoutes } from "./routes/leads.routes";
import { usersRoutes } from "./routes/users.routes";
import { privilegesRoutes } from "./routes/privileges.routes";
import { teaRoutes } from "./routes/tea.routes";
import { evaluationsRoutes } from "./routes/evaluations.routes";
import { coursesRoutes } from "./routes/courses.routes";
import { notificationsRoutes } from "./routes/notifications.routes";
import { expertMeetingsRoutes } from "./routes/expert-meetings.routes";
import { populationRoutes } from "./routes/population.routes";
import { biRoutes } from "./routes/bi.routes";
import { managementRoutes } from "./routes/management.routes";
import { locationsRoutes } from "./routes/locations.routes";
import { viacepRoutes } from "./routes/viacep.routes";
import { rndsRoutes } from "./routes/rnds.routes";
import { intersectoralRoutes } from "./routes/intersectoral.routes";
import { consentRoutes } from "./routes/consent.routes";
import { lgpdRoutes } from "./routes/lgpd.routes";
import { identityVaultRoutes } from "./routes/identity-vault.routes";
import { attachmentsRoutes } from "./routes/attachments.routes";

export async function buildApp(opts: { logger?: boolean } = {}) {
  const app = Fastify({
    logger: (opts.logger ?? true) ? loggerOptions() : false,
    genReqId: genRequestId,
    requestIdHeader: false,
    trustProxy: true,
    ajv: {
      customOptions: {
        strict: false,
      },
    },
  });
  const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      const isAllowed = allowedOrigins.some((pattern) => {
        if (pattern.startsWith("*.")) {
          const domain = pattern.slice(2);
          try {
            const parsed = new URL(origin);
            return parsed.hostname.endsWith(domain) || parsed.hostname === domain;
          } catch {
            return false;
          }
        }
        return false;
      });
      if (isAllowed) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposedHeaders: ["x-request-id"],
  });

  registerObservability(app);

  // 1. Configuração do Swagger OpenAPI
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "Periscópio Saúde & Educação — API Clínica, RNDS e Intersetorial",
        description:
          "Documentação e Especificação OpenAPI para integração médica, interoperabilidade SUS / RNDS (HL7 FHIR REL), cadastro com ViaCEP e rede intersetorial (CRAS, CAPS AJ/IJ, UBS com monitoramento de acolhimento em 90 dias - Lei nº 13.509/2017 e Marco de Encaminhamento 2025).",
        version: "2.0.0",
        contact: {
          name: "Projeto Periscópio",
          url: "https://www.projetoperiscopio.com.br",
        },
      },
      servers: [
        { url: "http://localhost:3001", description: "Servidor Local" },
        { url: "https://api.projetoperiscopio.com.br", description: "Produção" },
      ],
      tags: [
        { name: "Localização & CEP", description: "Busca de CEP oficial (ViaCEP), Estados e Cidades do Brasil" },
        { name: "RNDS / SUS", description: "Protocolo RNDS HL7 FHIR (REL) do Ministério da Saúde para Registro Eletrônico em Saúde" },
        { name: "Rede Intersetorial", description: "Encaminhamentos e Acolhimento: CRAS, CAPS (AJ/IJ), UBS e Monitoramento de 90 dias (Lei 13.509 / ECA art. 19 § 2º)" },
        { name: "Proteção de Dados & LGPD (Art. 18)", description: "Canal público para titulares, gestão de SLA pelo DPO e política de retenção" },
        { name: "Termos de Consentimento (TCLE)", description: "Termos versionados com prova criptográfica SHA-256 e auditoria" },
        { name: "Cofre de Identidade do Aluno", description: "Armazenamento cifrado com AES-256 GCM e revelação clínica auditada" },
        { name: "Anexos Clínicos", description: "Upload e download seguro com chaves opacas e URLs assinadas de 600 segundos" },
        { name: "Casos Clínicos", description: "Jornada multiprofissional e prontuário médico" },
        { name: "BI Municipal", description: "Inteligência populacional de saúde e educação" },
      ],
    },
  });

  // 2. Swagger UI
  await app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
    staticCSP: false,
  });

  // 3. Registro das Rotas do Sistema
  app.register(healthRoutes);
  app.register(observabilityRoutes);
  app.register(triagemRoutes);
  app.register(authRoutes);
  app.register(onboardingRoutes);
  app.register(accessRoutes);
  app.register(casesRoutes);
  app.register(leadsRoutes);
  app.register(usersRoutes);
  app.register(privilegesRoutes);
  app.register(teaRoutes);
  app.register(evaluationsRoutes);
  app.register(coursesRoutes);
  app.register(notificationsRoutes);
  app.register(expertMeetingsRoutes);
  app.register(populationRoutes);
  app.register(biRoutes);
  app.register(managementRoutes);
  app.register(locationsRoutes);
  app.register(viacepRoutes);
  app.register(rndsRoutes);
  app.register(intersectoralRoutes);
  app.register(consentRoutes);
  app.register(lgpdRoutes);
  app.register(identityVaultRoutes);
  app.register(attachmentsRoutes);

  return app;
}
