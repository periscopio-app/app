import type { FastifyInstance } from "fastify";
import { auth, authBaseUrl } from "../auth";
import { requireActor } from "../security/actor";

export async function authRoutes(app: FastifyInstance) {
  app.get("/api/auth/config", async (_request, reply) => {
    return {
      authProvider: "better-auth",
      baseUrl: `${authBaseUrl}/api/auth`,
    };
  });

  app.all("/api/auth/*", async (request, reply) => {
    const protocol = request.protocol || "http";
    const host = request.hostname || "localhost";
    const url = new URL(request.url, `${protocol}://${host}`);

    const headers = new Headers();
    Object.entries(request.headers).forEach(([key, value]) => {
      if (value) {
        if (Array.isArray(value)) {
          value.forEach((v) => headers.append(key, v));
        } else {
          headers.set(key, value);
        }
      }
    });

    const method = request.method;
    const hasBody = !["GET", "HEAD"].includes(method);
    const body = hasBody && request.body ? JSON.stringify(request.body) : undefined;

    const req = new Request(url.toString(), {
      method,
      headers,
      body,
    });

    const res = await auth.handler(req);
    reply.status(res.status);

    res.headers.forEach((val, key) => {
      const lower = key.toLowerCase();
      if (lower !== "set-cookie" && lower !== "content-length" && lower !== "content-encoding") {
        reply.header(key, val);
      }
    });

    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (setCookies.length > 0) {
      reply.header("set-cookie", setCookies);
    }

    const responseText = await res.text();
    try {
      return reply.send(JSON.parse(responseText));
    } catch {
      return reply.send(responseText);
    }
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
