/**
 * Carrega o conjunto inicial de perguntas aprovadas do assistente do BI (vocabulário da base de Tarumã).
 *
 *   DATABASE_URL=... tsx scripts/taruma/seed-bi-examples.ts --tenant <uuid> [--file <json>] [--apply]
 *
 * Sem --apply só valida e mostra o que entraria. Não envia nada a provedor de IA e não toca em dado de paciente.
 */
import { fileURLToPath } from "node:url";
import { db } from "../../src/db/client";
import { applySeed, loadSeedExamples } from "../../src/services/bi-seed.service";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const tenantId = arg("tenant");
  if (!tenantId) throw new Error("Use --tenant <uuid>");
  const file = arg("file") ?? fileURLToPath(new URL("../../../bi-rag/seed/bi_examples_taruma.json", import.meta.url));
  const examples = loadSeedExamples(file);
  const byMetric: Record<string, number> = {};
  for (const e of examples) byMetric[e.plan.metric] = (byMetric[e.plan.metric] ?? 0) + 1;
  console.log(`${examples.length} exemplos válidos. Por métrica:`, byMetric);
  if (!process.argv.includes("--apply")) {
    console.log("SIMULAÇÃO: nada foi gravado. Rode com --apply para gravar como perguntas aprovadas do tenant.");
    return;
  }
  const r = await applySeed(db, tenantId, examples);
  console.log(`Gravado: ${r.inserted} novos, ${r.skipped} já existiam.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
