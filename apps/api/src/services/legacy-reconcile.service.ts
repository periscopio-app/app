/**
 * Conferência da base individual carregada: cada dado migrado é recontado e comparado
 * (1) com a própria planilha (linhas e células preenchidas por coluna, do manifesto) e
 * (2) com os agregados de Tarumã já gravados em population_aggregates.
 * Só devolve contagens: nenhum valor individual sai daqui.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { legacyImportBatches, legacyPatients, legacyPatientComplaints, legacyPatientServices, legacyImportRows, populationAggregates } from "@periscopio/shared";
import { bandOf, compareScope, sumCounts, type Check, type Counts, type StoredPayload } from "./legacy-import.service";

export interface ColumnCheck {
  column: string;
  sheet: number;
  database: number;
  status: "ok" | "mismatch" | "not_in_database";
}
export interface ReconcileReport {
  batchId: string;
  rows: { sheet: number; database: number; patients: number; status: "ok" | "mismatch" };
  columns: ColumnCheck[];
  aggregates: { compared: boolean; checks: number; mismatches: Check[]; note?: string };
  ok: boolean;
}

export async function reconcileBatch(batchId: string): Promise<ReconcileReport> {
  const [batch] = await db.select().from(legacyImportBatches).where(eq(legacyImportBatches.id, batchId)).limit(1);
  if (!batch) throw new Error("Lote não encontrado");

  // 1) linhas
  const [{ n: rowsDb }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(legacyImportRows)
    .where(eq(legacyImportRows.batchId, batchId));
  const [{ n: patients }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(legacyPatients)
    .where(eq(legacyPatients.batchId, batchId));
  const rows = {
    sheet: batch.rowCount,
    database: rowsDb,
    patients,
    status: (batch.rowCount === rowsDb && rowsDb === patients ? "ok" : "mismatch") as "ok" | "mismatch",
  };

  // 2) células preenchidas por coluna (a planilha é a referência; nome/endereço estão fora por desenho)
  const transformed = new Set(batch.transformedColumns as string[]);
  const sheetCols = batch.columnNonNull as Record<string, number>;
  const dbCols = await db.execute(sql`
    select k as column, count(*)::int as n
    from legacy_import_rows r, lateral jsonb_each(r.data) e(k, v)
    where r.batch_id = ${batchId} and jsonb_typeof(v) <> 'null' and not (jsonb_typeof(v) = 'string' and v #>> '{}' = '')
    group by k`);
  const dbMap = new Map<string, number>((dbCols.rows as { column: string; n: number }[]).map((r) => [r.column, r.n]));
  const columns: ColumnCheck[] = Object.entries(sheetCols).map(([column, sheet]) => {
    if (transformed.has(column) && !dbMap.has(column)) {
      return { column, sheet, database: 0, status: "not_in_database" as const }; // nome/endereço: esperado
    }
    const database = dbMap.get(column) ?? 0;
    return { column, sheet, database, status: (database === sheet ? "ok" : "mismatch") as "ok" | "mismatch" };
  });

  // 3) agregados
  const stored = await db
    .select()
    .from(populationAggregates)
    .where(and(eq(populationAggregates.tenantId, batch.tenantId), eq(populationAggregates.source, batch.source)));
  const derived = await deriveCounts(batchId);
  const mismatches: Check[] = [];
  let compared = 0;
  let note: string | undefined;
  if (stored.length === 0) {
    note = "Sem agregados gravados para esta fonte; comparação com agregados não feita.";
  } else {
    const all = sumCounts([...derived.values()]);
    const scopes = new Map<string, Counts>(derived);
    scopes.set("TOTAL", all);
    for (const row of stored) {
      const d = scopes.get(row.schoolCode) ?? { total: 0, ageBands: {}, complaints: {}, services: {} };
      const checks = compareScope(row.schoolCode, row.payload as StoredPayload, d);
      compared += checks.length;
      mismatches.push(...checks.filter((c) => c.status === "mismatch"));
    }
    for (const code of derived.keys()) {
      if (!stored.some((s) => s.schoolCode === code)) {
        mismatches.push({ scope: code, metric: "total", key: "escola sem agregado", stored: null, derived: derived.get(code)!.total, status: "mismatch" });
      }
    }
  }

  const ok =
    rows.status === "ok" &&
    columns.every((c) => c.status !== "mismatch") &&
    mismatches.length === 0;
  return { batchId, rows, columns, aggregates: { compared: stored.length > 0, checks: compared, mismatches, note }, ok };
}

/** Contagens por escola derivadas das tabelas normalizadas (mesma regra do extrator de agregados). */
export async function deriveCounts(batchId: string): Promise<Map<string, Counts>> {
  const out = new Map<string, Counts>();
  const get = (code: string) => {
    let c = out.get(code);
    if (!c) out.set(code, (c = { total: 0, ageBands: {}, complaints: {}, services: {} }));
    return c;
  };
  const ages = await db
    .select({ code: legacyPatients.schoolCode, age: legacyPatients.currentAge, n: sql<number>`count(*)::int` })
    .from(legacyPatients)
    .where(eq(legacyPatients.batchId, batchId))
    .groupBy(legacyPatients.schoolCode, legacyPatients.currentAge);
  for (const r of ages) {
    const c = get(r.code);
    c.total += r.n;
    const b = bandOf(r.age);
    if (b) c.ageBands[b] = (c.ageBands[b] ?? 0) + r.n;
  }
  const comp = await db
    .select({ code: legacyPatients.schoolCode, complaint: legacyPatientComplaints.complaint, n: sql<number>`count(*)::int` })
    .from(legacyPatientComplaints)
    .innerJoin(legacyPatients, eq(legacyPatients.id, legacyPatientComplaints.patientId))
    .where(eq(legacyPatients.batchId, batchId))
    .groupBy(legacyPatients.schoolCode, legacyPatientComplaints.complaint);
  for (const r of comp) get(r.code).complaints[r.complaint] = r.n;
  const svc = await db
    .select({ code: legacyPatients.schoolCode, service: legacyPatientServices.service, n: sql<number>`count(distinct ${legacyPatientServices.patientId})::int` })
    .from(legacyPatientServices)
    .innerJoin(legacyPatients, eq(legacyPatients.id, legacyPatientServices.patientId))
    .where(and(eq(legacyPatients.batchId, batchId), sql`${legacyPatientServices.valueNum} > 0`))
    .groupBy(legacyPatients.schoolCode, legacyPatientServices.service);
  for (const r of svc) get(r.code).services[r.service] = r.n;
  return out;
}
