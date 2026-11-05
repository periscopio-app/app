import { db } from "../db/client";
import { auditLogs } from "@periscopio/shared";
import type { FastifyRequest } from "fastify";
import { ensureSchema } from "./schema-guard.service";
import { VIRTUAL_ADMIN_ID } from "../security/roles";

export interface AuditLogEntry {
  tenantId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  payload?: Record<string, unknown> | null;
  durationMs?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Registra um evento na trilha de auditoria (append-only: o banco bloqueia UPDATE/DELETE).
 * Nunca derruba a requisição: falha de auditoria só é logada.
 */
export async function recordAudit(entry: AuditLogEntry, request?: FastifyRequest): Promise<void> {
  try {
    await ensureSchema();

    const ip =
      entry.ipAddress ||
      (request?.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
      request?.ip ||
      null;
    const userAgent = entry.userAgent || (request?.headers["user-agent"] as string | undefined) || null;
    const entityId = entry.entityId && UUID_RE.test(entry.entityId) ? entry.entityId : undefined;

    await db.insert(auditLogs).values({
      tenantId: entry.tenantId || undefined,
      // O Admin Master é virtual (sem linha em users): a chave estrangeira recusaria o registro inteiro. O e-mail fica gravado.
      actorId: entry.userId && entry.userId !== VIRTUAL_ADMIN_ID ? entry.userId : undefined,
      userEmail: entry.userEmail || undefined,
      action: entry.action.slice(0, 80),
      entity: entry.entityType.slice(0, 60),
      entityId,
      payload: entry.payload ?? undefined,
      durationMs: entry.durationMs ?? undefined,
      ipAddress: ip,
      userAgent: userAgent ? userAgent.slice(0, 500) : null,
      metadata:
        (entry.entityId && !entityId) || entry.userId === VIRTUAL_ADMIN_ID
          ? {
              ...(entry.entityId && !entityId ? { ref: entry.entityId } : {}),
              ...(entry.userId === VIRTUAL_ADMIN_ID ? { actor: "admin_master_virtual" } : {}),
            }
          : undefined,
    });
  } catch (err) {
    console.error("[audit] Falha ao registrar log de auditoria:", err);
  }
}


/**
 * Inserção direta em audit_logs (para quem grava dentro de uma transação ou precisa do resultado).
 * `actor_id` tem chave estrangeira para `users`, e o Admin Master é um ator virtual sem linha lá: gravar o id dele derrubava a
 * rota inteira com 500. Aqui o id virtual vira nulo e a marca `actor: admin_master_virtual` vai no metadata; o e-mail fica
 * em `userEmail` quando informado. Use SEMPRE isto em vez de `db.insert(auditLogs)`.
 */
export async function inserirAuditoria(
  executor: { insert: (tabela: typeof auditLogs) => { values: (v: typeof auditLogs.$inferInsert) => PromiseLike<unknown> } },
  values: typeof auditLogs.$inferInsert
): Promise<void> {
  if (values.actorId === VIRTUAL_ADMIN_ID) {
    await executor
      .insert(auditLogs)
      .values({ ...values, actorId: null, metadata: { ...((values.metadata as Record<string, unknown> | null) ?? {}), actor: "admin_master_virtual" } });
    return;
  }
  await executor.insert(auditLogs).values(values);
}
