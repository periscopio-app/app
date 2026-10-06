import { createAuthClient } from "better-auth/react";

/**
 * Fonte única de autenticação: o Better Auth da API (Render).
 * O navegador fala SEMPRE com o mesmo domínio do site (`/api/auth`); o Next.js
 * repassa para a API via rewrite (next.config.mjs). Assim o cookie de sessão é
 * "first-party" e chega à API em todas as chamadas `/api/*`.
 */
function resolveBaseURL(): string {
  if (typeof window !== "undefined") return `${window.location.origin}/api/auth`;
  const origin =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return `${origin.replace(/\/$/, "")}/api/auth`;
}

export const authClient = createAuthClient({
  baseURL: resolveBaseURL(),
});

export const { signIn, signUp, signOut, useSession } = authClient;
