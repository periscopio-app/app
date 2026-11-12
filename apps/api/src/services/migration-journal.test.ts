/**
 * Trava de migrações. O banco de teste aplica todo `.sql` por nome de arquivo, então um arquivo esquecido no journal
 * do Drizzle passa nos testes e só aparece em produção (aconteceu com a 0036 da gestão e a 0037 do Google Agenda).
 * Este teste olha o journal e o schema-guard diretamente.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { SCHEMA_GUARD_FILES } from "./schema-guard.service";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../../drizzle");
const journal = (JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8")) as {
  entries: { idx: number; when: number; tag: string }[];
}).entries;
const sqlTags = readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).map((f) => f.replace(/\.sql$/, ""));

// A partir daqui a migração é aplicada pelo servidor ao iniciar (schema-guard), não por `pnpm db:migrate`.
const PRIMEIRO_IDX_NO_GUARD = 36;

describe("migrações do Drizzle", () => {
  it("todo arquivo .sql está registrado no journal", () => {
    const tags = new Set(journal.map((e) => e.tag));
    assert.deepEqual(sqlTags.filter((t) => !tags.has(t)), [], "arquivo .sql fora do journal: o `drizzle-kit migrate` pula");
  });

  it("toda entrada do journal tem o arquivo .sql", () => {
    const files = new Set(sqlTags);
    assert.deepEqual(journal.filter((e) => !files.has(e.tag)).map((e) => e.tag), []);
  });

  it("idx é sequencial a partir de 0 e `when` cresce (o Drizzle só aplica o que tem `when` maior que a última aplicada)", () => {
    assert.deepEqual(journal.map((e) => e.idx), journal.map((_, i) => i));
    journal.slice(1).forEach((e, i) => assert.ok(e.when > journal[i].when, `${e.tag}: when não cresce`));
  });

  it("migração nova (idx >= 36) está no schema-guard e o arquivo existe", () => {
    const guard = new Set<string>(SCHEMA_GUARD_FILES);
    const faltando = journal.filter((e) => e.idx >= PRIMEIRO_IDX_NO_GUARD && !guard.has(`${e.tag}.sql`)).map((e) => e.tag);
    assert.deepEqual(faltando, [], "adicione o arquivo em SCHEMA_GUARD_FILES (schema-guard.service.ts)");
    for (const f of SCHEMA_GUARD_FILES) assert.ok(sqlTags.includes(f.replace(/\.sql$/, "")), `${f} não existe em drizzle/`);
  });
});
