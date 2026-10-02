import { createAuthClient } from "better-auth/react";

/**
 * O better-auth exige uma URL absoluta. Se a env vier relativa
 * (ex.: NEXT_PUBLIC_BETTER_AUTH_URL=/api/auth, proxy no mesmo dominio),
 * resolvemos contra a origem atual: window.location no navegador e
 * APP_URL/VERCEL_URL no servidor (build/prerender).
 */
function resolveBaseURL(): string {
  const configured =
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
    (process.env.NEXT_PUBLIC_API_URL
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/auth`
      : "http://localhost:3001/api/auth");

  if (/^https?:\/\//i.test(configured)) return configured;

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.APP_URL ||
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000");

  return new URL(configured, origin).toString().replace(/\/$/, "");
}

export const authClient = createAuthClient({
  baseURL: resolveBaseURL(),
});

export const { signIn, signUp, signOut, useSession } = authClient;
