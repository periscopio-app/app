import test from "node:test";
import assert from "node:assert/strict";
import { checkPlan, planSchema, runPlan, scrubQuestion, type Fact } from "./bi-semantic.service";

const S1 = "11111111-1111-4111-8111-111111111111";
const S2 = "22222222-2222-4222-8222-222222222222";

function liveFacts(): Fact[] {
  const out: Fact[] = [];
  const add = (schoolId: string, school: string, n: number, state: string, age = "06-09") => {
    for (let i = 0; i < n; i++) out.push({ schoolId, dims: { school, journey_state: state, age_bracket: age, month: "2026-09" }, value: 1 });
  };
  add(S1, "Escola A", 12, "delegado");
  add(S1, "Escola A", 3, "encerrado");
  add(S2, "Escola B", 7, "delegado", "10-12");
  add(S2, "Escola B", 2, "rascunho", "10-12");
  return out;
}

const plan = (p: unknown) => planSchema.parse(p);

test("contagem oculta grupos de 1 a 4 e não informa total", () => {
  const r = runPlan(liveFacts(), plan({ metric: "cases", groupBy: ["journey_state"] }));
  const enc = r.rows.find((x) => x.dims.journey_state === "encerrado")!;
  const rasc = r.rows.find((x) => x.dims.journey_state === "rascunho")!;
  assert.equal(enc.suppressed, true);
  assert.equal(enc.value, null);
  assert.equal(rasc.suppressed, true);
  assert.equal(r.total, null);
  assert.equal(r.suppressedCount, 2);
  assert.match(r.notes.join(" "), /menos de 5/);
});

test("sem células pequenas o total é informado", () => {
  const r = runPlan(liveFacts(), plan({ metric: "cases", groupBy: ["school"] }));
  assert.equal(r.total, 24);
  assert.equal(r.rows[0].value, 15);
});

test("filtro por escola respeita o escopo e recalcula a supressão", () => {
  const r = runPlan(liveFacts(), plan({ metric: "cases", groupBy: ["journey_state"], filters: { schoolId: S1 } }));
  assert.equal(r.rows.find((x) => x.dims.journey_state === "delegado")!.value, 12);
  assert.equal(r.rows.find((x) => x.dims.journey_state === "encerrado")!.suppressed, true);
});

test("tempo médio exige ao menos 5 casos", () => {
  const facts: Fact[] = [
    ...Array.from({ length: 6 }, (_, i) => ({ schoolId: S1, dims: { school: "A" }, value: 10 + i })),
    ...Array.from({ length: 4 }, () => ({ schoolId: S2, dims: { school: "B" }, value: 5 })),
  ];
  const r = runPlan(facts, plan({ metric: "case_cycle_days", groupBy: ["school"] }));
  const a = r.rows.find((x) => x.dims.school === "A")!;
  const b = r.rows.find((x) => x.dims.school === "B")!;
  assert.equal(a.value, 12.5);
  assert.equal(a.n, 6);
  assert.equal(b.suppressed, true);
  assert.equal(b.value, null);
  assert.equal(b.n, undefined);
});

test("valor já suprimido na origem continua oculto e impede total", () => {
  const facts: Fact[] = [
    { schoolId: S1, dims: { school: "A", service: "fonoaudiologia" }, value: 40 },
    { schoolId: S1, dims: { school: "A", service: "psicomotricidade" }, value: null },
  ];
  const r = runPlan(facts, plan({ metric: "population_by_service", groupBy: ["service"] }));
  assert.equal(r.suppressedCount, 1);
  assert.equal(r.total, null);
  const total = runPlan(facts, plan({ metric: "population_by_service", groupBy: ["school"] }));
  assert.equal(total.rows[0].suppressed, true); // soma com parte oculta não é exibida
});

test("plano inválido é recusado", () => {
  assert.ok(checkPlan(plan({ metric: "students", groupBy: ["journey_state"] })));
  assert.ok(checkPlan(plan({ metric: "students", filters: { journeyState: "encerrado" } })));
  assert.ok(checkPlan(plan({ metric: "population_by_complaint", groupBy: ["school"] })));
  assert.ok(checkPlan(plan({ metric: "cases", filters: { from: "2026-10", to: "2026-01" } })));
  assert.equal(checkPlan(plan({ metric: "cases", groupBy: ["school", "journey_state"] })), null);
});

test("plano não aceita campos individuais nem SQL", () => {
  assert.throws(() => plan({ metric: "cases", groupBy: ["student_code"] }));
  assert.throws(() => plan({ metric: "cases", filters: { studentCode: "X" } }));
  assert.throws(() => plan({ metric: "cases; drop table users" }));
  assert.throws(() => plan({ metric: "cases", sql: "select 1" }));
});

test("higienização remove documento, e-mail e telefone da pergunta", () => {
  const r = scrubQuestion("casos da mãe maria 123.456.789-09 fone (14) 99876-5432 a@b.com");
  assert.equal(r.scrubbed, true);
  assert.doesNotMatch(r.text, /123\.456|99876|a@b\.com/);
  assert.equal(scrubQuestion("quantos casos por escola?").scrubbed, false);
});
