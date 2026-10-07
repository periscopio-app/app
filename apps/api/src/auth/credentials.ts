import crypto from "crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../db/client";

/**
 * Impressão digital da credencial atual do e-mail ("sem-credencial" quando ainda não há senha).
 * Muda sempre que a senha muda; usada para invalidar links de acesso já consumidos.
 */
export async function credentialFingerprint(email: string): Promise<string> {
  const client = await (db as any).$client;
  if (!client?.query) throw new Error("Cliente SQL indisponível para ler credencial.");
  const res = await client.query(
    `SELECT a.password
       FROM neon_auth."user" u
       JOIN neon_auth.account a ON a."userId" = u.id AND a."providerId" = 'credential'
      WHERE lower(u.email) = $1
      LIMIT 1`,
    [email.toLowerCase().trim()],
  );
  const password: string | null = res.rows[0]?.password ?? null;
  return crypto
    .createHash("sha256")
    .update(password ?? "sem-credencial")
    .digest("hex")
    .slice(0, 16);
}

/**
 * Cria (ou redefine) a credencial de e-mail/senha no Better Auth (schema neon_auth).
 * Só deve ser chamada depois de provar a posse do e-mail (link de convite enviado ao endereço).
 * O cadastro público está desligado; este é o único caminho para criar credenciais.
 */
export async function upsertCredential(opts: {
  email: string;
  name: string;
  password: string;
  isAdmin?: boolean;
}): Promise<void> {
  const client = await (db as any).$client;
  if (!client?.query) throw new Error("Cliente SQL indisponível para criar credencial.");

  const email = opts.email.toLowerCase().trim();
  const hashed = await hashPassword(opts.password);

  const found = await client.query(
    `SELECT id FROM neon_auth."user" WHERE lower(email) = $1 LIMIT 1`,
    [email],
  );

  let userId: string;
  if (found.rows.length > 0) {
    userId = found.rows[0].id;
    await client.query(
      `UPDATE neon_auth."user" SET "emailVerified" = true, "updatedAt" = NOW() WHERE id = $1`,
      [userId],
    );
  } else {
    userId = crypto.randomUUID();
    await client.query(
      `INSERT INTO neon_auth."user" (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, $4, NOW(), NOW())`,
      [userId, opts.name, email, opts.isAdmin ? "admin" : "user"],
    );
  }

  const updated = await client.query(
    `UPDATE neon_auth.account SET password = $2, "accountId" = $1::text, "updatedAt" = NOW()
     WHERE "userId" = $1 AND "providerId" = 'credential'`,
    [userId, hashed],
  );
  if (updated.rowCount === 0) {
    await client.query(
      `INSERT INTO neon_auth.account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       VALUES ($1, $2, 'credential', $3, $4, NOW(), NOW())`,
      [crypto.randomUUID(), userId, userId, hashed],
    );
  }
}

/**
 * O Better Auth só aceita a conta de e-mail/senha quando `account.accountId` é igual ao id do
 * usuário; qualquer outra coisa vira "User not found" no login. Credenciais criadas antes desta
 * correção usavam o e-mail (ou um UUID aleatório) nesse campo. Corrige-as na subida da API
 * (idempotente) para que as senhas já definidas voltem a funcionar.
 */
export async function healCredentialAccounts(): Promise<number> {
  const client = await (db as any).$client;
  if (!client?.query) return 0;
  const res = await client.query(
    `UPDATE neon_auth.account SET "accountId" = "userId"::text, "updatedAt" = NOW()
      WHERE "providerId" = 'credential' AND "accountId" IS DISTINCT FROM "userId"::text`,
  );
  return res.rowCount ?? 0;
}
