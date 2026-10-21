import crypto from "crypto";

/**
 * Cifra do cofre de identidade do aluno (AES-256-GCM). Compartilhada pelas rotas do cofre e pela leitura
 * do nome na tela do caso, para que exista um único lugar que cifra e decifra.
 */
const ENCRYPTION_SECRET = process.env.IDENTITY_VAULT_KEY || "periscopio-identity-vault-secret-32b!";
const ALGORITHM = "aes-256-gcm";

export function encryptText(text: string): string {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash("sha256").update(ENCRYPTION_SECRET).digest();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptText(encryptedData: string): string {
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
