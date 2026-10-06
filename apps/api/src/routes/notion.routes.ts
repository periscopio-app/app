import type { FastifyInstance } from "fastify";
import { fetchNotionBoardTasks } from "../services/notion.service";
import { requireActor } from "../security/actor";

export async function notionRoutes(app: FastifyInstance) {
  // Endpoint de sincronização e inventário de tarefas do Notion
  app.get("/api/notion/sync", async (request, reply) => {
    const actor = await requireActor(request, reply, ["admin_platform"]);
    if (!actor) return;
    try {
      const summary = await fetchNotionBoardTasks();
      return reply.send({
        success: true,
        summary,
        notionConfigured: Boolean(process.env.NOTION_API_KEY),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "erro desconhecido";
      return reply.status(500).send({
        error: "Falha ao sincronizar com o Notion",
        details: message,
      });
    }
  });

  // Endpoint para listar tarefas por status
  app.get("/api/notion/tasks", async (request, reply) => {
    const actor = await requireActor(request, reply, ["admin_platform"]);
    if (!actor) return;
    const { status } = request.query as { status?: string };
    const summary = await fetchNotionBoardTasks();

    let filtered = summary.tasks;
    if (status) {
      filtered = summary.tasks.filter((t) => t.status === status);
    }

    return reply.send({
      total: filtered.length,
      tasks: filtered,
    });
  });
}
