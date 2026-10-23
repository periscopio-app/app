import type { FastifyInstance, FastifyReply } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";
import { db } from "../db/client";
import { clinicalAttachments, cases, students } from "@periscopio/shared";
import { requireCapability } from "../security/actor";
import {
  ATTACHMENT_MAX_BYTES,
  getAttachmentStorage,
  detectarFormatoLaudo,
  validateAttachmentUpload,
  validateSignedUrlAccess,
} from "../services/attachment.service";
import { recordAudit } from "../services/audit.service";

type Actor = NonNullable<Awaited<ReturnType<typeof requireCapability>>>;

const RE_LIKE = new Set(["ppi", "re", "responsavel_escolar"]);

/**
 * Laudos que os pais levam (Bloco 5): PDF e foto do celular (JPG/PNG). Só o RE e o médico enviam e abrem; especialistas, gestão e Board nunca
 * (a regra mora nas capacidades attachments.write/read). O arquivo vai para o bucket PRIVADO do Supabase e é
 * servido pelo próprio servidor, depois de conferir sessão, município e escola. Não existe link público.
 */
export async function attachmentsRoutes(app: FastifyInstance) {
  /** Carrega o caso e confere município (e escola, quando quem pede é do RE). Responde 404 sem vazar nada. */
  async function casoAcessivel(actor: Actor, caseId: string, reply: FastifyReply) {
    const [caso] = await db.select().from(cases).where(and(eq(cases.id, caseId), eq(cases.tenantId, actor.tenantId))).limit(1);
    if (!caso) {
      reply.status(404).send({ error: "Caso clínico não encontrado." });
      return null;
    }
    const [aluno] = await db.select({ schoolId: students.schoolId }).from(students).where(eq(students.id, caso.studentId)).limit(1);
    if (RE_LIKE.has(String(actor.role)) && actor.schoolId && aluno?.schoolId && aluno.schoolId !== actor.schoolId) {
      reply.status(404).send({ error: "Caso clínico não encontrado." });
      return null;
    }
    return { caso, schoolId: aluno?.schoolId ?? null };
  }

  /** 1. Enviar um laudo em PDF, JPG ou PNG (base64, até 10 MB). */
  app.post<{
    Params: { caseId: string };
    Body: { fileName?: string; dataBase64?: string; description?: string };
  }>("/api/cases/:caseId/attachments", { bodyLimit: 15 * 1024 * 1024 }, async (request, reply) => {
    const actor = await requireCapability(request, reply, "attachments.write");
    if (!actor) return;

    const { caseId } = request.params;
    const acesso = await casoAcessivel(actor, caseId, reply);
    if (!acesso) return;

    const { fileName, dataBase64, description } = request.body ?? {};
    if (typeof fileName !== "string" || !fileName.trim() || typeof dataBase64 !== "string" || !dataBase64) {
      reply.status(400);
      return { error: "Envie o nome e o conteúdo do arquivo." };
    }
    const bytes = Buffer.from(dataBase64.replace(/^data:[^,]*,/, ""), "base64");
    if (bytes.length === 0) {
      reply.status(400);
      return { error: "O arquivo veio vazio." };
    }
    if (bytes.length > ATTACHMENT_MAX_BYTES) {
      reply.status(413);
      return { error: "Arquivo excede o limite máximo permitido de 10 MB." };
    }
    const formato = detectarFormatoLaudo(bytes);
    if (!formato) {
      reply.status(400);
      return { error: "Formato não permitido. Envie o laudo em PDF, JPG ou PNG." };
    }

    const validation = validateAttachmentUpload({
      actor: { id: actor.id, tenantId: actor.tenantId, schoolId: actor.schoolId || undefined, role: actor.role as never },
      caseId,
      caseTenantId: acesso.caso.tenantId,
      filename: `laudo.${formato.ext}`,
      mimeType: formato.mime,
      sizeInBytes: bytes.length,
      roleAllowedByPolicy: true, // capacidade attachments.write já exigida acima
      schoolId: acesso.schoolId ?? undefined,
      studentId: acesso.caso.studentId,
    });
    if (!validation.allowed || !validation.objectKey) {
      reply.status(400);
      return { error: validation.error || "Arquivo não atende aos requisitos de segurança." };
    }

    const storage = await getAttachmentStorage().catch(() => null);
    try {
      if (!storage) throw new Error("storage indisponível");
      await storage.put(validation.objectKey, bytes, formato.mime);
    } catch (err) {
      request.log.error({ err }, "falha ao enviar laudo ao armazenamento");
      reply.status(503);
      return { error: "O armazenamento de laudos não está disponível agora. Tente de novo em instantes; se persistir, avise o suporte." };
    }

    let attachment;
    try {
      [attachment] = await db
        .insert(clinicalAttachments)
        .values({
          tenantId: actor.tenantId,
          caseId,
          studentId: acesso.caso.studentId,
          uploaderId: actor.id,
          storageKey: validation.objectKey,
          originalName: fileName.trim().slice(0, 200),
          mimeType: formato.mime,
          fileSizeBytes: bytes.length,
          sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
          category: "laudo_externo",
          description: description?.trim().slice(0, 500) || null,
        })
        .returning();
    } catch (err) {
      request.log.error({ err }, "falha ao registrar o laudo");
      await storage!.remove(validation.objectKey).catch(() => undefined);
      reply.status(503);
      return { error: "Não foi possível registrar o laudo agora. Tente de novo." };
    }

    await recordAudit(
      {
        tenantId: actor.tenantId,
        userId: actor.id,
        userEmail: actor.email,
        action: "attachment.uploaded",
        entityType: "clinical_attachment",
        entityId: attachment.id,
        payload: { caseId, fileSizeBytes: attachment.fileSizeBytes, sha256: attachment.sha256 },
      },
      request
    );

    return {
      success: true,
      attachment: {
        id: attachment.id,
        originalName: attachment.originalName,
        category: attachment.category,
        fileSizeBytes: attachment.fileSizeBytes,
        mimeType: attachment.mimeType,
        description: attachment.description,
        createdAt: attachment.createdAt,
      },
    };
  });

  /** 2. Listar os laudos do caso. */
  app.get<{ Params: { caseId: string } }>("/api/cases/:caseId/attachments", async (request, reply) => {
    const actor = await requireCapability(request, reply, "attachments.read");
    if (!actor) return;

    const { caseId } = request.params;
    if (!(await casoAcessivel(actor, caseId, reply))) return;

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

  /** 3. Abrir o PDF no visualizador interno. O servidor lê do bucket privado; não há link público nem URL externa. */
  app.get<{ Params: { caseId: string; attachmentId: string } }>(
    "/api/cases/:caseId/attachments/:attachmentId/file",
    async (request, reply) => {
      const actor = await requireCapability(request, reply, "attachments.read");
      if (!actor) return;

      const { caseId, attachmentId } = request.params;
      if (!(await casoAcessivel(actor, caseId, reply))) return;

      const [attachment] = await db
        .select()
        .from(clinicalAttachments)
        .where(and(eq(clinicalAttachments.id, attachmentId), eq(clinicalAttachments.caseId, caseId), eq(clinicalAttachments.tenantId, actor.tenantId)))
        .limit(1);
      if (!attachment) {
        reply.status(404);
        return { error: "Anexo não encontrado." };
      }

      const acesso = validateSignedUrlAccess({
        actor: { id: actor.id, tenantId: actor.tenantId, role: actor.role as never },
        attachmentId,
        caseId,
        caseTenantId: attachment.tenantId,
        roleAllowedByPolicy: true, // capacidade attachments.read já exigida acima
      });
      if (!acesso.allowed) {
        reply.status(403);
        return { error: acesso.error };
      }

      let bytes: Buffer;
      try {
        bytes = await (await getAttachmentStorage()).get(attachment.storageKey);
      } catch (err) {
        request.log.error({ err }, "falha ao ler laudo do armazenamento");
        reply.status(503);
        return { error: "Não foi possível abrir o laudo agora. Tente de novo em instantes." };
      }

      await recordAudit(
        {
          tenantId: attachment.tenantId,
          userId: actor.id,
          userEmail: actor.email,
          action: "attachment.viewed",
          entityType: "clinical_attachment",
          entityId: attachment.id,
          payload: { caseId },
        },
        request
      );

      reply
        .header("Content-Type", attachment.mimeType === "image/jpeg" || attachment.mimeType === "image/png" ? attachment.mimeType : "application/pdf")
        .header("Content-Disposition", `inline; filename="laudo-${attachment.id}.${attachment.mimeType === "image/jpeg" ? "jpg" : attachment.mimeType === "image/png" ? "png" : "pdf"}"`)
        .header("Cache-Control", "private, no-store")
        .header("X-Content-Type-Options", "nosniff");
      return reply.send(bytes);
    }
  );
}
