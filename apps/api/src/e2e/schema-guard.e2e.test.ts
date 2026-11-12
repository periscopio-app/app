/**
 * Schema-guard: ao iniciar, a API aplica as migrações recentes (foto até 3 MB, gestão só Admin Master, Google Agenda).
 * Parte de um banco que só tem a 0035 (como a produção) e confere que o guard leva até a 0037, sem etapa ignorada
 * e de forma repetível. Requer TEST_DATABASE_URL (Postgres local de teste).
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;

describe("schema-guard até a 0037", { skip }, () => {
  let client: pg.Client;
  const avisos: string[] = [];
  const warnOriginal = console.warn;

  before(async () => {
    const { assertSafeTestDatabase, resetTestDatabase } = await import("../testing/test-db");
    assertSafeTestDatabase(url);
    await resetTestDatabase(url!); // aplica todos os .sql; abaixo voltamos ao estado "produção na 0035"
    client = new pg.Client({ connectionString: url });
    await client.connect();
    await client.query("DROP TABLE IF EXISTS public.google_calendar_connections CASCADE");
    await client.query("ALTER TABLE public.expert_meeting_requests DROP CONSTRAINT IF EXISTS expert_meeting_requests_meet_provider_check, DROP COLUMN IF EXISTS meet_provider, DROP COLUMN IF EXISTS google_event_id");
    await client.query("ALTER TABLE public.user_avatars DROP CONSTRAINT user_avatars_size_chk, ADD CONSTRAINT user_avatars_size_chk CHECK (size_bytes > 0 AND size_bytes <= 2097152)");
    process.env.DATABASE_URL = url!;
    console.warn = (...args: unknown[]) => { avisos.push(args.map(String).join(" ")); };
  });

  after(async () => {
    console.warn = warnOriginal;
    await client?.end();
    const { db } = await import("../db/client");
    await (db as any).$client.end();
  });

  test("aplica 0036/0037 sem etapa ignorada e é repetível", async () => {
    const { ensureSchema } = await import("../services/schema-guard.service");
    await ensureSchema();

    assert.deepEqual(avisos.filter((a) => a.includes("[schema-guard]")), [], "nenhuma etapa do guard pode ser ignorada");

    const chk = await client.query("SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'user_avatars_size_chk'");
    assert.match(chk.rows[0].def, /3145728/, "foto até 3 MB");
    const tabela = await client.query("SELECT to_regclass('public.google_calendar_connections') AS t");
    assert.equal(tabela.rows[0].t, "google_calendar_connections");
    const cols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'expert_meeting_requests' AND column_name IN ('meet_provider', 'google_event_id')");
    assert.equal(cols.rowCount, 2);
    const rls = await client.query("SELECT relrowsecurity FROM pg_class WHERE relname = 'google_calendar_connections'");
    assert.equal(rls.rows[0].relrowsecurity, true, "RLS ligado na tabela do token do Google");

    // Repetir (próximo boot) não pode falhar nem avisar.
    const sqls = ["0036_foto_ate_3mb.sql", "0036_gestao_so_admin_master.sql", "0037_board_google_calendar.sql"]
      .flatMap((f) => readFileSync(join(process.cwd(), "drizzle", f), "utf8").split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean));
    for (const s of sqls) await client.query(s);
  });
});
