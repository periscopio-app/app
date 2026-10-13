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

/**
 * Garante que os usuários master configurados no ambiente (.env) existam no neon_auth
 * e em public.users com as senhas corretas definidas no ambiente.
 */
export async function seedMasterAccounts(): Promise<void> {
  const client = await (db as any).$client;
  if (!client?.query) return;

  const masters = [
    {
      email: process.env.SEED_MASTER_1_EMAIL || "bruno@oceanoazul.dev.br",
      name: process.env.SEED_MASTER_1_NAME || "Bruno Bisogni",
      password: process.env.SEED_MASTER_1_PASSWORD || "Amor131313@",
    },
    {
      email: process.env.SEED_MASTER_2_EMAIL || "admin@projetoperiscopio.com.br",
      name: process.env.SEED_MASTER_2_NAME || "Administrador Master",
      password: process.env.SEED_MASTER_2_PASSWORD || "Periscopio@Master2026!",
    },
  ];

  const globalTenantId = "00000000-0000-0000-0000-000000000001";
  await client.query(`
    INSERT INTO tenants (id, name, municipality_code)
    VALUES ($1, 'Periscópio Plataforma Global', '0000000')
    ON CONFLICT (id) DO NOTHING;
  `, [globalTenantId]).catch(() => {});

  for (const m of masters) {
    if (!m.email || !m.password) continue;
    const email = m.email.toLowerCase().trim();
    const hashed = await hashPassword(m.password);

    // 1. Garantir neon_auth.user
    const existing = await client.query(
      `SELECT id FROM neon_auth."user" WHERE lower(email) = $1 LIMIT 1`,
      [email]
    );

    let userId: string;
    if (existing.rows.length > 0) {
      userId = existing.rows[0].id;
      await client.query(
        `UPDATE neon_auth."user" SET name = $1, "emailVerified" = true, "updatedAt" = NOW() WHERE id = $2`,
        [m.name, userId]
      );
    } else {
      userId = crypto.randomUUID();
      await client.query(
        `INSERT INTO neon_auth."user" (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, 'admin', NOW(), NOW())`,
        [userId, m.name, email]
      );
    }

    // 2. Garantir neon_auth.account com senha atualizada
    const acc = await client.query(
      `SELECT id FROM neon_auth.account WHERE "userId" = $1 AND "providerId" = 'credential' LIMIT 1`,
      [userId]
    );
    if (acc.rows.length > 0) {
      await client.query(
        `UPDATE neon_auth.account SET password = $1, "accountId" = $2::text, "updatedAt" = NOW() WHERE id = $3`,
        [hashed, userId, acc.rows[0].id]
      );
    } else {
      await client.query(
        `INSERT INTO neon_auth.account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
         VALUES ($1, $2, 'credential', $2, $3, NOW(), NOW())`,
        [crypto.randomUUID(), userId, hashed]
      );
    }

    // 3. Garantir public.users
    const domainUser = await client.query(
      `SELECT id FROM public.users WHERE lower(email) = $1 LIMIT 1`,
      [email]
    );
    if (domainUser.rows.length > 0) {
      await client.query(
        `UPDATE public.users SET name = $1, role = 'admin_platform', "tenant_id" = $2, "access_enabled" = true WHERE id = $3`,
        [m.name, globalTenantId, domainUser.rows[0].id]
      );
    } else {
      await client.query(
        `INSERT INTO public.users (id, "tenant_id", "school_id", email, name, role, "access_enabled", "created_at")
         VALUES ($1, $2, NULL, $3, $4, 'admin_platform', true, NOW())`,
        [userId, globalTenantId, email, m.name]
      );
    }
  }
}
