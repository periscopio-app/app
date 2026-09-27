import type { FastifyInstance } from "fastify";
import { requireActor } from "../security/actor";

export async function authRoutes(app: FastifyInstance) {
  app.get("/api/auth/config", async (_request, reply) => {
    if (!process.env.BETTER_AUTH_URL) {
      return reply.status(503).send({ error: "Autenticação ainda não foi configurada" });
    }
    return { authProvider: "neon-auth", googleAuthEnabled: Boolean(process.env.GOOGLE_CLIENT_ID) };
  });

  app.get("/api/auth/me", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;
    return {
      authenticated: true,
      user: {
        id: actor.id,
        email: actor.email,
        tenantId: actor.tenantId,
        schoolId: actor.schoolId,
        role: actor.role,
      },
    };
  });
}
