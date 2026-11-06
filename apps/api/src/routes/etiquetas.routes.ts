import type { FastifyInstance } from "fastify";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { ETIQUETA_GRUPO_IDS, ETIQUETA_ROTULO_MAX, ETIQUETA_ROTULO_MIN, etiquetas, tenants } from "@periscopio/shared";
import { db } from "../db/client";
import { requireActor, requireCapability } from "../security/actor";
import { VIRTUAL_ADMIN_ID } from "../security/roles";
import { inserirAuditoria } from "../services/audit.service";

const grupo = z.string().refine((g) => ETIQUETA_GRUPO_IDS.includes(g), "Grupo de etiquetas desconhecido.");
const rotulo = z
  .string()
  .transform((s) => s.replace(/\s+/g, " ").trim())
  .pipe(z.string().min(ETIQUETA_ROTULO_MIN, `A etiqueta precisa de pelo menos ${ETIQUETA_ROTULO_MIN} letras.`).max(ETIQUETA_ROTULO_MAX, `Use no máximo ${ETIQUETA_ROTULO_MAX} caracteres.`))
  .refine((s) => /\p{L}{2}/u.test(s), "Escreva um nome com letras.")
  .refine((s) => !/[<>]|https?:\/\/|@/.test(s), "Não use endereços, e-mails nem símbolos de marcação.");

const DUPLICADA = "Já existe uma etiqueta com este nome neste grupo.";

function ehDuplicada(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

/**
 * Etiquetas do município.
 *  - Leitura para o RE e demais profissionais: só as ATIVAS, só do próprio município.
 *  - Cadastro, renomeio e desativação: só o Administrador Master (capacidade travada `labels.manage`), com trilha de auditoria.
 */
export async function etiquetasRoutes(app: FastifyInstance) {
  app.get("/api/etiquetas", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;
    const q = z.object({ grupo }).safeParse(request.query);
    if (!q.success) {
      reply.status(400);
      return { error: "Informe um grupo de etiquetas válido." };
    }
    const itens = await db
      .select({ id: etiquetas.id, grupo: etiquetas.grupo, rotulo: etiquetas.rotulo })
      .from(etiquetas)
      .where(and(eq(etiquetas.tenantId, actor.tenantId), eq(etiquetas.grupo, q.data.grupo), eq(etiquetas.ativo, true)))
      .orderBy(asc(etiquetas.rotulo));
    return { etiquetas: itens };
  });

  app.get("/api/admin/etiquetas", async (request, reply) => {
    const actor = await requireCapability(request, reply, "labels.manage");
    if (!actor) return;
    const q = z.object({ tenantId: z.string().uuid().optional(), grupo }).safeParse(request.query);
    if (!q.success) {
      reply.status(400);
      return { error: "Informe um grupo de etiquetas válido." };
    }
    const tenantId = q.data.tenantId ?? actor.tenantId;
    const itens = await db
      .select({ id: etiquetas.id, grupo: etiquetas.grupo, rotulo: etiquetas.rotulo, ativo: etiquetas.ativo, updatedAt: etiquetas.updatedAt })
      .from(etiquetas)
      .where(and(eq(etiquetas.tenantId, tenantId), eq(etiquetas.grupo, q.data.grupo)))
      .orderBy(asc(etiquetas.rotulo));
    return { tenantId, etiquetas: itens };
  });

  app.post("/api/admin/etiquetas", async (request, reply) => {
    const actor = await requireCapability(request, reply, "labels.manage");
    if (!actor) return;
    const b = z.object({ tenantId: z.string().uuid().optional(), grupo, rotulo }).safeParse(request.body);
    if (!b.success) {
      reply.status(400);
      return { error: b.error.issues[0]?.message ?? "Dados inválidos." };
    }
    const tenantId = b.data.tenantId ?? actor.tenantId;
    const [t] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (!t) {
      reply.status(404);
      return { error: "Município não encontrado." };
    }
    try {
      const criado = await db.transaction(async (tx) => {
        const [novo] = await tx.insert(etiquetas).values({ tenantId, grupo: b.data.grupo, rotulo: b.data.rotulo, criadoPor: actor.id === VIRTUAL_ADMIN_ID ? null : actor.id }).returning();
        await inserirAuditoria(tx, {
          tenantId, actorId: actor.id, userEmail: actor.email, action: "etiqueta.created", entity: "etiqueta", entityId: novo.id,
          payload: { grupo: novo.grupo, rotulo: novo.rotulo },
        });
        return novo;
      });
      reply.status(201);
      return { etiqueta: { id: criado.id, grupo: criado.grupo, rotulo: criado.rotulo, ativo: criado.ativo } };
    } catch (err) {
      if (ehDuplicada(err)) {
        reply.status(409);
        return { error: DUPLICADA };
      }
      throw err;
    }
  });

  app.patch("/api/admin/etiquetas/:id", async (request, reply) => {
    const actor = await requireCapability(request, reply, "labels.manage");
    if (!actor) return;
    const { id } = request.params as { id: string };
    const b = z.object({ rotulo: rotulo.optional(), ativo: z.boolean().optional() }).refine((v) => v.rotulo !== undefined || v.ativo !== undefined, "Nada para alterar.").safeParse(request.body);
    if (!z.string().uuid().safeParse(id).success || !b.success) {
      reply.status(400);
      return { error: b.success ? "Identificador inválido." : b.error.issues[0]?.message ?? "Dados inválidos." };
    }
    const [atual] = await db.select().from(etiquetas).where(eq(etiquetas.id, id)).limit(1);
    if (!atual) {
      reply.status(404);
      return { error: "Etiqueta não encontrada." };
    }
    try {
      const novo = await db.transaction(async (tx) => {
        const [n] = await tx
          .update(etiquetas)
          .set({ ...(b.data.rotulo !== undefined ? { rotulo: b.data.rotulo } : {}), ...(b.data.ativo !== undefined ? { ativo: b.data.ativo } : {}), updatedAt: new Date() })
          .where(eq(etiquetas.id, id))
          .returning();
        await inserirAuditoria(tx, {
          tenantId: atual.tenantId, actorId: actor.id, userEmail: actor.email, action: "etiqueta.updated", entity: "etiqueta", entityId: id,
          payload: { de: { rotulo: atual.rotulo, ativo: atual.ativo }, para: { rotulo: n.rotulo, ativo: n.ativo } },
        });
        return n;
      });
      return { etiqueta: { id: novo.id, grupo: novo.grupo, rotulo: novo.rotulo, ativo: novo.ativo } };
    } catch (err) {
      if (ehDuplicada(err)) {
        reply.status(409);
        return { error: DUPLICADA };
      }
      throw err;
    }
  });
}
