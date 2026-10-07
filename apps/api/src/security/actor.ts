import { eq } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/client";
import { users } from "@periscopio/shared";
import { hasRole, isRole, type Role } from "./roles";

export type { Role } from "./roles";

export interface Actor {
  id: string;
  email: string;
  tenantId: string;
  schoolId: string | null;
  role: Role;
}

interface SessionResponse {
  user?: { email?: string | null };
}

async function sessionEmail(request: FastifyRequest): Promise<string | null> {
  const authUrl = process.env.BETTER_AUTH_URL || process.env.NEON_AUTH_URL;
  if (!authUrl) return null;

  const headers: Record<string, string> = {};
  if (request.headers.authorization) headers.authorization = request.headers.authorization;
  if (request.headers.cookie) headers.cookie = request.headers.cookie;
  if (Object.keys(headers).length === 0) return null;

  const response = await fetch(`${authUrl.replace(/\/$/, "")}/get-session`, {
    headers,
  });
  if (!response.ok) return null;

  const session = (await response.json()) as SessionResponse;
  const email = session.user?.email?.trim().toLowerCase();
  return email || null;
}

export async function requireActor(
  request: FastifyRequest,
  reply: FastifyReply,
  allowedRoles?: readonly Role[]
): Promise<Actor | null> {
  try {
    const email = await sessionEmail(request);
    if (!email) {
      await reply.status(401).send({ error: "Sessão ausente, inválida ou expirada" });
      return null;
    }

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        tenantId: users.tenantId,
        schoolId: users.schoolId,
        role: users.role,
        accessEnabled: users.accessEnabled,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const role = user?.role;
    if (!user || !role || !isRole(role)) {
      await reply.status(403).send({ error: "Usuário sem perfil autorizado na plataforma" });
      return null;
    }

    if (!user.accessEnabled) {
      await reply
        .status(403)
        .send({ error: "Acesso pendente: confirme o e-mail do convite enviado pela sua escola." });
      return null;
    }

    const { accessEnabled: _enabled, ...userData } = user;
    const actor: Actor = { ...userData, role };
    if (allowedRoles && !hasRole(actor.role, allowedRoles)) {
      await reply.status(403).send({ error: "Seu perfil não possui permissão para esta ação" });
      return null;
    }

    return actor;
  } catch (error) {
    request.log.error({ err: error }, "falha ao validar sessão");
    await reply.status(503).send({ error: "Não foi possível validar a sessão agora" });
    return null;
  }
}
