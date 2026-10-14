import type { FastifyInstance } from "fastify";
import { eq, desc, inArray } from "drizzle-orm";
import crypto from "crypto";
import { db } from "../db/client";
import { auditLogs, studentIdentityVault, students } from "@periscopio/shared";
import { requireActor, requireCapability } from "../security/actor";
import { canAccessSchool } from "../security/tenancy";
import { canAccessStudentIdentityVault } from "../services/identity-vault.service";
import { recordAudit } from "../services/audit.service";
import { CLINICAL_ROLES, isSuperAdminEmail } from "../security/roles";

const ENCRYPTION_SECRET = process.env.IDENTITY_VAULT_KEY || "periscopio-identity-vault-secret-32b!";
const ALGORITHM = "aes-256-gcm";

function encryptText(text: string): string {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash("sha256").update(ENCRYPTION_SECRET).digest();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptText(encryptedData: string): string {
  try {
    const [ivHex, tagHex, dataHex] = encryptedData.split(":");
    if (!ivHex || !tagHex || !dataHex) return encryptedData;
    const key = crypto.createHash("sha256").update(ENCRYPTION_SECRET).digest();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return decipher.update(Buffer.from(dataHex, "hex")) + decipher.final("utf8");
  } catch {
    return encryptedData;
  }
}

export async function identityVaultRoutes(app: FastifyInstance) {
  /**
   * 1. Salvar ou atualizar dados cifrados no cofre de identidade
   */
  app.post<{
    Params: { studentId: string };
    Body: { fullName: string; document?: string; contact?: string };
  }>(
    "/api/students/:studentId/vault",
    {
      schema: {
        description: "Armazena dados civis da criança sob cifra criptográfica AES-256 GCM, desacoplados dos relatórios e BI",
        tags: ["Cofre de Identidade do Aluno"],
        params: {
          type: "object",
          required: ["studentId"],
          properties: {
            studentId: { type: "string", format: "uuid", example: "45f088ee-f001-4686-90e8-0b5c1fb67111" },
          },
        },
        body: {
          type: "object",
          required: ["fullName"],
          properties: {
            fullName: { type: "string", example: "Enzo Gabriel da Silva Santos" },
            document: { type: "string", example: "524.891.038-22" },
            contact: { type: "string", example: "Mãe: Silvia Helena (18) 99876-5432" },
          },
        },
        response: {
          200: {
            description: "Identidade civil cifrada e vinculada com sucesso",
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              studentCode: { type: "string", example: "TARUMA-2018-998877AA" },
              message: { type: "string", example: "Dados de identificação armazenados com sucesso sob cifra AES-256 no cofre." },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const actor = await requireCapability(request, reply, "vault.register");
      if (!actor) return;

      const { studentId } = request.params;
      const body = request.body;

      if (!body.fullName || body.fullName.trim().length < 2) {
        reply.status(400);
        return { error: "Informe o nome completo do aluno para armazenamento seguro." };
      }

      const [student] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
      if (!student || !canAccessSchool(actor, student.tenantId, student.schoolId)) {
        reply.status(404);
        return { error: "Aluno não encontrado." };
      }

      const encryptedFullName = encryptText(body.fullName.trim());
      const encryptedDocument = body.document ? encryptText(body.document.trim()) : null;
      const encryptedContact = body.contact ? encryptText(body.contact.trim()) : null;

      const [existing] = await db
        .select({ id: studentIdentityVault.id })
        .from(studentIdentityVault)
        .where(eq(studentIdentityVault.studentId, studentId))
        .limit(1);

      if (existing) {
        await db
          .update(studentIdentityVault)
          .set({
            encryptedFullName,
            encryptedDocument,
            encryptedContact,
            updatedAt: new Date(),
          })
          .where(eq(studentIdentityVault.id, existing.id));
      } else {
        await db.insert(studentIdentityVault).values({
          tenantId: student.tenantId,
          studentId,
          encryptedFullName,
          encryptedDocument,
          encryptedContact,
        });
      }

      await recordAudit(
        {
          tenantId: student.tenantId,
          userId: actor.id,
          userEmail: actor.email,
          action: "student.vault_updated",
          entityType: "student_identity_vault",
          entityId: studentId,
          payload: {
            studentCode: student.studentCode,
          },
        },
        request
      );

      return {
        success: true,
        studentCode: student.studentCode,
        message: "Dados de identificação armazenados com sucesso sob cifra AES-256 no cofre.",
      };
    }
  );

  /**
   * 2. Revelar temporariamente dados do cofre mediante justificativa clínica e auditoria
   */
  app.post<{
    Params: { studentId: string };
    Body: { accessReason?: string };
  }>(
    "/api/students/:studentId/vault/reveal",
    {
      schema: {
        description: "Descriptografa temporariamente a identidade civil para ato clínico, exigindo justificativa obrigatória e gravando auditoria permanente",
        tags: ["Cofre de Identidade do Aluno"],
        params: {
          type: "object",
          required: ["studentId"],
          properties: {
            studentId: { type: "string", format: "uuid", example: "45f088ee-f001-4686-90e8-0b5c1fb67111" },
          },
        },
        body: {
          type: "object",
          required: ["accessReason"],
          properties: {
            accessReason: {
              type: "string",
              description: "Justificativa clínica obrigatória (mínimo 5 caracteres)",
              example: "Emissão de guia de encaminhamento médico para CAPS Infantil e contato prévio com a família.",
            },
          },
        },
        response: {
          200: {
            description: "Identidade civil revelada sob sigilo e auditoria",
            type: "object",
            properties: {
              hasData: { type: "boolean", example: true },
              fullName: { type: "string", example: "Enzo Gabriel da Silva Santos" },
              document: { type: "string", example: "524.891.038-22" },
              contact: { type: "string", example: "Mãe: Silvia Helena (18) 99876-5432" },
              message: { type: "string", example: "Dados revelados temporariamente sob autorização e auditoria clínica." },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const actor = await requireCapability(request, reply, "vault.reveal");
      if (!actor) return;

      const { studentId } = request.params;
      const { accessReason } = request.body || {};

      const [student] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
      if (!student) {
        reply.status(404);
        return { error: "Aluno não encontrado." };
      }

      const authCheck = canAccessStudentIdentityVault({
        actor: {
          id: actor.id,
          tenantId: actor.tenantId,
          schoolId: actor.schoolId || undefined,
          role: actor.role,
        },
        studentId,
        studentSchoolId: student.schoolId,
        studentTenantId: student.tenantId,
        accessReason: accessReason || "",
        roleAllowedByPolicy: true, // a caixinha vault.reveal já foi exigida acima
      });

      if (!authCheck.allowed && !isSuperAdminEmail(actor.email)) {
        reply.status(403);
        return { error: authCheck.reason || "Acesso negado ao cofre de identidade." };
      }

      const [vaultRecord] = await db
        .select()
        .from(studentIdentityVault)
        .where(eq(studentIdentityVault.studentId, studentId))
        .limit(1);

      if (!vaultRecord) {
        return {
          hasData: false,
          message: "Nenhum registro de identificação civil cadastrado para este estudante.",
        };
      }

      await recordAudit(
        {
          tenantId: student.tenantId,
          userId: actor.id,
          userEmail: actor.email,
          action: "student.vault_revealed",
          entityType: "student_identity_vault",
          entityId: studentId,
          payload: {
            studentCode: student.studentCode,
            accessReason,
          },
        },
        request
      );

      return {
        hasData: true,
        fullName: decryptText(vaultRecord.encryptedFullName),
        document: vaultRecord.encryptedDocument ? decryptText(vaultRecord.encryptedDocument) : null,
        contact: vaultRecord.encryptedContact ? decryptText(vaultRecord.encryptedContact) : null,
        message: "Dados revelados temporariamente sob autorização e auditoria clínica.",
      };
    }
  );

  /**
   * 3. Consultar status do cofre (se já existe cadastro civil cifrado) sem revelar PII
   */
  app.get<{ Params: { studentId: string } }>(
    "/api/students/:studentId/vault/status",
    async (request, reply) => {
      const actor = await requireActor(request, reply);
      if (!actor) return;

      const { studentId } = request.params;
      const [student] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
      if (!student) {
        reply.status(404);
        return { error: "Aluno não encontrado." };
      }

      const [vaultRecord] = await db
        .select({
          id: studentIdentityVault.id,
          hasDocument: studentIdentityVault.encryptedDocument,
          hasContact: studentIdentityVault.encryptedContact,
          updatedAt: studentIdentityVault.updatedAt,
          createdAt: studentIdentityVault.createdAt,
        })
        .from(studentIdentityVault)
        .where(eq(studentIdentityVault.studentId, studentId))
        .limit(1);

      return {
        hasData: !!vaultRecord,
        hasDocument: !!vaultRecord?.hasDocument,
        hasContact: !!vaultRecord?.hasContact,
        updatedAt: vaultRecord?.updatedAt || null,
        createdAt: vaultRecord?.createdAt || null,
      };
    }
  );

  /**
   * 4. Trilha de auditoria das revelações e operações do cofre (Governança DPO e Admin)
   */
  app.get("/api/admin/vault/audit-logs", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    if (actor.role !== "admin_platform" && actor.role !== "board" && !isSuperAdminEmail(actor.email)) {
      reply.status(403);
      return { error: "Acesso restrito ao Encarregado pelo Tratamento de Dados (DPO) e Administrador Master." };
    }

    const logs = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.actorId,
        userEmail: auditLogs.userEmail,
        action: auditLogs.action,
        entityType: auditLogs.entity,
        entityId: auditLogs.entityId,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        payload: auditLogs.payload,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(
        inArray(auditLogs.action, ["student.vault_revealed", "student.vault_updated"])
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);

    return { logs };
  });
}

