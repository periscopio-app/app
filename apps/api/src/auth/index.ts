import { betterAuth } from "better-auth";
import { Pool } from "pg";

/**
 * Better Auth com Postgres (Neon) como storage de sessão/usuário.
 * Suporta autenticação por E-mail/Senha e Google OAuth.
 * RBAC próprio do domínio (admin_platform, municipal_manager, school_manager,
 * teacher, ppi, md1, board, researcher) fica em `users.role`, ver packages/shared/src/schema.ts.
 */
const authSecret = process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET;
const authBaseUrl = process.env.BETTER_AUTH_URL || process.env.NEON_AUTH_URL;

if (process.env.NODE_ENV === "production") {
  if (!authSecret) {
    throw new Error("BETTER_AUTH_SECRET é obrigatória em produção.");
  }
  if (!authBaseUrl) {
    throw new Error("BETTER_AUTH_URL é obrigatória em produção.");
  }
}

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.DATABASE_URL?.includes("sslmode=require") ||
      process.env.DATABASE_URL?.includes("neon.tech") ||
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : undefined,
  }),
  secret: authSecret ?? "dev_only_secret_replace_in_production",
  baseURL: authBaseUrl ?? "http://localhost:3001",
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
  trustedOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000,https://periscopio-web.vercel.app")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
});
