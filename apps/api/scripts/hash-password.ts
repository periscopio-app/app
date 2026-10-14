/**
 * Gera o hash (formato do Better Auth) de uma senha, para guardar no ambiente em vez do texto.
 *
 *   HASH_PASSWORD='<senha>' pnpm --filter @periscopio/api hash:password
 *
 * Imprime somente o hash. Use o resultado em SEED_MASTER_1_PASSWORD_HASH / SEED_MASTER_2_PASSWORD_HASH.
 */
import { hashPassword } from "better-auth/crypto";

const password = process.env.HASH_PASSWORD;
if (!password) {
  console.error("Defina HASH_PASSWORD no ambiente (a senha não é aceita como argumento para não ficar no histórico do shell).");
  process.exit(1);
}
hashPassword(password).then((h) => { console.log(h); process.exit(0); });
