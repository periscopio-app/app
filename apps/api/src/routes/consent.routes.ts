import type { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";
import { db } from "../db/client";
import { consentTerms, consentAcceptances, consentAcceptSchema } from "@periscopio/shared";
import { requireActor, requireCapability } from "../security/actor";
import { recordAudit } from "../services/audit.service";

const TERMO_PADRAO_V1 = {
  version: "v1.0",
  type: "responsavel_legal",
  title: "Termo de Consentimento Livre e Esclarecido (TCLE) — Programa Saúde Mental na Escola",
  summary:
    "Autorização do responsável legal para acompanhamento psicopedagógico e triagem de saúde mental escolar no âmbito do projeto Periscópio / ACRM.",
  content: `TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO (TCLE)
PROGRAMA SAÚDE MENTAL NA ESCOLA — PLATAFORMA PERISCÓPIO
Versão 1.0 — Homologação Clínica e Jurídica

1. DO OBJETIVO
O presente instrumento formaliza o consentimento livre, informado e inequívoco do(a) responsável legal para a participação da criança no Programa Saúde Mental na Escola, desenvolvido pela Associação Cultural e Recreativa Mantenedora (ACRM) em parceria técnica com a Rede Municipal de Ensino e a Oceano Azul Tecnologia.

2. DO TRATAMENTO DE DADOS PESSOAIS E SENSÍVEIS (LGPD - ART. 14 E ART. 11)
Os dados coletados destinam-se exclusivamente à identificação precoce de necessidades de suporte pedagógico e encaminhamento responsável ao Sistema Único de Saúde (SUS - UBS, CAPS Infantojuvenil e CRAS).
- A identificação do estudante é mantida sob rígido isolamento pseudonimizado (código opaco).
- Dados de saúde nunca serão comercializados, compartilhados com terceiros não autorizados ou utilizados para publicidade.

3. DO DIREITO DE REVOGAÇÃO (LGPD - ART. 18, IX)
O responsável legal poderá, a qualquer tempo e sem qualquer prejuízo ao aluno no ambiente escolar, solicitar informações sobre o tratamento de dados ou revogar este consentimento mediante requerimento formal na escola ou pelo canal do Encarregado de Dados (DPO).`,
};

export async function consentRoutes(app: FastifyInstance) {
  /**
   * 1. Obter o termo ativo mais recente por tipo
   */
  app.get(
    "/api/consent/terms/latest",
    {
      schema: {
        description: "Recupera a versão ativa do Termo de Consentimento Livre e Esclarecido (TCLE) para exibição e assinatura",
        tags: ["Termos de Consentimento (TCLE)"],
        querystring: {
          type: "object",
          properties: {
            type: { type: "string", default: "responsavel_legal", example: "responsavel_legal" },
          },
        },
        response: {
          200: {
            description: "Termo de consentimento ativo com texto e versão",
            type: "object",
            properties: {
              term: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  version: { type: "string", example: "v1.0" },
                  type: { type: "string", example: "responsavel_legal" },
                  title: { type: "string", example: "Termo de Consentimento Livre e Esclarecido (TCLE)" },
                  summary: { type: "string" },
                  content: { type: "string" },
                  active: { type: "boolean", example: true },
                  publishedAt: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const actor = await requireActor(request, reply);
      if (!actor) return;

      const queryType = ((request.query as any)?.type || "responsavel_legal") as string;
      const tenantId = actor.tenantId;

      try {
        let [term] = await db
          .select()
          .from(consentTerms)
          .where(and(eq(consentTerms.tenantId, tenantId), eq(consentTerms.type, queryType), eq(consentTerms.active, true)))
          .orderBy(desc(consentTerms.publishedAt))
          .limit(1);

        if (!term) {
          const [inserted] = await db
            .insert(consentTerms)
            .values({
              tenantId,
              version: TERMO_PADRAO_V1.version,
              type: queryType,
              title: TERMO_PADRAO_V1.title,
              summary: TERMO_PADRAO_V1.summary,
              content: TERMO_PADRAO_V1.content,
              active: true,
            })
            .onConflictDoNothing()
            .returning();

          term = inserted || (await db
            .select()
            .from(consentTerms)
            .where(and(eq(consentTerms.tenantId, tenantId), eq(consentTerms.type, queryType)))
            .limit(1))[0];
        }

        return { term };
      } catch {
        return {
          term: {
            id: "00000000-0000-0000-0000-000000000001",
            ...TERMO_PADRAO_V1,
            type: queryType,
            active: true,
            publishedAt: new Date().toISOString(),
          },
        };
      }
    }
  );

  /**
   * 2. Registrar prova de aceite de consentimento (Art. 8º § 2º LGPD)
   */
  app.post<{
    Body: {
      termId: string;
      studentId?: string;
      caseId?: string;
      signerName: string;
      signerDocument?: string;
      signerRole: string;
      signerEmail?: string;
      signerPhone?: string;
    };
  }>(
    "/api/consent/accept",
    {
      schema: {
        description: "Registra formalmente o aceite do responsável legal, gerando prova criptográfica SHA-256 e IP de auditoria",
        tags: ["Termos de Consentimento (TCLE)"],
        body: {
          type: "object",
          required: ["termId", "signerName", "signerRole"],
          properties: {
            termId: { type: "string", format: "uuid", example: "11111111-2222-3333-4444-555555555555" },
            studentId: { type: "string", format: "uuid", example: "22222222-3333-4444-5555-666666666666" },
            caseId: { type: "string", format: "uuid", example: "33333333-4444-5555-6666-777777777777" },
            signerName: { type: "string", example: "Silvia Helena dos Santos" },
            signerDocument: { type: "string", example: "321.654.987-11" },
            signerRole: { type: "string", enum: ["mae", "pai", "responsavel_legal", "tutor", "proprio"], example: "mae" },
            signerEmail: { type: "string", format: "email", example: "silvia.santos@gmail.com" },
            signerPhone: { type: "string", example: "(18) 99876-5432" },
          },
        },
        response: {
          200: {
            description: "Consentimento registrado e evidência de aceite gerada",
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              acceptance: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  evidenceSha256: { type: "string", example: "a3f5c9e2b1d4e7f8..." },
                  status: { type: "string", example: "accepted" },
                  acceptedAt: { type: "string" },
                },
              },
              message: { type: "string", example: "Consentimento registrado com sucesso e prova de aceite gerada." },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const actor = await requireCapability(request, reply, "consent.write");
      if (!actor) return;

      const body = request.body;

      if (!body.termId || !body.signerName || !body.signerRole) {
        reply.status(400);
        return { error: "Campos obrigatórios: termId, signerName e signerRole." };
      }

      // Nome, parentesco e CPF (opcional, mas validado pelos dígitos verificadores) com zod.
      const parsed = consentAcceptSchema.safeParse({
        signerName: body.signerName,
        signerRole: body.signerRole,
        signerDocument: body.signerDocument,
      });
      if (!parsed.success) {
        reply.status(400);
        return { error: parsed.error.issues[0]?.message ?? "Dados do signatário inválidos." };
      }
      body.signerName = parsed.data.signerName;
      body.signerRole = parsed.data.signerRole;
      body.signerDocument = parsed.data.signerDocument;

      const [term] = await db.select().from(consentTerms).where(eq(consentTerms.id, body.termId)).limit(1);
      if (!term) {
        reply.status(404);
        return { error: "Termo de consentimento não encontrado." };
      }

      const ipAddress =
        (request.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
        request.ip ||
        "127.0.0.1";
      const userAgent = (request.headers["user-agent"] as string | undefined) || "Desconhecido";
      const acceptedAt = new Date();

      const rawEvidence = `${term.content}|${body.signerName}|${body.signerDocument || ""}|${body.signerRole}|${ipAddress}|${acceptedAt.toISOString()}`;
      const evidenceSha256 = crypto.createHash("sha256").update(rawEvidence).digest("hex");

      const [acceptance] = await db
        .insert(consentAcceptances)
        .values({
          tenantId: actor.tenantId,
          termId: term.id,
          studentId: body.studentId || null,
          caseId: body.caseId || null,
          userId: actor.id,
          signerName: body.signerName,
          signerDocument: body.signerDocument || null,
          signerRole: body.signerRole,
          signerEmail: body.signerEmail || null,
          signerPhone: body.signerPhone || null,
          ipAddress,
          userAgent,
          evidenceSha256,
          status: "accepted",
        })
        .returning();

      await recordAudit(
        {
          tenantId: actor.tenantId,
          userId: actor.id,
          userEmail: actor.email,
          action: "consent.accepted",
          entityType: "consent_acceptance",
          entityId: acceptance.id,
          payload: {
            caseId: body.caseId,
            studentId: body.studentId,
            signerRole: body.signerRole,
            termVersion: term.version,
            evidenceSha256,
          },
        },
        request
      );

      return {
        success: true,
        acceptance,
        message: "Consentimento registrado com sucesso e prova de aceite gerada.",
      };
    }
  );

  /**
   * 3. Consultar consentimento por caso clínico
   */
  app.get<{ Params: { caseId: string } }>(
    "/api/consent/case/:caseId",
    {
      schema: {
        description: "Verifica se um caso clínico possui consentimento TCLE ativo concedido pelo responsável",
        tags: ["Termos de Consentimento (TCLE)"],
        params: {
          type: "object",
          required: ["caseId"],
          properties: {
            caseId: { type: "string", format: "uuid", example: "33333333-4444-5555-6666-777777777777" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              hasActiveConsent: { type: "boolean", example: true },
              acceptances: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    signerName: { type: "string", example: "Silvia Helena dos Santos" },
                    signerRole: { type: "string", example: "mae" },
                    status: { type: "string", example: "accepted" },
                    acceptedAt: { type: "string" },
                    evidenceSha256: { type: "string" },
                    termTitle: { type: "string" },
                    termVersion: { type: "string", example: "v1.0" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const actor = await requireCapability(request, reply, "consent.read");
      if (!actor) return;

      const { caseId } = request.params;

      const acceptances = await db
        .select({
          id: consentAcceptances.id,
          signerName: consentAcceptances.signerName,
          signerRole: consentAcceptances.signerRole,
          signerDocument: consentAcceptances.signerDocument,
          status: consentAcceptances.status,
          acceptedAt: consentAcceptances.acceptedAt,
          evidenceSha256: consentAcceptances.evidenceSha256,
          termTitle: consentTerms.title,
          termVersion: consentTerms.version,
        })
        .from(consentAcceptances)
        .innerJoin(consentTerms, eq(consentAcceptances.termId, consentTerms.id))
        .where(and(eq(consentAcceptances.tenantId, actor.tenantId), eq(consentAcceptances.caseId, caseId)))
        .orderBy(desc(consentAcceptances.acceptedAt));

      const hasActiveConsent = acceptances.some((a) => a.status === "accepted");

      return {
        hasActiveConsent,
        acceptances,
      };
    }
  );

  /**
   * 4. Revogar consentimento (Art. 18, IX LGPD)
   */
  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    "/api/consent/:id/revoke",
    {
      schema: {
        description: "Formaliza a revogação de um consentimento concedido anteriormente, com registro permanente na trilha de auditoria",
        tags: ["Termos de Consentimento (TCLE)"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          properties: {
            reason: { type: "string", example: "Responsável legal optou por descontinuar o acompanhamento institucional." },
          },
        },
      },
    },
    async (request, reply) => {
      const actor = await requireCapability(request, reply, "consent.write");
      if (!actor) return;

      const { id } = request.params;
      const { reason } = request.body || {};

      const [updated] = await db
        .update(consentAcceptances)
        .set({
          status: "revoked",
          revokedAt: new Date(),
          revokedReason: reason || "Revogação solicitada pelo responsável legal.",
        })
        .where(and(eq(consentAcceptances.id, id), eq(consentAcceptances.tenantId, actor.tenantId)))
        .returning();

      if (!updated) {
        reply.status(404);
        return { error: "Registro de consentimento não encontrado." };
      }

      await recordAudit(
        {
          tenantId: actor.tenantId,
          userId: actor.id,
          userEmail: actor.email,
          action: "consent.revoked",
          entityType: "consent_acceptance",
          entityId: id,
          payload: {
            caseId: updated.caseId,
            reason,
          },
        },
        request
      );

      return {
        success: true,
        message: "Consentimento revogado formalmente com sucesso.",
      };
    }
  );
}
