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
import { gravarLaudoNoBanco } from "../services/attachment-store.service";
import { can } from "../services/privilege.service";

type Actor = NonNullable<Awaited<ReturnType<typeof requireCapability>>>;

const RE_LIKE = new Set(["ppi", "re", "responsavel_escolar"]);

/**
 * Laudos que os pais levam (Bloco 5): PDF e foto do celular (JPG/PNG). Só o RE e o médico enviam e abrem; especialistas, gestão e Board nunca
 * (a regra mora nas capacidades attachments.write/read). O laudo é OPCIONAL: nada no fluxo o exige. O arquivo fica no
 * próprio banco (coluna content) e é servido pelo servidor, depois de conferir sessão, município e escola. Não existe
 * link público. Laudos antigos que ficaram no bucket do Supabase continuam sendo lidos de lá.
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

  /**
   * O arquivo chega como corpo binário (Content-Type do próprio arquivo), sem base64 nem JSON. Isso importa: o servidor tem
   * 512 MB e ~290 MB já em uso em repouso; o envio em base64 fazia várias cópias de um arquivo de até 10 MB e a Render
   * matava o processo por falta de memória (05/nov/2026). Em binário o pico é ~2x o tamanho do arquivo.
   */
  app.addContentTypeParser(
    /^(application\/(pdf|octet-stream)|image\/(jpeg|jpg|png))(;.*)?$/i,
    { parseAs: "buffer", bodyLimit: ATTACHMENT_MAX_BYTES + 4096 },
    (_request, body, done) => done(null, body)
  );

  /** 1. Enviar um laudo em PDF, JPG ou PNG (corpo binário, até 10 MB). O nome vem em X-File-Name (codificado em URL). */
  app.post<{ Params: { caseId: string } }>(
    "/api/cases/:caseId/attachments",
    { bodyLimit: ATTACHMENT_MAX_BYTES + 4096 },
    async (request, reply) => {
    const actor = await requireCapability(request, reply, "attachments.write");
    if (!actor) return;

    const { caseId } = request.params;
    const acesso = await casoAcessivel(actor, caseId, reply);
    if (!acesso) return;

    if (!Buffer.isBuffer(request.body)) {
      reply.status(415);
      return { error: "Envie o laudo como arquivo PDF, JPG ou PNG." };
    }
    const bytes = request.body;
    let fileName = "";
    try {
      fileName = decodeURIComponent(String(request.headers["x-file-name"] ?? "")).trim();
    } catch {
      fileName = "";
    }
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

    let attachment;
    try {
      attachment = await gravarLaudoNoBanco({
        tenantId: actor.tenantId,
        caseId,
        studentId: acesso.caso.studentId,
        uploaderId: actor.id,
        storageKey: validation.objectKey,
        originalName: (fileName || `laudo.${formato.ext}`).slice(0, 200),
        mimeType: formato.mime,
        fileSizeBytes: bytes.length,
        sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
        category: "laudo_externo",
        content: bytes,
      });
    } catch (err) {
      // O erro é curto e sem o arquivo (ver attachment-store.service.ts): logar não infla a memória.
      request.log.error({ codigo: (err as { codigo?: string }).codigo }, "falha ao registrar o laudo");
      reply.status(503);
      return { error: "Não foi possível registrar o laudo agora. O laudo é opcional: você pode continuar e tentar de novo depois." };
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

    // Regra da Dra. (23/out): o médico vê todos os laudos do caso; o RE só os que ele mesmo enviou.
    const veTodos = await can(actor, "school.read_full");
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
      .where(
        and(
          eq(clinicalAttachments.tenantId, actor.tenantId),
          eq(clinicalAttachments.caseId, caseId),
          veTodos ? undefined : eq(clinicalAttachments.uploaderId, actor.id)
        )
      )
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

      const veTodos = await can(actor, "school.read_full");
      const [attachment] = await db
        .select()
        .from(clinicalAttachments)
        .where(
          and(
            eq(clinicalAttachments.id, attachmentId),
            eq(clinicalAttachments.caseId, caseId),
            eq(clinicalAttachments.tenantId, actor.tenantId),
            veTodos ? undefined : eq(clinicalAttachments.uploaderId, actor.id)
          )
        )
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
        bytes = attachment.content ? Buffer.from(attachment.content.buffer, attachment.content.byteOffset, attachment.content.byteLength) : await (await getAttachmentStorage()).get(attachment.storageKey);
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
