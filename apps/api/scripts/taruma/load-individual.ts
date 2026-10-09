/**
 * Carrega a base individual de Tarumã (gerada por individual_extract.py) no banco.
 *
 *   DATABASE_URL=... tsx scripts/taruma/load-individual.ts --file individual.ndjson --tenant <uuid> \
 *     --legal-basis "<base legal e contrato>" --authorized-by "<quem da controladora autorizou>" \
 *     [--authorization-ref "<documento/ata>"] [--apply] [--replace-batch] [--allow-pii-patterns]
 *   DATABASE_URL=... tsx scripts/taruma/load-individual.ts --verify <batchId>
 *
 * Sem --apply roda em simulação: valida o contrato inteiro e mostra contagens, sem gravar.
 * Com --apply grava tudo numa transação única (ou nada) e roda a conferência no fim.
 * O arquivo NDJSON contém dado de saúde de crianças: guarde em pasta protegida e apague depois da carga.
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { and, eq } from "drizzle-orm";
import { db } from "../../src/db/client";
import {
  auditLogs,
  legacyImportBatches,
  legacyImportRows,
  legacyPatientComplaints,
  legacyPatientItems,
  legacyPatientLocations,
  legacyPatientServices,
  legacyPatients,
  legacyVariableDictionary,
  schools,
} from "@periscopio/shared";
import {
  deniedColumns,
  manifestSchema,
  patientLineSchema,
  scanPiiValues,
  type Manifest,
  type PatientLine,
} from "../../src/services/legacy-import.service";
import { reconcileBatch } from "../../src/services/legacy-reconcile.service";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (n: string) => process.argv.includes(`--${n}`);

const chunk = <T>(a: T[], n = 200) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

async function readFileContract(file: string) {
  const rl = createInterface({ input: createReadStream(file, "utf8"), crlfDelay: Infinity });
  let manifest: Manifest | null = null;
  const lines: PatientLine[] = [];
  const problems: string[] = [];
  let n = 0;
  for await (const text of rl) {
    if (!text.trim()) continue;
    n++;
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      problems.push(`linha ${n}: JSON inválido`);
      continue;
    }
    if (n === 1) {
      const m = manifestSchema.safeParse(json);
      if (!m.success) problems.push("cabeçalho (manifesto) fora do contrato: " + JSON.stringify(m.error.issues.slice(0, 3)));
      else manifest = m.data.manifest;
      continue;
    }
    const p = patientLineSchema.safeParse(json);
    if (!p.success) problems.push(`registro ${n - 1}: fora do contrato (${p.error.issues[0]?.path.join(".")}: ${p.error.issues[0]?.message})`);
    else lines.push(p.data);
  }
  return { manifest, lines, problems };
}

async function main() {
  const verify = arg("verify");
  if (verify) {
    const r = await reconcileBatch(verify);
    printReport(r);
    process.exitCode = r.ok ? 0 : 1;
    return;
  }

  const file = arg("file");
  const tenantId = arg("tenant");
  if (!file || !tenantId) throw new Error("Use --file <individual.ndjson> --tenant <uuid>");
  const apply = flag("apply");
  const legalBasis = arg("legal-basis");
  const authorizedBy = arg("authorized-by");
  if (apply && (!legalBasis || !authorizedBy)) {
    throw new Error("Para gravar, informe --legal-basis e --authorized-by (fica registrado no lote, para auditoria).");
  }

  const { manifest, lines, problems } = await readFileContract(file);
  if (!manifest) throw new Error("Arquivo sem manifesto válido:\n" + problems.join("\n"));

  // Barreiras: nenhum identificador direto pode ter sobrado.
  const denied = new Set<string>();
  for (const l of lines) for (const k of deniedColumns(Object.keys(l.raw), manifest.allowedColumns)) denied.add(k);
  if (denied.size) problems.push(`colunas com cara de identificador direto na camada bruta: ${[...denied].join(", ")} (mapeie como nome/endereço ou descarte no contrato)`);
  const pii = lines.flatMap((l) => scanPiiValues(l).map((h) => ({ row: l.sourceRow, ...h })));
  if (pii.length && !flag("allow-pii-patterns")) {
    const sample = pii.slice(0, 5).map((h) => `linha ${h.row} ${h.field} (${h.pattern})`).join("; ");
    problems.push(`${pii.length} valores com padrão de CPF/e-mail/telefone: ${sample}. Revise; se forem falsos positivos use --allow-pii-patterns.`);
  }
  if (lines.length !== manifest.rowCount) problems.push(`manifesto declara ${manifest.rowCount} linhas, arquivo traz ${lines.length}`);
  const ids = new Set(lines.map((l) => l.patientId));
  if (ids.size !== lines.length) problems.push(`UUIDs de paciente repetidos (${lines.length - ids.size}): dois registros ficaram iguais após a pseudonimização`);
  if (problems.length) throw new Error("Carga recusada:\n - " + problems.join("\n - "));

  const byStatus: Record<string, number> = {};
  for (const l of lines) byStatus[l.location.status] = (byStatus[l.location.status] ?? 0) + 1;
  const perSchool: Record<string, number> = {};
  for (const l of lines) perSchool[l.school.code] = (perSchool[l.school.code] ?? 0) + 1;
  console.log(`${apply ? "APLICANDO" : "SIMULAÇÃO"}: ${lines.length} registros, fonte ${manifest.source}, ${manifest.columns.length} colunas na planilha`);
  console.log("  por escola:", JSON.stringify(perSchool));
  console.log("  localização:", JSON.stringify(byStatus));
  console.log(`  complementos: ${lines.reduce((a, l) => a + l.complaints.length, 0)} queixas, ${lines.reduce((a, l) => a + l.services.length, 0)} serviços, ${lines.reduce((a, l) => a + l.items.length, 0)} itens clínicos`);
  if (manifest.allowedColumns?.length) console.log(`  colunas liberadas por revisão humana (nome parece identificador, conteúdo não é): ${manifest.allowedColumns.join(", ")}`);
  if (manifest.dictionary?.length) console.log(`  dicionário de variáveis: ${manifest.dictionary.length} linhas`);
  for (const w of manifest.warnings ?? []) console.log("  aviso do extrator:", w);
  if (!apply) {
    console.log("Nada foi gravado. Rode com --apply para gravar.");
    return;
  }

  const schoolRows = await db.select().from(schools).where(eq(schools.tenantId, tenantId));
  const schoolByCode = new Map(schoolRows.filter((s) => s.externalCode).map((s) => [s.externalCode as string, s.id]));

  const batchId = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(legacyImportBatches)
      .where(and(eq(legacyImportBatches.tenantId, tenantId), eq(legacyImportBatches.source, manifest.source), eq(legacyImportBatches.fileSha256, manifest.fileSha256)))
      .limit(1);
    if (existing) {
      if (!flag("replace-batch")) throw new Error(`Esta planilha (sha256 ${manifest.fileSha256.slice(0, 12)}…) já foi carregada no lote ${existing.id}. Use --replace-batch para recarregar.`);
      await tx.delete(legacyImportBatches).where(eq(legacyImportBatches.id, existing.id)); // cascata limpa linhas e tabelas filhas
    }
    const [batch] = await tx
      .insert(legacyImportBatches)
      .values({
        tenantId,
        source: manifest.source,
        referenceYear: manifest.referenceYear,
        fileSha256: manifest.fileSha256,
        mappingSha256: manifest.mappingSha256,
        rowCount: manifest.rowCount,
        columns: manifest.columns,
        transformedColumns: manifest.transformedColumns,
        columnNonNull: manifest.columnNonNull,
        geocoder: manifest.geocoder,
        legalBasis: legalBasis!,
        authorizedBy: authorizedBy!,
        authorizationRef: arg("authorization-ref") ?? null,
      })
      .returning();

    for (const part of chunk(lines)) {
      await tx.insert(legacyPatients).values(
        part.map((l) => ({
          id: l.patientId,
          tenantId,
          batchId: batch.id,
          schoolId: schoolByCode.get(l.school.code) ?? null,
          schoolCode: l.school.code,
          sourceRow: l.sourceRow,
          recordNumber: l.patient.recordNumber ?? null,
          birthDate: l.patient.birthDate ?? null,
          currentAge: l.patient.currentAge ?? null,
          entryYear: l.patient.entryYear ?? null,
          guardianRef: l.patient.guardianRef ?? null,
          guardianRelation: l.patient.guardianRelation ?? null,
          religion: l.patient.religion ?? null,
          parentsOccupation: l.patient.parentsOccupation ?? null,
          economicClass: l.patient.economicClass ?? null,
          extra: l.patient.extra ?? null,
        })),
      );
      await tx.insert(legacyImportRows).values(
        part.map((l) => ({ batchId: batch.id, tenantId, sourceRow: l.sourceRow, patientId: l.patientId, data: l.raw })),
      );
      await tx.insert(legacyPatientLocations).values(
        part.map((l) => ({
          patientId: l.patientId,
          tenantId,
          status: l.location.status,
          latitude: l.location.latitude,
          longitude: l.location.longitude,
          accuracy: l.location.accuracy,
          confidence: l.location.confidence,
          addressKey: l.location.addressKey,
          provider: l.location.provider,
          permanent: l.location.permanent,
          geocodedAt: l.location.provider ? new Date() : null,
        })),
      );
    }
    const complaints = lines.flatMap((l) => [...new Set(l.complaints)].map((complaint) => ({ patientId: l.patientId, tenantId, complaint })));
    for (const part of chunk(complaints, 500)) await tx.insert(legacyPatientComplaints).values(part);
    const services = lines.flatMap((l) =>
      l.services.map((s) => ({ patientId: l.patientId, tenantId, service: s.service, sourceColumn: s.column, valueNum: s.valueNum, valueText: s.valueText })),
    );
    for (const part of chunk(services, 500)) await tx.insert(legacyPatientServices).values(part);
    const items = lines.flatMap((l) => l.items.map((i) => ({ patientId: l.patientId, tenantId, kind: i.kind, position: i.position, text: i.text })));
    for (const part of chunk(items, 500)) await tx.insert(legacyPatientItems).values(part);

    for (const part of chunk(manifest.dictionary ?? [], 500)) {
      await tx.insert(legacyVariableDictionary).values(part.map((d) => ({ ...d, batchId: batch.id, tenantId })));
    }

    await tx.insert(auditLogs).values({
      tenantId,
      action: "legacy_import:apply",
      entity: "legacy_import_batches",
      entityId: batch.id,
      metadata: { source: manifest.source, rows: lines.length, authorizedBy, fileSha256: manifest.fileSha256 },
    });
    return batch.id;
  });

  console.log(`Lote ${batchId} gravado. Conferindo…`);
  const r = await reconcileBatch(batchId);
  printReport(r);
  process.exitCode = r.ok ? 0 : 1;
}

function printReport(r: Awaited<ReturnType<typeof reconcileBatch>>) {
  console.log(`\nCONFERÊNCIA do lote ${r.batchId}: ${r.ok ? "TUDO CONFERE" : "DIVERGÊNCIAS"}`);
  console.log(`  linhas: planilha ${r.rows.sheet} | banco ${r.rows.database} | pacientes ${r.rows.patients} → ${r.rows.status}`);
  const bad = r.columns.filter((c) => c.status === "mismatch");
  console.log(`  colunas conferidas: ${r.columns.length} (divergentes: ${bad.length}; nome/endereço fora do banco por desenho: ${r.columns.filter((c) => c.status === "not_in_database").length})`);
  for (const c of bad) console.log(`    ✗ ${c.column}: planilha ${c.sheet} células preenchidas, banco ${c.database}`);
  if (r.aggregates.note) console.log("  agregados:", r.aggregates.note);
  else console.log(`  agregados (population_aggregates): ${r.aggregates.checks} comparações, ${r.aggregates.mismatches.length} divergências`);
  for (const m of r.aggregates.mismatches.slice(0, 30)) console.log(`    ✗ ${m.scope} ${m.metric}/${m.key}: agregado ${m.stored ?? "<5"} × individual ${m.derived}`);
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
