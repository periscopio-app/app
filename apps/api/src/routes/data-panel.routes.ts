import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireCapability } from "../security/actor";
import { recordAudit } from "../services/audit.service";
import { PAINEL_IDS, consultarPainel, statusDoPainel } from "../services/databricks.service";

/** Painel de dados (Databricks): só o Administrador Master, mesma capacidade da aba Saúde. Lista fechada de painéis. */
export async function dataPanelRoutes(app: FastifyInstance) {
  app.get("/api/admin/data-panel", async (request, reply) => {
    const actor = await requireCapability(request, reply, "system.observability.view");
    if (!actor) return;
    reply.header("Cache-Control", "no-store");
    return statusDoPainel();
  });

  app.get("/api/admin/data-panel/:id", async (request, reply) => {
    const actor = await requireCapability(request, reply, "system.observability.view");
    if (!actor) return;
    const parsed = z.object({ id: z.enum(PAINEL_IDS) }).safeParse(request.params);
    if (!parsed.success) return reply.status(404).send({ error: "Painel não encontrado." });
    reply.header("Cache-Control", "no-store");
    const r = await consultarPainel(parsed.data.id);
    if (r.configured) {
      await recordAudit({ tenantId: actor.tenantId, userId: actor.id, userEmail: actor.email, action: "data_panel.query", entityType: "data_panel", payload: { painel: parsed.data.id, ok: r.ok } }, request);
    }
    return r;
  });
}
