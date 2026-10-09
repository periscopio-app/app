import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSeedExamples } from "./bi-seed.service";

const SEED = fileURLToPath(new URL("../../../bi-rag/seed/bi_examples_taruma.json", import.meta.url));

test("o seed do repositório é válido contra a camada semântica", () => {
  const ex = loadSeedExamples(SEED);
  assert.ok(ex.length >= 50);
  const metrics = new Set(ex.map((e) => e.plan.metric));
  for (const m of ["population_total", "population_by_age", "population_by_complaint", "population_by_service", "professionals_needed", "cases", "students", "case_cycle_days", "delegations"])
    assert.ok(metrics.has(m as never), `sem exemplo para ${m}`);
});

function withFile(content: unknown) {
  const p = join(mkdtempSync(join(tmpdir(), "seed-")), "s.json");
  writeFileSync(p, JSON.stringify(content));
  return p;
}
const wrap = (examples: unknown[]) => ({ version: 1, source: "t", examples });

test("recusa plano incoerente, id de escola, dado pessoal e pergunta repetida", () => {
  assert.throws(() => loadSeedExamples(withFile(wrap([{ question: "queixas por escola", plan: { metric: "population_by_complaint", groupBy: ["school"], filters: {} } }]))), /incoerente/);
  assert.throws(() => loadSeedExamples(withFile(wrap([{ question: "alunos da escola", plan: { metric: "students", groupBy: [], filters: { schoolId: "11111111-1111-4111-8111-111111111111" } } }]))), /id de escola/);
  assert.throws(() => loadSeedExamples(withFile(wrap([{ question: "casos do cpf 123.456.789-09", plan: { metric: "cases", groupBy: [], filters: {} } }]))), /dado pessoal/);
  const dup = { question: "quantos casos?", plan: { metric: "cases", groupBy: [], filters: {} } };
  assert.throws(() => loadSeedExamples(withFile(wrap([dup, dup]))), /repetida/);
});
