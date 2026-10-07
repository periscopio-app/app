import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));

/** Só roda em banco local de teste: nunca contra Neon/produção. */
export function assertSafeTestDatabase(url: string | undefined): string {
  if (!url) throw new Error("DATABASE_URL ausente");
  const u = new URL(url);
  const localHost = ["localhost", "127.0.0.1", "::1", ""].includes(u.hostname) || url.includes("host=/");
  const dbName = u.pathname.replace("/", "");
  if (!localHost || !/test/i.test(dbName)) {
    throw new Error(`Recusado: testes só rodam em banco local cujo nome contém "test" (recebido: ${u.hostname}/${dbName}).`);
  }
  return url;
}

/** Recria o schema do zero: neon_auth (espelho) + migrações do Drizzle + views públicas de auth. */
export async function resetTestDatabase(url: string) {
  assertSafeTestDatabase(url);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS neon_auth CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
    await client.query(readFileSync(join(here, "auth-schema.sql"), "utf8"));
    // Views públicas auto-atualizáveis sobre neon_auth.* (como em produção, ver migração 0008).
    await client.query(`
      CREATE VIEW public."user" AS SELECT * FROM neon_auth."user";
      CREATE VIEW public.session AS SELECT * FROM neon_auth.session;
      CREATE VIEW public.account AS SELECT * FROM neon_auth.account;
      CREATE VIEW public.verification AS SELECT * FROM neon_auth.verification;
    `);

    const dir = join(here, "../../drizzle");
    const files = readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
    for (const f of files) {
      const sql = readFileSync(join(dir, f), "utf8");
      for (const stmt of sql.split("--> statement-breakpoint")) {
        if (stmt.trim()) await client.query(stmt);
      }
    }
  } finally {
    await client.end();
  }
}
