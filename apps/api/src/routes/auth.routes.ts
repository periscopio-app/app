import type { FastifyInstance } from "fastify";

export async function authRoutes(app: FastifyInstance) {
  /**
   * Endpoint de configuração e metadados de autenticação
   */
  app.get("/api/auth/config", async () => {
    const neonAuthUrl =
      process.env.BETTER_AUTH_URL ||
      "https://ep-green-sun-b6elixxo.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth";

    return {
      authProvider: "neon-auth",
      neonAuthUrl,
      googleAuthEnabled: true,
      jwksUrl: process.env.BETTER_AUTH_JWKS_URL,
    };
  });

  /**
   * Validação de sessão do usuário (Proxy/Validador de token com Neon Auth)
   */
  app.get("/api/auth/me", async (request, reply) => {
    const authHeader = request.headers.authorization;
    const cookieHeader = request.headers.cookie;

    if (!authHeader && !cookieHeader) {
      reply.status(401);
      return { authenticated: false, message: "Token ou cookie de sessão ausente" };
    }

    const neonAuthUrl =
      process.env.BETTER_AUTH_URL ||
      "https://ep-green-sun-b6elixxo.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth";

    try {
      const headers: Record<string, string> = {};
      if (cookieHeader) headers["cookie"] = cookieHeader;
      if (authHeader) headers["authorization"] = authHeader;

      const res = await fetch(`${neonAuthUrl}/get-session`, {
        method: "GET",
        headers,
      });

      if (!res.ok) {
        reply.status(res.status);
        return { authenticated: false, message: "Sessão inválida ou expirada" };
      }

      const sessionData = await res.json();
      return {
        authenticated: !!sessionData?.user,
        session: sessionData,
      };
    } catch (err: any) {
      reply.status(500);
      return { authenticated: false, error: err.message };
    }
  });
}
