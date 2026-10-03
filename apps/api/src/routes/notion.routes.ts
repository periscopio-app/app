import type { FastifyInstance } from "fastify";
import { fetchNotionBoardTasks } from "../services/notion.service";

export async function notionRoutes(app: FastifyInstance) {
  // Endpoint de sincronização e inventário de tarefas do Notion
  app.get("/api/notion/sync", async (_request, reply) => {
    try {
      const summary = await fetchNotionBoardTasks();
      return reply.send({
        success: true,
        summary,
        notionConfigured: Boolean(process.env.NOTION_API_KEY),
        databaseId: process.env.NOTION_DATABASE_ID || "3de22e9df44c8010a6d3e984b965654a",
      });
    } catch (err: any) {
      return reply.status(500).send({
        error: "Falha ao sincronizar com o Notion",
        details: err?.message,
      });
    }
  });

  // Endpoint para listar tarefas por status
  app.get("/api/notion/tasks", async (request, reply) => {
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
