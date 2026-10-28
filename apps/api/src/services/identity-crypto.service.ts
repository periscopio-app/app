import crypto from "crypto";

/**
 * Cifra do cofre de identidade do aluno (AES-256-GCM). Compartilhada pelas rotas do cofre e pela leitura
 * do nome na tela do caso, para que exista um único lugar que cifra e decifra.
 */
const ALGORITHM = "aes-256-gcm";

function encryptionKey(): Buffer {
  const secret = process.env.IDENTITY_VAULT_KEY?.trim();
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("IDENTITY_VAULT_KEY precisa estar configurada com pelo menos 32 bytes.");
  }
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

/** Valida a configuração antes de iniciar a API em produção. */
export function assertIdentityVaultKeyConfigured(): void {
  encryptionKey();
}

export class IdentityVaultDecryptionError extends Error {
  constructor() {
    super("Não foi possível decifrar um registro do cofre de identidade.");
    this.name = "IdentityVaultDecryptionError";
  }
}

export function encryptText(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptText(encryptedData: string): string {
  const key = encryptionKey();
  try {
    const parts = encryptedData.split(":");
    if (parts.length !== 3) throw new Error("invalid envelope");
    const [ivHex, tagHex, dataHex] = parts;
    if (!/^[a-f\d]{24}$/i.test(ivHex) || !/^[a-f\d]{32}$/i.test(tagHex) || !/^(?:[a-f\d]{2})*$/i.test(dataHex)) {
      throw new Error("invalid envelope");
    }
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
  } catch {
    throw new IdentityVaultDecryptionError();
  }
}
