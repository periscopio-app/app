import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { db } from "../db/client";
import { studentIdentityVault, students } from "@periscopio/shared";
import { requireActor } from "../security/actor";
import { canAccessStudentIdentityVault } from "../services/identity-vault.service";
import { recordAudit } from "../services/audit.service";
import { CLINICAL_ROLES, hasRole, isSuperAdminEmail } from "../security/roles";

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
  app.post("/api/students/:studentId/vault", async (request, reply) => {
    const actor = await requireActor(request, reply, [...CLINICAL_ROLES, "admin_platform"]);
    if (!actor) return;

    const { studentId } = request.params as { studentId: string };
    const body = request.body as {
      fullName: string;
      document?: string;
      contact?: string;
    };

    if (!body.fullName || body.fullName.trim().length < 2) {
      reply.status(400);
      return { error: "Informe o nome completo do aluno para armazenamento seguro." };
    }

    const [student] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
    if (!student) {
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
  });

  /**
   * 2. Revelar temporariamente dados do cofre mediante justificativa clínica e auditoria
   */
  app.post("/api/students/:studentId/vault/reveal", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    const { studentId } = request.params as { studentId: string };
    const { accessReason } = (request.body as { accessReason?: string }) || {};

    const [student] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
    if (!student) {
      reply.status(404);
      return { error: "Aluno não encontrado." };
    }

    // Validação estrita de autorização (Cofre é restrito a clínicos e auditado)
    const authCheck = canAccessStudentIdentityVault({
      actor: {
        id: actor.id,
        tenantId: actor.tenantId,
        schoolId: actor.schoolId,
        role: actor.role,
      },
      studentId,
      studentSchoolId: student.schoolId,
      studentTenantId: student.tenantId,
      accessReason: accessReason || "",
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

    // Registra a revelação na auditoria imutável
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
  });
}
