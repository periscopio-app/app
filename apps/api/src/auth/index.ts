import { betterAuth } from "better-auth";
import { Pool } from "pg";

/**
 * Better Auth com Postgres (Neon) como storage de sessão/usuário.
 * Suporta autenticação por E-mail/Senha e Google OAuth.
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
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: Boolean(process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
    },
  },
  trustedOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
});
