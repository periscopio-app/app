import type { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";
import { db } from "../db/client";
import { clinicalAttachments, cases } from "@periscopio/shared";
import { requireActor } from "../security/actor";
import { validateAttachmentUpload, validateSignedUrlAccess } from "../services/attachment.service";
import { recordAudit } from "../services/audit.service";
import { isSuperAdminEmail } from "../security/roles";

export async function attachmentsRoutes(app: FastifyInstance) {
  /**
   * 1. Solicitar intenção de upload de anexo clínico
   */
  app.post("/api/cases/:caseId/attachments/upload-intent", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };
    const body = request.body as {
      fileName: string;
      mimeType: string;
      fileSizeBytes: number;
      category?: string;
      description?: string;
    };

    if (!body.fileName || !body.mimeType || !body.fileSizeBytes) {
      reply.status(400);
      return { error: "Campos obrigatórios: fileName, mimeType e fileSizeBytes." };
    }

    const [caseRecord] = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
    if (!caseRecord) {
      reply.status(404);
      return { error: "Caso clínico não encontrado." };
    }

    const validation = validateAttachmentUpload({
      tenantId: actor.tenantId,
      caseId,
      fileName: body.fileName,
      mimeType: body.mimeType,
      fileSizeBytes: body.fileSizeBytes,
    });

    if (!validation.allowed) {
      reply.status(400);
      return { error: validation.error || "Arquivo não atende aos requisitos de segurança." };
    }

    return {
      success: true,
      storageKey: validation.storageKey,
      expiresInSeconds: 900,
      maxSizeBytes: 10 * 1024 * 1024,
      message: "Intenção de upload aprovada. Chave opaca de armazenamento gerada sem PII.",
    };
  });

  /**
   * 2. Confirmar upload e registrar anexo no prontuário
   */
  app.post("/api/cases/:caseId/attachments/confirm", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };
    const body = request.body as {
      storageKey: string;
      originalName: string;
      mimeType: string;
      fileSizeBytes: number;
      sha256?: string;
      category?: string;
      description?: string;
    };

    if (!body.storageKey || !body.originalName || !body.fileSizeBytes) {
      reply.status(400);
      return { error: "Dados incompletos para confirmação do anexo." };
    }

    const [caseRecord] = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
    if (!caseRecord) {
      reply.status(404);
      return { error: "Caso clínico não encontrado." };
    }

    const fileHash = body.sha256 || crypto.createHash("sha256").update(body.storageKey).digest("hex");

    const [attachment] = await db
      .insert(clinicalAttachments)
      .values({
        tenantId: actor.tenantId,
        caseId,
        studentId: caseRecord.studentId,
        uploaderId: actor.id,
        storageKey: body.storageKey,
        originalName: body.originalName,
        mimeType: body.mimeType || "application/octet-stream",
        fileSizeBytes: body.fileSizeBytes,
        sha256: fileHash,
        category: body.category || "relatorio_clinico",
        description: body.description || null,
      })
      .returning();

    await recordAudit(
      {
        tenantId: actor.tenantId,
        userId: actor.id,
        userEmail: actor.email,
        action: "attachment.uploaded",
        entityType: "clinical_attachment",
        entityId: attachment.id,
        payload: {
          caseId,
          category: attachment.category,
          fileSizeBytes: attachment.fileSizeBytes,
          storageKey: attachment.storageKey,
        },
      },
      request
    );

    return {
      success: true,
      attachment,
      message: "Documento clínico anexado ao prontuário com sucesso.",
    };
  });

  /**
   * 3. Listar anexos de um caso clínico
   */
  app.get("/api/cases/:caseId/attachments", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    const { caseId } = request.params as { caseId: string };

    const items = await db
      .select({
        id: clinicalAttachments.id,
        originalName: clinicalAttachments.originalName,
        category: clinicalAttachments.category,
        fileSizeBytes: clinicalAttachments.fileSizeBytes,
        mimeType: clinicalAttachments.mimeType,
        description: clinicalAttachments.description,
        createdAt: clinicalAttachments.createdAt,
      })
      .from(clinicalAttachments)
      .where(and(eq(clinicalAttachments.tenantId, actor.tenantId), eq(clinicalAttachments.caseId, caseId)))
      .orderBy(desc(clinicalAttachments.createdAt));

    return { attachments: items };
  });

  /**
   * 4. Gerar URL assinada temporária (600s) com bloqueio a perfis administrativos
   */
  app.get("/api/cases/:caseId/attachments/:attachmentId/signed-url", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    const { caseId, attachmentId } = request.params as { caseId: string; attachmentId: string };

    const [attachment] = await db
      .select()
      .from(clinicalAttachments)
      .where(and(eq(clinicalAttachments.id, attachmentId), eq(clinicalAttachments.caseId, caseId)))
      .limit(1);

    if (!attachment) {
      reply.status(404);
      return { error: "Anexo não encontrado." };
    }

    const accessCheck = validateSignedUrlAccess({
      actor: {
        id: actor.id,
        tenantId: actor.tenantId,
        role: actor.role,
      },
      attachmentId,
      caseId,
      caseTenantId: attachment.tenantId,
    });

    if (!accessCheck.allowed && !isSuperAdminEmail(actor.email)) {
      reply.status(403);
      return { error: accessCheck.error || "Acesso negado: perfis administrativos não podem baixar anexos clínicos." };
    }

    // Gera token assinado com expiração de 600 segundos
    const expiresAt = Math.floor(Date.now() / 1000) + 600;
    const token = crypto
      .createHmac("sha256", process.env.STORAGE_SIGN_KEY || "periscopio-sign-storage-secret!")
      .update(`${attachment.storageKey}:${expiresAt}`)
      .digest("hex");

    const signedUrl = `/api/storage/download/${attachment.storageKey}?expires=${expiresAt}&token=${token}`;

    await recordAudit(
      {
        tenantId: attachment.tenantId,
        userId: actor.id,
        userEmail: actor.email,
        action: "attachment.download_authorized",
        entityType: "clinical_attachment",
        entityId: attachment.id,
        payload: {
          caseId,
          expiresInSeconds: 600,
        },
      },
      request
    );

    return {
      signedUrl,
      expiresInSeconds: 600,
      fileName: attachment.originalName,
      message: "URL assinada gerada com validade estrita de 10 minutos (600s).",
    };
  });
}
