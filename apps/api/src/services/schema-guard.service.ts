import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { db } from "../db/client";

/**
 * Garante, de forma idempotente, as estruturas novas no banco (auditoria enriquecida,
 * trigger de imutabilidade, cofre de identidade, privilégios e triagem TEA). Espelha drizzle/0015_audit_trail_vault.sql
 * para que o deploy funcione mesmo antes de rodar `pnpm db:migrate`.
 */
let ensured: Promise<void> | null = null;

function migrationSql(): string[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const files = [
    "0015_audit_trail_vault.sql",
    "0016_row_level_security.sql",
    "0017_privileges_and_tea.sql",
    "0019_pilot_symptom_measurements.sql",
  ];
  const allSql: string[] = [];

  for (const fileName of files) {
    const candidates = [
      resolve(here, `../../drizzle/${fileName}`),
      resolve(here, `../drizzle/${fileName}`),
      resolve(process.cwd(), `drizzle/${fileName}`),
      resolve(process.cwd(), `apps/api/drizzle/${fileName}`),
    ];
    for (const file of candidates) {
      try {
        const statements = readFileSync(file, "utf8")
          .split("--> statement-breakpoint")
          .map((s) => s.trim())
          .filter(Boolean);
        allSql.push(...statements);
        break;
      } catch {
        // tenta o próximo caminho
      }
    }
  }
  return allSql;
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
