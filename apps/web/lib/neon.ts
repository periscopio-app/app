import { createClient } from "@neondatabase/neon-js";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react";

/**
 * Cliente Neon SDK integrado com Managed Better Auth e Data API.
 * No navegador, o auth aponta para /api/auth (proxied pelo Next.js na Vercel no mesmo domínio).
 * No SSR, aponta para a URL direta do Neon Auth.
 */
const getAuthUrl = () => {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/auth`;
  }
  return (
    process.env.NEON_AUTH_URL ||
    process.env.NEXT_PUBLIC_NEON_AUTH_URL ||
    "https://ep-green-sun-b6elixxo.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth"
  );
};

export const neon = createClient({
  auth: {
    url: getAuthUrl(),
    adapter: BetterAuthReactAdapter(),
  },
  dataApi: {
    url:
      process.env.NEXT_PUBLIC_NEON_DATA_API_URL ||
      "https://ep-green-sun-b6elixxo.apirest.c-2.sa-east-1.aws.neon.tech/neondb/rest/v1",
  },
});
