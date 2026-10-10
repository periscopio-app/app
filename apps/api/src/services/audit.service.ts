import { db } from "../db/client";
import { auditLogs } from "@periscopio/shared";
import type { FastifyRequest } from "fastify";
import { ensureSchema } from "./schema-guard.service";

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
      actorId: entry.userId || undefined,
      userEmail: entry.userEmail || undefined,
      action: entry.action.slice(0, 80),
      entity: entry.entityType.slice(0, 60),
      entityId,
      payload: entry.payload ?? undefined,
      durationMs: entry.durationMs ?? undefined,
      ipAddress: ip,
      userAgent: userAgent ? userAgent.slice(0, 500) : null,
      metadata: entry.entityId && !entityId ? { ref: entry.entityId } : undefined,
    });
  } catch (err) {
    console.error("[audit] Falha ao registrar log de auditoria:", err);
  }
}
