/** E2E do seed do assistente do BI: grava como aprovado, é idempotente e fica isolado por tenant. Requer TEST_DATABASE_URL. */
import { test, before, describe } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;
const SEED = fileURLToPath(new URL("../../../bi-rag/seed/bi_examples_taruma.json", import.meta.url));

describe("seed do assistente do BI (E2E)", { skip }, () => {
  let tA = "";
  let tB = "";
  before(async () => {
    const { assertSafeTestDatabase, resetTestDatabase } = await import("../testing/test-db");
    assertSafeTestDatabase(url);
    await resetTestDatabase(url!);
    process.env.DATABASE_URL = url!;
    const { db } = await import("../db/client");
    const { tenants } = await import("@periscopio/shared");
    const [a] = await db.insert(tenants).values({ name: "Tenant A", municipalityCode: "0000001" }).returning({ id: tenants.id });
    const [b] = await db.insert(tenants).values({ name: "Tenant B", municipalityCode: "0000002" }).returning({ id: tenants.id });
    tA = a.id;
    tB = b.id;
  });

  test("grava aprovado, não duplica e não vaza para outro tenant", async () => {
    const { db } = await import("../db/client");
    const { biQuestions } = await import("@periscopio/shared");
    const { and, eq } = await import("drizzle-orm");
    const { applySeed, loadSeedExamples } = await import("../services/bi-seed.service");
    const ex = loadSeedExamples(SEED);

    const first = await applySeed(db, tA, ex);
    assert.deepEqual(first, { inserted: ex.length, skipped: 0 });
    const second = await applySeed(db, tA, ex);
    assert.deepEqual(second, { inserted: 0, skipped: ex.length });

    const rowsA = await db.select().from(biQuestions).where(and(eq(biQuestions.tenantId, tA), eq(biQuestions.approved, true)));
    assert.equal(rowsA.length, ex.length);
    assert.ok(rowsA.every((r) => r.source === "seed" && r.role === "sistema" && r.userId === null && r.plan));
    const rowsB = await db.select().from(biQuestions).where(eq(biQuestions.tenantId, tB));
    assert.equal(rowsB.length, 0);
  });
});
