import type { FastifyInstance } from "fastify";
import { requireCapability } from "../security/actor";
import { recordAudit } from "../services/audit.service";
import { executeReset, previewReset } from "../services/factory-reset.service";

/** Palavra que o Admin digita para confirmar o reset (evita clique acidental). */
const CONFIRMACAO = "RESETAR DEMO";

/**
 * Reset de fábrica do piloto (Bloco 2). Só o Administrador Master (capacidade travada
 * system.factory_reset). Zera os municípios de demonstração; municípios reais ficam intactos.
 */
export async function factoryResetRoutes(app: FastifyInstance) {
  // Prévia: o que seria apagado, sem apagar nada.
  app.get("/api/admin/factory-reset/preview", async (request, reply) => {
    const actor = await requireCapability(request, reply, "system.factory_reset");
    if (!actor) return;
    const preview = await previewReset();
    return { confirmacao: CONFIRMACAO, ...preview };
  });

  // Execução: exige a palavra de confirmação exata.
  app.post("/api/admin/factory-reset", async (request, reply) => {
    const actor = await requireCapability(request, reply, "system.factory_reset");
    if (!actor) return;

    const { confirm } = (request.body ?? {}) as { confirm?: string };
    if ((confirm ?? "").trim() !== CONFIRMACAO) {
      return reply.status(400).send({ error: `Para confirmar, envie confirm = "${CONFIRMACAO}".` });
    }

    const result = await executeReset();

    await recordAudit(
      {
        tenantId: actor.tenantId,
        userId: actor.id,
        userEmail: actor.email,
        action: "system.factory_reset",
        entityType: "tenant",
        payload: {
          tenants: result.tenants.map((t) => ({ id: t.id, name: t.name })),
          total: result.total,
          deleted: result.deleted,
        },
      },
      request
    );

    return result;
  });
}
