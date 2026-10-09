/**
 * E2E da migração da base individual: planilha SINTÉTICA -> extrator Python (nome->UUID, endereço sem vazar)
 * -> carregador transacional -> conferência contra os agregados gerados pelo extrator antigo.
 * Requer TEST_DATABASE_URL, python3 e openpyxl (pula se faltar).
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.TEST_DATABASE_URL;
const py = spawnSync("python3", ["-c", "import openpyxl"], { encoding: "utf8" });
const skip = !url ? "TEST_DATABASE_URL ausente" : py.status !== 0 ? "python3/openpyxl ausente" : false;

const apiRoot = fileURLToPath(new URL("../../", import.meta.url));
const SECRET = "segredo-de-teste-com-mais-de-32-caracteres!!";

const GEN = `
import sys, random, datetime as dt, openpyxl
random.seed(7)
H = ["NOME","PRONTUÁRIO","NASCIMENTO","ID ATUAL","ANO","Escola","FAMILIAR RESPONSÁVEL","RELIGIÃO","ENDEREÇO","HIPÓTESE","FÁRMACOS","ANTECEDENTES"]
H += ["QUEIXA-%d" % i for i in range(16)]
H += ["FONOID","FONOaval","FONOter","PpCaval","PpCter","PSICOter","PsicoM aval","PsicoM ter","ANP","AS","SESSÕES MD 1","SESSÕES MD 2","SESSÕES MD 3"]
wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Dados"; ws.append(H)
plan = [("1", 18), ("2", 12), ("3", 7), ("5", 3), ("0", 2)]  # escola 5 e 0: poucos casos (células ocultas)
n = 0
for code, k in plan:
    for _ in range(k):
        n += 1
        row = ["Criança Sintética %03d" % n, "PR-%04d" % n, dt.datetime(2005 + n % 14, 1 + n % 12, 1 + n % 27),
               4 + n % 20, 2012 + n % 12, int(code), "Responsável Sintético %02d" % (n // 2), random.choice(["Católica", "Espírita", None]),
               "Rua Sintética %d, Bairro Teste" % (n // 2), "Hipótese %d; Hipótese %d" % (n % 5, n % 7) if n % 3 else None,
               "Fármaco %d" % (n % 4) if n % 4 == 0 else None, "Antecedente %d" % (n % 6) if n % 5 == 0 else None]
        row += [1 if random.random() < 0.25 else (0 if random.random() < 0.5 else None) for _ in range(16)]
        row += [random.choice([None, 0, 1, 2]) for _ in range(13)]
        ws.append(row)
wb.save(sys.argv[1])
print(n)
`;

describe("migração da base individual (E2E, dados sintéticos)", { skip }, () => {
  let dir = "";
  let tenantId = "";
  let ndjson = "";
  let batchId = "";
  let total = 0;
  const names: string[] = [];

  const run = (script: string, args: string[], env: Record<string, string> = {}) =>
    spawnSync("python3", ["-I", join(apiRoot, "scripts/taruma", script), ...args], { encoding: "utf8", env: { ...process.env, ...env } });
  const load = (args: string[]) =>
    spawnSync("npx", ["tsx", "scripts/taruma/load-individual.ts", ...args], {
      cwd: apiRoot, encoding: "utf8", env: { ...process.env, DATABASE_URL: url!, NODE_ENV: "test" },
    });

  before(async () => {
    const { assertSafeTestDatabase, resetTestDatabase } = await import("../testing/test-db");
    assertSafeTestDatabase(url);
    await resetTestDatabase(url!);
    process.env.DATABASE_URL = url!;
    dir = mkdtempSync(join(tmpdir(), "legacy-"));

    const xlsx = join(dir, "sintetica.xlsx");
    const g = spawnSync("python3", ["-c", GEN, xlsx], { encoding: "utf8" });
    assert.equal(g.status, 0, g.stderr);
    total = Number(g.stdout.trim());
    for (let i = 1; i <= total; i++) names.push(`Criança Sintética ${String(i).padStart(3, "0")}`);

    // agregados pelo extrator ANTIGO (referência independente) e individual pelo NOVO
    const agg = join(dir, "agg.json");
    const a = run("extract_aggregates.py", [xlsx, agg]);
    assert.equal(a.status, 0, a.stderr);
    const sug = run("individual_extract.py", ["suggest", xlsx]);
    assert.equal(sug.status, 0, sug.stderr);
    const mapping = JSON.parse(sug.stdout);
    mapping.address.appendToQuery = "";
    const mp = join(dir, "mapping.json");
    writeFileSync(mp, JSON.stringify(mapping));
    ndjson = join(dir, "individual.ndjson");
    const e = run("individual_extract.py", ["extract", xlsx, "--mapping", mp, "--out", ndjson, "--geocode", "off"], { PSEUDONYM_SECRET: SECRET });
    assert.equal(e.status, 0, e.stderr);

    const shared = await import("@periscopio/shared");
    const { db } = await import("../db/client");
    const { importSchema } = await import("../routes/population.routes");
    const [t] = await db.insert(shared.tenants).values({ name: "Município de Tarumã (teste)", municipalityCode: "3553955" }).returning();
    tenantId = t.id;
    for (const [code, label] of [["1", "MAB"], ["2", "GL"], ["3", "JOO"], ["5", "HH"]]) {
      await db.insert(shared.schools).values({ tenantId, name: `Escola ${label}`, slug: `t-${label}`, status: "active", externalCode: code });
    }
    const parsed = importSchema.parse(JSON.parse(readFileSync(agg, "utf8")));
    for (const r of [{ schoolCode: "TOTAL", schoolLabel: "Município", ...parsed.total }, ...parsed.schools]) {
      const { schoolCode, schoolLabel, ...payload } = r;
      await db.insert(shared.populationAggregates).values({ tenantId, source: parsed.source, referenceYear: parsed.referenceYear, schoolCode, schoolLabel, payload });
    }
  });

  after(async () => {
    rmSync(dir, { recursive: true, force: true });
    const { db } = await import("../db/client");
    await (db as any).$client.end();
  });

  const common = () => ["--file", ndjson, "--tenant", tenantId, "--legal-basis", "Contrato de desenvolvimento (teste)", "--authorized-by", "Controladora (teste)"];

  test("simulação valida o contrato e não grava nada", async () => {
    const r = load(common());
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /SIMULAÇÃO/);
    const { db } = await import("../db/client");
    const shared = await import("@periscopio/shared");
    assert.equal((await db.select().from(shared.legacyPatients)).length, 0);
  });

  test("sem base legal e autorizante a gravação é recusada", () => {
    const r = load(["--file", ndjson, "--tenant", tenantId, "--apply"]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /--legal-basis/);
  });

  test("grava tudo e a conferência bate com a planilha e com os agregados", async () => {
    const r = load([...common(), "--apply"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /TUDO CONFERE/);
    const { db } = await import("../db/client");
    const shared = await import("@periscopio/shared");
    const pts = await db.select().from(shared.legacyPatients);
    assert.equal(pts.length, total);
    assert.equal((await db.select().from(shared.legacyImportRows)).length, total);
    assert.equal((await db.select().from(shared.legacyPatientLocations)).length, total);
    assert.ok(pts.every((p) => /^[0-9a-f-]{36}$/.test(p.id)));
    assert.ok(pts.some((p) => p.schoolId), "escolas cadastradas ficam vinculadas pelo código");
    assert.equal(pts.filter((p) => p.schoolCode === "0").every((p) => p.schoolId === null), true);
    const [b] = await db.select().from(shared.legacyImportBatches);
    batchId = b.id;
    assert.equal(b.authorizedBy, "Controladora (teste)");
    const audit = await db.select().from(shared.auditLogs);
    assert.ok(audit.some((l) => l.action === "legacy_import:apply"));
  });

  test("nenhum nome, endereço ou nome de responsável existe em qualquer tabela legacy_*", async () => {
    const { db } = await import("../db/client");
    const { sql } = await import("drizzle-orm");
    const tables = ["legacy_import_batches", "legacy_import_rows", "legacy_patients", "legacy_patient_locations", "legacy_patient_complaints", "legacy_patient_services", "legacy_patient_items"];
    for (const t of tables) {
      const res = await db.execute(sql.raw(`select coalesce(string_agg(row_to_json(x)::text, ' '), '') as s from ${t} x`));
      const s = (res.rows[0] as { s: string }).s;
      assert.ok(!/Criança Sintética|Responsável Sintético|Rua Sintética|Bairro Teste/.test(s), `vazamento em ${t}`);
    }
    // o que NÃO é nome/endereço continua lá, por dado
    const res = await db.execute(sql.raw(`select count(*)::int n from legacy_import_rows where data->>'PRONTUÁRIO' like 'PR-%' and data ? 'RELIGIÃO'`));
    assert.ok((res.rows[0] as { n: number }).n > 0);
  });

  test("a mesma planilha não entra duas vezes; --replace-batch recarrega e confere de novo", async () => {
    const again = load([...common(), "--apply"]);
    assert.notEqual(again.status, 0);
    assert.match(again.stderr, /já foi carregada/);
    const re = load([...common(), "--apply", "--replace-batch"]);
    assert.equal(re.status, 0, re.stdout + re.stderr);
    assert.match(re.stdout, /TUDO CONFERE/);
    const { db } = await import("../db/client");
    const shared = await import("@periscopio/shared");
    assert.equal((await db.select().from(shared.legacyPatients)).length, total, "sem duplicar pacientes");
    const [b] = await db.select().from(shared.legacyImportBatches);
    batchId = b.id;
  });

  test("a conferência pega divergência: apagar um dado individual faz o --verify falhar", async () => {
    const { db } = await import("../db/client");
    const { sql } = await import("drizzle-orm");
    const ok = load(["--verify", batchId]);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    await db.execute(sql.raw(`delete from legacy_patient_complaints where ctid in (select ctid from legacy_patient_complaints limit 1)`));
    const bad = load(["--verify", batchId]);
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /DIVERGÊNCIAS/);
    assert.match(bad.stdout, /✗/);
  });

  test("barreiras do carregador: coluna de identificador direto e CPF em texto livre são recusados", () => {
    const lines = readFileSync(ndjson, "utf8").trim().split("\n");
    const a = JSON.parse(lines[1]);
    a.raw["Nome da mãe"] = "x";
    const f1 = join(dir, "ruim1.ndjson");
    writeFileSync(f1, [lines[0], JSON.stringify(a), ...lines.slice(2)].join("\n"));
    const r1 = load(["--file", f1, "--tenant", tenantId]);
    assert.notEqual(r1.status, 0);
    assert.match(r1.stderr, /identificador direto/);

    const b = JSON.parse(lines[1]);
    b.items.push({ kind: "family_history", position: 9, text: "contato 123.456.789-09" });
    const f2 = join(dir, "ruim2.ndjson");
    writeFileSync(f2, [lines[0], JSON.stringify(b), ...lines.slice(2)].join("\n"));
    const r2 = load(["--file", f2, "--tenant", tenantId]);
    assert.notEqual(r2.status, 0);
    assert.match(r2.stderr, /padrão de CPF/);
    assert.ok(!r2.stderr.includes("123.456.789-09"), "a mensagem de erro não repete o valor");

    const c = JSON.parse(lines[1]);
    c.extraCampoDesconhecido = 1;
    const f3 = join(dir, "ruim3.ndjson");
    writeFileSync(f3, [lines[0], JSON.stringify(c), ...lines.slice(2)].join("\n"));
    const r3 = load(["--file", f3, "--tenant", tenantId]);
    assert.notEqual(r3.status, 0);
    assert.match(r3.stderr, /fora do contrato/);
  });
});
