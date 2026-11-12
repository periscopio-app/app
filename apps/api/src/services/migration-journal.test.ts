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
import { MIGRACOES_DE_DADOS_FORA_DO_GUARD, SCHEMA_GUARD_FILES } from "./schema-guard.service";

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

  it("migração nova (idx >= 36) está no schema-guard (estrutura) ou na lista de migrações de dados, e o arquivo existe", () => {
    const guard = new Set<string>(SCHEMA_GUARD_FILES);
    const dados = new Set<string>(MIGRACOES_DE_DADOS_FORA_DO_GUARD);
    const faltando = journal.filter((e) => e.idx >= PRIMEIRO_IDX_NO_GUARD && !guard.has(`${e.tag}.sql`) && !dados.has(e.tag)).map((e) => e.tag);
    assert.deepEqual(faltando, [], "adicione o arquivo em SCHEMA_GUARD_FILES (estrutura) ou em MIGRACOES_DE_DADOS_FORA_DO_GUARD (dados)");
    for (const f of SCHEMA_GUARD_FILES) assert.ok(sqlTags.includes(f.replace(/\.sql$/, "")), `${f} não existe em drizzle/`);
    for (const t of MIGRACOES_DE_DADOS_FORA_DO_GUARD) assert.ok(sqlTags.includes(t), `${t} não existe em drizzle/`);
  });

  it("[REG-023] o schema-guard roda a cada boot: migração nova dele não pode apagar nem alterar dados", () => {
    const comandosDeDados = /^\s*(DELETE\s+FROM|UPDATE\s+\S+\s+SET|TRUNCATE|INSERT\s+INTO)\b/im;
    const proibidas = SCHEMA_GUARD_FILES.filter((f) => {
      const idx = journal.find((e) => `${e.tag}.sql` === f)?.idx ?? -1;
      if (idx < PRIMEIRO_IDX_NO_GUARD) return false; // as antigas já existiam antes desta regra
      const sql = readFileSync(join(dir, f), "utf8").replace(/--.*$/gm, "");
      return comandosDeDados.test(sql);
    });
    assert.deepEqual(proibidas, [], "migração de dados fora do schema-guard: ponha em MIGRACOES_DE_DADOS_FORA_DO_GUARD");
    for (const t of MIGRACOES_DE_DADOS_FORA_DO_GUARD) assert.ok(!(SCHEMA_GUARD_FILES as readonly string[]).includes(`${t}.sql`), `${t} não pode estar no schema-guard`);
  });
});
