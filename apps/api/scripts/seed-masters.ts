import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import crypto from "crypto";

try {
  process.loadEnvFile("../../.env");
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {}
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL não configurada no .env");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const MASTERS = [
  {
    email: "bruno@oceanoazul.dev.br",
    name: "Bruno Bisogni",
    role: "admin_platform",
    password: "Amor121314@#$",
  },
  {
    email: "admin@projetoperiscopio.com.br",
    name: "Administrador Master",
    role: "admin_platform",
    password: process.env.MASTER_PASSWORD || "Periscopio@Master2026!",
  },
];

async function main() {
  const client = await pool.connect();
  try {
    console.log("Conectado ao Neon PostgreSQL...");

    // 1. Garantir tenant global da plataforma
    const globalTenantId = "00000000-0000-0000-0000-000000000001";
    await client.query(`
      INSERT INTO tenants (id, name, municipality_code)
      VALUES ($1, 'Periscópio Plataforma Global', '0000000')
      ON CONFLICT (id) DO NOTHING;
    `, [globalTenantId]);
    console.log("Tenant global garantido.");

    for (const master of MASTERS) {
      const email = master.email.toLowerCase().trim();
      const hashedPassword = await hashPassword(master.password);

      // 2. Verificar/Criar no neon_auth.user
      let userId: string;
      const existingAuthUser = await client.query(
        `SELECT id FROM neon_auth.user WHERE LOWER(email) = $1`,
        [email]
      );

      if (existingAuthUser.rows.length > 0) {
        userId = existingAuthUser.rows[0].id;
        console.log(`neon_auth.user já existe para ${email} (ID: ${userId})`);
        await client.query(
          `UPDATE neon_auth.user SET name = $1, role = 'admin', "emailVerified" = true, "updatedAt" = NOW() WHERE id = $2`,
          [master.name, userId]
        );
      } else {
        userId = crypto.randomUUID();
        await client.query(
          `INSERT INTO neon_auth.user (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, true, 'admin', NOW(), NOW())`,
          [userId, master.name, email]
        );
        console.log(`neon_auth.user criado para ${email} (ID: ${userId})`);
      }

      // 3. Atualizar/Inserir senha no neon_auth.account
      const existingAccount = await client.query(
        `SELECT id FROM neon_auth.account WHERE "userId" = $1 AND "providerId" = 'credential'`,
        [userId]
      );

      if (existingAccount.rows.length > 0) {
        await client.query(
          `UPDATE neon_auth.account SET password = $1, "updatedAt" = NOW() WHERE id = $2`,
          [hashedPassword, existingAccount.rows[0].id]
        );
        console.log(`Senha atualizada no neon_auth.account para ${email}`);
      } else {
        const accountId = crypto.randomUUID();
        await client.query(
          `INSERT INTO neon_auth.account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
           VALUES ($1, $2, 'credential', $3, $4, NOW(), NOW())`,
          [accountId, email, userId, hashedPassword]
        );
        console.log(`Conta com senha criada no neon_auth.account para ${email}`);
      }

      // 4. Inserir/Atualizar na tabela de domínio public.users
      const existingDomainUser = await client.query(
        `SELECT id FROM public.users WHERE LOWER(email) = $1`,
        [email]
      );

      if (existingDomainUser.rows.length > 0) {
        await client.query(
          `UPDATE public.users SET name = $1, role = $2, "tenant_id" = $3, "school_id" = NULL WHERE LOWER(email) = $4`,
          [master.name, master.role, globalTenantId, email]
        );
        console.log(`public.users atualizado para ${email} com role ${master.role}`);
      } else {
        await client.query(
          `INSERT INTO public.users (id, "tenant_id", "school_id", email, name, role, "created_at")
           VALUES ($1, $2, NULL, $3, $4, $5, NOW())`,
          [userId, globalTenantId, email, master.name, master.role]
        );
        console.log(`public.users criado para ${email} com role ${master.role}`);
      }
    }

    console.log("\n✅ Ambos os usuários master foram criados com sucesso!");
    console.log("Credenciais configuradas:");
    for (const m of MASTERS) {
      console.log(`- Email: ${m.email} | Perfil: ${m.role} | Senha inicial: ${m.password}`);
    }
  } catch (err) {
    console.error("Erro ao rodar seed de masters:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
