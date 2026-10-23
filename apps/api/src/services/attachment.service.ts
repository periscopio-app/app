import { CLINICAL_ROLES, hasRole, Role } from "../security/roles";

export interface AttachmentUploadParams {
  actor: {
    id: string;
    tenantId: string;
    schoolId?: string;
    role: Role;
  };
  caseId: string;
  caseTenantId: string;
  filename: string;
  mimeType: string;
  sizeInBytes: number;
  /** Resultado da caixinha do Admin Master (attachments.write). Se informado, substitui a checagem fixa de papel. */
  roleAllowedByPolicy?: boolean;
  schoolId?: string;
  studentId?: string;
}

export interface SignedUrlRequestParams {
  actor: {
    id: string;
    tenantId: string;
    schoolId?: string;
    role: Role;
  };
  attachmentId: string;
  caseId: string;
  caseTenantId: string;
  /** Resultado da caixinha do Admin Master (attachments.read). Se informado, substitui a checagem fixa de papel. */
  roleAllowedByPolicy?: boolean;
}

const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"]; // laudos dos pais: PDF e foto do celular (JPG/PNG)
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Valida autorização e metadados para upload de anexos clínicos privados (Task 10).
 * Impede URLs públicas e arquivos com PII no nome do objeto.
 */
export function validateAttachmentUpload(params: AttachmentUploadParams): {
  allowed: boolean;
  objectKey?: string;
  error?: string;
} {
  const { actor, caseId, caseTenantId, filename, mimeType, sizeInBytes, roleAllowedByPolicy, schoolId, studentId } = params;

  // 1. Apenas papéis clínicos podem anexar laudos e relatórios
  if (!(roleAllowedByPolicy ?? hasRole(actor.role, CLINICAL_ROLES))) {
    return { allowed: false, error: "Acesso negado: apenas perfis clínicos podem enviar anexos ao prontuário." };
  }

  // 2. Validação Multi-tenant
  if (actor.tenantId !== caseTenantId) {
    return { allowed: false, error: "Acesso negado: município / tenant divergente." };
  }

  // 3. Validação de tamanho de arquivo
  if (sizeInBytes > MAX_FILE_SIZE_BYTES) {
    return { allowed: false, error: "Arquivo excede o limite máximo permitido de 10 MB." };
  }

  // 4. Validação do tipo MIME
  if (!ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
    return { allowed: false, error: "Formato não permitido. Envie o laudo em PDF, JPG ou PNG." };
  }

  // 5. Geração de chave opaca sem PII (pasta da escola + uuid do aluno no bucket do Supabase)
  const fileExt = filename.split(".").pop()?.toLowerCase() || "bin";
  const uniqueFileId = crypto.randomUUID();
  const objectKey =
    schoolId && studentId
      ? `schools/${schoolId}/${studentId}/${uniqueFileId}.${fileExt}`
      : `tenants/${actor.tenantId}/cases/${caseId}/${uniqueFileId}.${fileExt}`;

  return { allowed: true, objectKey };
}

/**
 * Valida autorização para geração de URL assinada temporária (Task 10).
 * URLs públicas são estritamente proibidas para prontuários clínicos.
 */
export function validateSignedUrlAccess(params: SignedUrlRequestParams): {
  allowed: boolean;
  expiresInSeconds?: number;
  error?: string;
} {
  const { actor, caseTenantId, roleAllowedByPolicy } = params;

  if (!(roleAllowedByPolicy ?? hasRole(actor.role, CLINICAL_ROLES))) {
    return { allowed: false, error: "Acesso negado: perfis administrativos não possuem acesso a anexos clínicos." };
  }

  if (actor.tenantId !== caseTenantId) {
    return { allowed: false, error: "Acesso negado: município / tenant divergente." };
  }

  // Expiração curta de 10 minutos (600s)
  return { allowed: true, expiresInSeconds: 600 };
}


export type FormatoLaudo = { mime: "application/pdf" | "image/jpeg" | "image/png"; ext: "pdf" | "jpg" | "png" };

/** Descobre o formato pelos primeiros bytes (o tipo informado pelo navegador não é confiável). Null se não for PDF, JPG ou PNG. */
export function detectarFormatoLaudo(bytes: Uint8Array): FormatoLaudo | null {
  const b = Buffer.from(bytes.subarray(0, 1024));
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (b.length >= 5 && b.toString("latin1").includes("%PDF-")) return { mime: "application/pdf", ext: "pdf" };
  return null;
}

export const ATTACHMENT_MAX_BYTES = MAX_FILE_SIZE_BYTES;

/** Armazenamento dos laudos. O padrão usa o bucket privado do Supabase; os testes trocam por uma versão em memória. */
export interface AttachmentStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

let storageOverride: AttachmentStorage | null = null;

export function setAttachmentStorage(storage: AttachmentStorage | null) {
  storageOverride = storage;
}

export async function getAttachmentStorage(): Promise<AttachmentStorage> {
  if (storageOverride) return storageOverride;
  const store = await import("../storage");
  return {
    put: async (key, body, contentType) => {
      await store.uploadObject(key, body, contentType);
    },
    get: async (key) => Buffer.from(await (await store.getObject(key)).arrayBuffer()),
    remove: (key) => store.removeObject(key),
  };
}
