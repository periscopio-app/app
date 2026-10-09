/**
 * Carrega os agregados do Tarumã (gerados por extract_aggregates.py) no banco.
 *
 *   DATABASE_URL=... tsx scripts/taruma/load-aggregates.ts --file agg.json --tenant <uuid> [--create-schools] [--apply]
 *
 * Sem --apply roda em simulação (não grava nada). O arquivo só pode conter contagens agregadas:
 * qualquer campo fora do formato é recusado pelo mesmo validador da API.
 */
import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { db } from "../../src/db/client";
import { populationAggregates, schools } from "@periscopio/shared";
import { importSchema, norm } from "../../src/routes/population.routes";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (n: string) => process.argv.includes(`--${n}`);

async function main() {
  const file = arg("file");
  const tenantId = arg("tenant");
  if (!file || !tenantId) throw new Error("Use --file <agregados.json> --tenant <uuid>");
  const parsed = importSchema.safeParse({ ...JSON.parse(readFileSync(file, "utf8")), createMissingSchools: flag("create-schools") });
  if (!parsed.success) throw new Error("Arquivo fora do formato de agregados: " + JSON.stringify(parsed.error.issues.slice(0, 3)));
  const { source, referenceYear, total, schools: rows } = parsed.data;
  const apply = flag("apply");
  console.log(`${apply ? "APLICANDO" : "SIMULAÇÃO"}: ${rows.length} escolas + total do município (fonte ${source}, ${referenceYear})`);
  if (!apply) {
    for (const r of rows) console.log(`  ${r.schoolCode} ${r.schoolLabel}: ${r.total ?? "<5"} casos`);
    console.log("Nada foi gravado. Rode com --apply para gravar.");
    return;
  }
  for (const r of [{ schoolCode: "TOTAL", schoolLabel: "Município", ...total }, ...rows]) {
    const { schoolCode, schoolLabel, ...payload } = r;
    await db
      .insert(populationAggregates)
      .values({ tenantId, source, referenceYear, schoolCode, schoolLabel, payload })
      .onConflictDoUpdate({
        target: [populationAggregates.tenantId, populationAggregates.source, populationAggregates.schoolCode],
        set: { referenceYear, schoolLabel, payload },
      });
  }
  const TARUMA_SCHOOL_GEO: Record<string, { address: string; latitude: number; longitude: number; enrollment: number }> = {
    "1": { address: "Av. Tarumã, 120 - Centro, Tarumã - SP", latitude: -22.7486, longitude: -50.5752, enrollment: 520 },
    "2": { address: "R. Lambari, 555 - Vila Dourados, Tarumã - SP", latitude: -22.7412, longitude: -50.5821, enrollment: 580 },
    "3": { address: "R. das Palmas, 145 - Centro, Tarumã - SP", latitude: -22.7471, longitude: -50.5794, enrollment: 450 },
    "4": { address: "R. Flamingo, 120 - Vila dos Pássaros, Tarumã - SP", latitude: -22.7523, longitude: -50.5731, enrollment: 380 },
    "5": { address: "R. dos Tucanos, 350 - Vila dos Pássaros, Tarumã - SP", latitude: -22.7538, longitude: -50.5715, enrollment: 320 },
    "6": { address: "R. dos Canários, 80 - Tarumã - SP", latitude: -22.7505, longitude: -50.5768, enrollment: 310 },
    "7": { address: "R. Rouxinol, 210 - Tarumã - SP", latitude: -22.7445, longitude: -50.5840, enrollment: 280 },
    "8": { address: "Av. Paranapanema, 310 - Centro, Tarumã - SP", latitude: -22.7458, longitude: -50.5772, enrollment: 240 },
    "9": { address: "R. das Garças, s/n - Vila do Lago, Tarumã - SP", latitude: -22.7390, longitude: -50.5885, enrollment: 190 },
    "10": { address: "Bairro Rural Água da Onça, Tarumã - SP", latitude: -22.7650, longitude: -50.5550, enrollment: 95 },
    "11": { address: "Bairro Rural São Judas Tadeu, Tarumã - SP", latitude: -22.7720, longitude: -50.5420, enrollment: 85 },
  };

  if (flag("create-schools")) {
    const existing = await db.select().from(schools).where(eq(schools.tenantId, tenantId));
    for (const r of rows) {
      if (r.schoolCode === "0") continue;
      const match = existing.find((s) => (s.externalCode && norm(s.externalCode) === norm(r.schoolCode)) || norm(s.name) === norm(`escola ${r.schoolLabel}`));
      const geo = TARUMA_SCHOOL_GEO[r.schoolCode];
      if (match) {
        if (geo && (match.latitude == null || match.enrollment == null)) {
          await db.update(schools).set({ ...geo }).where(eq(schools.id, match.id));
        }
        continue;
      }
      const slug = `${norm(source).replace(/ /g, "-").slice(0, 20)}-${norm(r.schoolLabel).replace(/ /g, "-")}`;
      await db.insert(schools).values({
        tenantId,
        name: `Escola ${r.schoolLabel}`,
        slug,
        status: "active",
        externalCode: r.schoolCode,
        ...(geo ?? {}),
      }).onConflictDoNothing();
      console.log(`  escola criada: Escola ${r.schoolLabel}`);
    }
  }
  console.log("Concluído.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
