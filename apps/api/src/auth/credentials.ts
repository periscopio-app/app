import crypto from "crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../db/client";

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
    `UPDATE neon_auth.account SET password = $2, "updatedAt" = NOW()
     WHERE "userId" = $1 AND "providerId" = 'credential'`,
    [userId, hashed],
  );
  if (updated.rowCount === 0) {
    await client.query(
      `INSERT INTO neon_auth.account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       VALUES ($1, $2, 'credential', $3, $4, NOW(), NOW())`,
      [crypto.randomUUID(), email, userId, hashed],
    );
  }
}
