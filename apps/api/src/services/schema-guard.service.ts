import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { db } from "../db/client";

/**
 * Garante, de forma idempotente, as estruturas novas no banco (auditoria enriquecida,
 * trigger de imutabilidade e cofre de identidade). Espelha drizzle/0015_audit_trail_vault.sql
 * para que o deploy funcione mesmo antes de rodar `pnpm db:migrate`.
 */
let ensured: Promise<void> | null = null;

function migrationSql(): string[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "../../drizzle/0015_audit_trail_vault.sql"),
    resolve(here, "../drizzle/0015_audit_trail_vault.sql"),
    resolve(process.cwd(), "drizzle/0015_audit_trail_vault.sql"),
    resolve(process.cwd(), "apps/api/drizzle/0015_audit_trail_vault.sql"),
  ];
  for (const file of candidates) {
    try {
      return readFileSync(file, "utf8")
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);
    } catch {
      // tenta o próximo caminho
    }
  }
  return [];
}

export function ensureSchema(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      const client = await (db as any).$client;
      if (!client?.query) return;
      for (const stmt of migrationSql()) {
        try {
          await client.query(stmt);
        } catch (err: any) {
          console.warn("[schema-guard] etapa ignorada:", err?.message ?? err);
        }
      }
    })();
  }
  return ensured;
}
