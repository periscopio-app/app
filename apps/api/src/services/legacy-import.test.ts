import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scanPiiValues, deniedColumns, type PatientLine } from "./legacy-import.service";

const base = (over: Record<string, unknown>) =>
  ({
    sourceRow: 2,
    patientId: "11111111-1111-4111-8111-111111111111",
    school: { code: "1", label: "A" },
    patient: {},
    location: { status: "no_address" },
    complaints: [],
    services: [],
    items: [],
    raw: {},
    ...over,
  }) as unknown as PatientLine;

test("UUID de pseudônimo não é confundido com telefone", () => {
  const l = base({ patient: { guardianRef: "6f1c2a9e-4a1b-9c3d-8e7f-1234abcd5678" }, raw: { "FAMILIAR": "6f1c2a9e-4a1b-9c3d-8e7f-1234abcd5678" } });
  assert.deepEqual(scanPiiValues(l), []);
});

test("CPF, e-mail e telefone em texto livre continuam sendo pegos", () => {
  const l = base({ raw: { a: "cpf 123.456.789-09", b: "x@y.com", c: "ligar (14) 99876-5432" } });
  const names = scanPiiValues(l).map((h) => h.pattern).sort();
  assert.deepEqual(names, ["cpf", "email", "telefone"]);
});

test("colunas com cara de identificador são barradas", () => {
  assert.deepEqual(deniedColumns(["NOME", "ENDEREÇO", "RELIGIÃO", "Telefone Mãe"]), ["NOME", "ENDEREÇO", "Telefone Mãe"]);
});

test("nenhuma rota da API lê as tabelas legacy_* (base individual só por script/DBA)", () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "routes");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts") && !x.endsWith(".test.ts"))) {
    const src = readFileSync(join(dir, f), "utf8");
    assert.ok(!/legacy_|legacyPatient|legacyImport/.test(src), `${f} referencia a base individual`);
  }
});
