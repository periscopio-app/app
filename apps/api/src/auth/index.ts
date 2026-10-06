import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { sendEmail } from "../email/index";
import { resetPasswordEmail, verificationEmail } from "../email/templates";

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

const emailEnabled = Boolean(process.env.RESEND_API_KEY);

/**
 * O Better Auth monta os links com a URL da API (Render). Trocamos pela origem do
 * site (APP_URL): o Next repassa /api/* para a API, e o cookie fica first-party.
 */
function toWebUrl(url: string): string {
  const appUrl = process.env.APP_URL;
  if (!appUrl) return url;
  try {
    const u = new URL(url);
    const web = new URL(appUrl);
    u.protocol = web.protocol;
    u.host = web.host;
    return u.toString();
  } catch {
    return url;
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
  // As tabelas de auth (neon_auth.*) usam colunas uuid; o Better Auth gera ids
  // alfanumericos por padrao, o que quebra o INSERT.
  advanced: {
    database: { generateId: "uuid" },
  },
  emailAndPassword: {
    enabled: true,
    // Sem cadastro público: credenciais só nascem pelo convite (ver auth/credentials.ts).
    disableSignUp: true,
    // Só exigir confirmação quando o envio de e-mail estiver configurado E a flag ligada;
    // caso contrário ninguém conseguiria entrar.
    requireEmailVerification: emailEnabled && process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "true",
    sendResetPassword: async ({ user, url }) => {
      if (!emailEnabled) return;
      const mail = resetPasswordEmail(user.name || user.email, toWebUrl(url));
      await sendEmail(user.email, mail.subject, mail.html).catch((err) =>
        console.error("[auth] falha ao enviar e-mail de redefinição:", err?.message ?? err),
      );
    },
  },
  emailVerification: {
    sendOnSignUp: emailEnabled,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      if (!emailEnabled) return;
      const mail = verificationEmail(user.name || user.email, toWebUrl(url));
      await sendEmail(user.email, mail.subject, mail.html).catch((err) =>
        console.error("[auth] falha ao enviar e-mail de confirmação:", err?.message ?? err),
      );
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: Boolean(process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
      disableImplicitSignUp: true,
    },
  },
  trustedOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000,https://periscopio-web-projeto-periscopio.vercel.app")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
});
