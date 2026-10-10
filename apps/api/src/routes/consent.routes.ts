import type { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";
import { db } from "../db/client";
import { consentTerms, consentAcceptances, cases, students } from "@periscopio/shared";
import { requireActor } from "../security/actor";
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
O presente instrumento formaliza o consentimento livre, informado e inequívoco do(a) responsável legal para a participação da criança no Programa Saúde Mental na Escola, desenvolvido pela Associação Casa da Rocha Mental (ACRM) em parceria técnica com a Rede Municipal de Ensino e a Oceano Azul Tecnologia.

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
  app.get("/api/consent/terms/latest", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    const queryType = ((request.query as any)?.type || "responsavel_legal") as string;
    const tenantId = actor.tenantId;

    let [term] = await db
      .select()
      .from(consentTerms)
      .where(and(eq(consentTerms.tenantId, tenantId), eq(consentTerms.type, queryType), eq(consentTerms.active, true)))
      .orderBy(desc(consentTerms.publishedAt))
      .limit(1);

    // Se o município ainda não tiver cadastrado termos específicos, provisiona o v1.0 oficial
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
  });

  /**
   * 2. Registrar prova de aceite de consentimento (Art. 8º § 2º LGPD)
   */
  app.post("/api/consent/accept", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    const body = request.body as {
      termId: string;
      studentId?: string;
      caseId?: string;
      signerName: string;
      signerDocument?: string;
      signerRole: string; // mae | pai | responsavel_legal | proprio
      signerEmail?: string;
      signerPhone?: string;
    };

    if (!body.termId || !body.signerName || !body.signerRole) {
      reply.status(400);
      return { error: "Campos obrigatórios: termId, signerName e signerRole." };
    }

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

    // Cria evidência criptográfica (SHA-256) da assinatura e do texto do termo
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
  });

  /**
   * 3. Consultar consentimento por caso clínico
   */
  app.get("/api/consent/case/:caseId", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };

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
  });

  /**
   * 4. Revogar consentimento (Art. 18, IX LGPD)
   */
  app.post("/api/consent/:id/revoke", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    const { id } = request.params as { id: string };
    const { reason } = (request.body as { reason?: string }) || {};

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
  });
}
