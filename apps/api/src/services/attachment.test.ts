import { test } from "node:test";
import assert from "node:assert";
import { validateAttachmentUpload, validateSignedUrlAccess } from "./attachment.service";

test("anexos clínicos: gera chave de armazenamento opaca sem nome/PII do paciente", () => {
  const res = validateAttachmentUpload({
    actor: { id: "user-md1", tenantId: "tenant-rio", role: "md1" },
    caseId: "case-999",
    caseTenantId: "tenant-rio",
    filename: "Laudo_Neurologico_Joao_Silva.pdf", // Nome legível do cliente
    mimeType: "application/pdf",
    sizeInBytes: 2 * 1024 * 1024, // 2MB
  });

  assert.strictEqual(res.allowed, true);
  assert.ok(res.objectKey);
  assert.strictEqual(res.objectKey?.startsWith("tenants/tenant-rio/cases/case-999/"), true);
  assert.doesNotMatch(res.objectKey || "", /joao|silva/i); // Sem PII na chave do Supabase
});

test("anexos clínicos: rejeita arquivos que excedem 10MB ou com formato inválido", () => {
  // 1. Arquivo de 15MB -> Rejeitado
  const tooLargeRes = validateAttachmentUpload({
    actor: { id: "user-md1", tenantId: "tenant-rio", role: "md1" },
    caseId: "case-999",
    caseTenantId: "tenant-rio",
    filename: "exame.pdf",
    mimeType: "application/pdf",
    sizeInBytes: 15 * 1024 * 1024,
  });

  assert.strictEqual(tooLargeRes.allowed, false);
  assert.match(tooLargeRes.error || "", /excede o limite máximo/);

  // 2. Executável .exe -> Rejeitado
  const invalidTypeRes = validateAttachmentUpload({
    actor: { id: "user-md1", tenantId: "tenant-rio", role: "md1" },
    caseId: "case-999",
    caseTenantId: "tenant-rio",
    filename: "malware.exe",
    mimeType: "application/x-msdownload",
    sizeInBytes: 1 * 1024 * 1024,
  });

  assert.strictEqual(invalidTypeRes.allowed, false);
  assert.match(invalidTypeRes.error || "", /Formato de arquivo não permitido/);
});

test("download seguro: gera URL assinada temporária (600s) e nega acesso a perfis administrativos", () => {
  // 1. Perfil clínico -> Autorizado com expiração de 600s
  const validAccess = validateSignedUrlAccess({
    actor: { id: "user-specialist", tenantId: "tenant-rio", role: "specialist" },
    attachmentId: "att-123",
    caseId: "case-999",
    caseTenantId: "tenant-rio",
  });

  assert.strictEqual(validAccess.allowed, true);
  assert.strictEqual(validAccess.expiresInSeconds, 600);

  // 2. Perfil administrativo -> Negado
  const adminAccess = validateSignedUrlAccess({
    actor: { id: "user-admin", tenantId: "tenant-rio", role: "admin_platform" },
    attachmentId: "att-123",
    caseId: "case-999",
    caseTenantId: "tenant-rio",
  });

  assert.strictEqual(adminAccess.allowed, false);
  assert.match(adminAccess.error || "", /perfis administrativos não possuem acesso/);
});
