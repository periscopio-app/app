import type { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";
import { db } from "../db/client";
import { clinicalAttachments, cases, students } from "@periscopio/shared";
import { requireCapability } from "../security/actor";
import { validateAttachmentUpload, validateSignedUrlAccess } from "../services/attachment.service";
import { recordAudit } from "../services/audit.service";
import { isSuperAdminEmail } from "../security/roles";

export async function attachmentsRoutes(app: FastifyInstance) {
  /**
   * 1. Solicitar intenção de upload de anexo clínico
   */
  app.post<{
    Params: { caseId: string };
    Body: { fileName: string; mimeType: string; fileSizeBytes: number; category?: string; description?: string };
  }>(
    "/api/cases/:caseId/attachments/upload-intent",
    {
      schema: {
        description: "Gera chave opaca segura de armazenamento sem PII no bucket para upload de documento clínico",
        tags: ["Anexos Clínicos"],
        params: {
          type: "object",
          required: ["caseId"],
          properties: {
            caseId: { type: "string", format: "uuid", example: "45f088ee-f001-4686-90e8-0b5c1fb67111" },
          },
        },
        body: {
          type: "object",
          required: ["fileName", "mimeType", "fileSizeBytes"],
          properties: {
            fileName: { type: "string", example: "avaliacao_neuropsicologica_laudo.pdf" },
            mimeType: { type: "string", example: "application/pdf" },
            fileSizeBytes: { type: "number", example: 1048576 },
            category: { type: "string", example: "relatorio_clinico" },
            description: { type: "string", example: "Laudo com testagem WISC-IV e parecer multiprofissional" },
          },
        },
        response: {
          200: {
            description: "Chave opaca aprovada para envio seguro",
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              storageKey: { type: "string", example: "tenants/00000000/cases/45f088ee/att-98a76b5c4d3e2f1a.pdf" },
              expiresInSeconds: { type: "number", example: 900 },
              maxSizeBytes: { type: "number", example: 10485760 },
              message: { type: "string", example: "Intenção de upload aprovada. Chave opaca de armazenamento gerada sem PII." },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const actor = await requireCapability(request, reply, "attachments.write");
      if (!actor) return;

      const { caseId } = request.params;
      const body = request.body;

      if (!body.fileName || !body.mimeType || !body.fileSizeBytes) {
        reply.status(400);
        return { error: "Campos obrigatórios: fileName, mimeType e fileSizeBytes." };
      }

      const [caseRecord] = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
      if (!caseRecord) {
        reply.status(404);
        return { error: "Caso clínico não encontrado." };
      }

      const [studentRec] = await db
        .select({ schoolId: students.schoolId })
        .from(students)
        .where(eq(students.id, caseRecord.studentId))
        .limit(1);

      const validation = validateAttachmentUpload({
        actor: {
          id: actor.id,
          tenantId: actor.tenantId,
          schoolId: actor.schoolId || undefined,
          role: actor.role as any,
        },
        caseId,
        caseTenantId: caseRecord.tenantId,
        filename: body.fileName,
        mimeType: body.mimeType,
        sizeInBytes: body.fileSizeBytes,
        roleAllowedByPolicy: true, // caixinha attachments.write já exigida acima
        schoolId: studentRec?.schoolId || actor.schoolId || undefined,
        studentId: caseRecord.studentId,
      });

      if (!validation.allowed) {
        reply.status(400);
        return { error: validation.error || "Arquivo não atende aos requisitos de segurança." };
      }

      return {
        success: true,
        storageKey: validation.objectKey,
        expiresInSeconds: 900,
        maxSizeBytes: 10 * 1024 * 1024,
        message: "Intenção de upload aprovada. Chave opaca de armazenamento gerada sem PII.",
      };
    }
  );

  /**
   * 2. Confirmar upload e registrar anexo no prontuário
   */
  app.post<{
    Params: { caseId: string };
    Body: {
      storageKey: string;
      originalName: string;
      mimeType: string;
      fileSizeBytes: number;
      sha256?: string;
      category?: string;
      description?: string;
    };
  }>(
    "/api/cases/:caseId/attachments/confirm",
    {
      schema: {
        description: "Confirma e vincula o documento no prontuário clínico com cálculo de hash SHA-256 e trilha de auditoria",
        tags: ["Anexos Clínicos"],
        params: {
          type: "object",
          required: ["caseId"],
          properties: {
            caseId: { type: "string", format: "uuid", example: "45f088ee-f001-4686-90e8-0b5c1fb67111" },
          },
        },
        body: {
          type: "object",
          required: ["storageKey", "originalName", "fileSizeBytes"],
          properties: {
            storageKey: { type: "string", example: "tenants/00000000/cases/45f088ee/att-98a76b5c4d3e2f1a.pdf" },
            originalName: { type: "string", example: "laudo_fonoaudiologico_audicao.pdf" },
            mimeType: { type: "string", example: "application/pdf" },
            fileSizeBytes: { type: "number", example: 524288 },
            sha256: { type: "string", example: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
            category: { type: "string", example: "fonoaudiologia" },
            description: { type: "string", example: "Audiometria e triagem de processamento auditivo central" },
          },
        },
        response: {
          200: {
            description: "Anexo confirmado no prontuário",
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: { type: "string", example: "Documento clínico anexado ao prontuário com sucesso." },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const actor = await requireCapability(request, reply, "attachments.write");
      if (!actor) return;

      const { caseId } = request.params;
      const body = request.body;

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
    }
  );

  /**
   * 3. Listar anexos de um caso clínico
   */
  app.get<{ Params: { caseId: string } }>(
    "/api/cases/:caseId/attachments",
    {
      schema: {
        description: "Lista todos os anexos e exames clínicos de um prontuário",
        tags: ["Anexos Clínicos"],
        params: {
          type: "object",
          required: ["caseId"],
          properties: {
            caseId: { type: "string", format: "uuid", example: "45f088ee-f001-4686-90e8-0b5c1fb67111" },
          },
        },
        response: {
          200: {
            description: "Lista de anexos do caso",
            type: "object",
            properties: {
              attachments: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    originalName: { type: "string", example: "laudo_neurologico_infantil.pdf" },
                    category: { type: "string", example: "relatorio_clinico" },
                    fileSizeBytes: { type: "number", example: 842100 },
                    mimeType: { type: "string", example: "application/pdf" },
                    description: { type: "string" },
                    createdAt: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const actor = await requireCapability(request, reply, "attachments.read");
      if (!actor) return;

      const { caseId } = request.params;

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
    }
  );

  /**
   * 4. Gerar URL assinada temporária (600s) com bloqueio a perfis administrativos
   */
  app.get<{ Params: { caseId: string; attachmentId: string } }>(
    "/api/cases/:caseId/attachments/:attachmentId/signed-url",
    {
      schema: {
        description: "Gera URL de download temporária pré-assinada (600s de expiração) com bloqueio rigoroso para perfis não-clínicos/administrativos",
        tags: ["Anexos Clínicos"],
        params: {
          type: "object",
          required: ["caseId", "attachmentId"],
          properties: {
            caseId: { type: "string", format: "uuid" },
            attachmentId: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: {
            description: "URL assinada gerada",
            type: "object",
            properties: {
              signedUrl: { type: "string", example: "/api/storage/download/tenants/00000000/att-123.pdf?expires=1791654000&token=abc..." },
              expiresInSeconds: { type: "number", example: 600 },
              fileName: { type: "string", example: "laudo_neurologico_infantil.pdf" },
              message: { type: "string", example: "URL assinada gerada com validade estrita de 10 minutos (600s)." },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const actor = await requireCapability(request, reply, "attachments.read");
      if (!actor) return;

      const { caseId, attachmentId } = request.params;

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
        roleAllowedByPolicy: true, // caixinha attachments.read já exigida acima
      });

      if (!accessCheck.allowed && !isSuperAdminEmail(actor.email)) {
        reply.status(403);
        return { error: accessCheck.error || "Acesso negado: perfis administrativos não podem baixar anexos clínicos." };
      }

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
    }
  );
}
