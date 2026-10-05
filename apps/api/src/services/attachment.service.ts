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
}

const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
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
  const { actor, caseId, caseTenantId, filename, mimeType, sizeInBytes } = params;

  // 1. Apenas papéis clínicos podem anexar laudos e relatórios
  if (!hasRole(actor.role, CLINICAL_ROLES)) {
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
    return { allowed: false, error: "Formato de arquivo não permitido. Apenas PDF, JPG, PNG e WEBP são aceitos." };
  }

  // 5. Geração de chave opaca sem PII (Evita nome original contendo nome de paciente)
  const fileExt = filename.split(".").pop()?.toLowerCase() || "bin";
  const objectKey = `tenants/${actor.tenantId}/cases/${caseId}/${crypto.randomUUID()}.${fileExt}`;

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
  const { actor, caseTenantId } = params;

  if (!hasRole(actor.role, CLINICAL_ROLES)) {
    return { allowed: false, error: "Acesso negado: perfis administrativos não possuem acesso a anexos clínicos." };
  }

  if (actor.tenantId !== caseTenantId) {
    return { allowed: false, error: "Acesso negado: município / tenant divergente." };
  }

  // Expiração curta de 10 minutos (600s)
  return { allowed: true, expiresInSeconds: 600 };
}
