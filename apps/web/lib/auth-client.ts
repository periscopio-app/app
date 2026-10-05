import { createAuthClient } from "better-auth/react";

/**
 * O better-auth exige uma URL absoluta. Se a env vier relativa
 * (ex.: NEXT_PUBLIC_BETTER_AUTH_URL=/api/auth, proxy no mesmo dominio),
 * resolvemos contra a origem atual: window.location no navegador e
 * APP_URL/VERCEL_URL no servidor (build/prerender).
 */
function resolveBaseURL(): string {
  const neonAuthUrl =
    process.env.NEXT_PUBLIC_NEON_AUTH_URL ||
    process.env.NEON_AUTH_URL ||
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL;

  if (neonAuthUrl && /^https?:\/\//i.test(neonAuthUrl) && !neonAuthUrl.includes("/api/auth")) {
    return neonAuthUrl.replace(/\/$/, "");
  }

  // Neon Auth endpoint oficial gerenciado
  return "https://ep-green-sun-b6elixxo.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth";
}

export const authClient = createAuthClient({
  baseURL: resolveBaseURL(),
});

export const { signIn, signUp, signOut, useSession } = authClient;
