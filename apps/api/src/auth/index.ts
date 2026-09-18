import { betterAuth } from "better-auth";
import { Pool } from "pg";

/**
 * Better Auth com Postgres (Neon) como storage de sessão/usuário.
 * RBAC próprio do domínio (admin_platform, municipal_manager, school_manager,
 * teacher, ppi, md1, board, researcher) fica em `users.role`, ver packages/shared/src/schema.ts.
 */
export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
  },
});
