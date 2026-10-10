import { db } from "../db/client";
import { auditLogs } from "@periscopio/shared";
import type { FastifyRequest } from "fastify";

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

/**
 * Cria a tabela audit_logs caso ainda não exista no banco (idempotente).
 */
let tableChecked = false;
async function ensureAuditTableExists() {
  if (tableChecked) return;
  try {
    const client = await (db as any).$client;
    if (client?.query) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID REFERENCES tenants(id),
          user_id UUID REFERENCES users(id),
          user_email VARCHAR(255),
          action VARCHAR(80) NOT NULL,
          entity_type VARCHAR(50) NOT NULL,
          entity_id VARCHAR(100),
          payload JSONB,
          duration_ms INTEGER,
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS audit_logs_tenant_idx ON audit_logs(tenant_id);
        CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
        CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);
      `);
      tableChecked = true;
    }
  } catch (err) {
    console.warn("[audit] Não foi possível verificar/criar tabela audit_logs:", err);
  }
}

/**
 * Registra um log de auditoria com UUID imutável, timestamp e imput completo.
 */
export async function recordAudit(
  entry: AuditLogEntry,
  request?: FastifyRequest
): Promise<void> {
  try {
    await ensureAuditTableExists();

    const ip =
      entry.ipAddress ||
      (request?.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      request?.ip ||
      null;

    const userAgent =
      entry.userAgent ||
      (request?.headers["user-agent"] as string) ||
      null;

    await db.insert(auditLogs).values({
      tenantId: entry.tenantId || undefined,
      actorId: entry.userId || undefined,
      userEmail: entry.userEmail || undefined,
      action: entry.action,
      entity: entry.entityType,
      entityId: entry.entityId ? (entry.entityId as any) : undefined,
      payload: entry.payload ? (entry.payload as any) : undefined,
      durationMs: entry.durationMs || undefined,
      ipAddress: ip,
      userAgent: userAgent ? userAgent.slice(0, 500) : null,
    });
  } catch (err) {
    console.error("[audit] Falha ao registrar log de auditoria:", err);
  }
}

