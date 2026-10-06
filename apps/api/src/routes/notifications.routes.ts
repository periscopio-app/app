import type { FastifyInstance } from "fastify";
import { db } from "../db/client";
import { notifications } from "@periscopio/shared";
import { and, eq, isNull, desc } from "drizzle-orm";
import { requireActor } from "../security/actor";

export async function notificationsRoutes(app: FastifyInstance) {
  // GET /api/notifications — lista pendentes do usuário autenticado
  app.get("/api/notifications", async (request, reply) => {
    const actor = await requireActor(request, reply, [
      "ppi", "md1", "specialist", "school_manager", "board",
    ]);
    if (!actor) return;

    const list = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, actor.id),
          eq(notifications.tenantId, actor.tenantId),
          isNull(notifications.dismissedAt),
        )
      )
      .orderBy(desc(notifications.createdAt))
      .limit(30);

    const unread = list.filter((notif) => !notif.readAt).length;
    return { notifications: list, unread };
  });

  // POST /api/notifications/:id/read — marca como lida
  app.post("/api/notifications/:id/read", async (request, reply) => {
    const actor = await requireActor(request, reply, [
      "ppi", "md1", "specialist", "school_manager", "board",
    ]);
    if (!actor) return;

    const { id } = request.params as { id: string };
    const [updated] = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.recipientId, actor.id),
          eq(notifications.tenantId, actor.tenantId),
          isNull(notifications.readAt),
        )
      )
      .returning();

    if (!updated) return reply.status(404).send({ error: "Aviso não encontrado" });
    return { success: true };
  });

  // POST /api/notifications/read-all — marca todas como lidas
  app.post("/api/notifications/read-all", async (request, reply) => {
    const actor = await requireActor(request, reply, [
      "ppi", "md1", "specialist", "school_manager", "board",
    ]);
    if (!actor) return;

    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.recipientId, actor.id),
          eq(notifications.tenantId, actor.tenantId),
          isNull(notifications.readAt),
        )
      );

    return { success: true };
  });

  // POST /api/notifications/:id/dismiss — descarta (remove da central)
  app.post("/api/notifications/:id/dismiss", async (request, reply) => {
    const actor = await requireActor(request, reply, [
      "ppi", "md1", "specialist", "school_manager", "board",
    ]);
    if (!actor) return;

    const { id } = request.params as { id: string };
    const [updated] = await db
      .update(notifications)
      .set({ dismissedAt: new Date(), readAt: new Date() })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.recipientId, actor.id),
          eq(notifications.tenantId, actor.tenantId),
        )
      )
      .returning();

    if (!updated) return reply.status(404).send({ error: "Aviso não encontrado" });
    return { success: true };
  });
}
