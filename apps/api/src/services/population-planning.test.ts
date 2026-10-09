import test from "node:test";
import assert from "node:assert/strict";
import { planSchool, parseCapacity, missingInfo, CAPACITY_DEFAULTS } from "./population-planning.service";

const payload = {
  total: 104,
  ageBands: {},
  complaints: {},
  services: { fonoaudiologia: 40, psicopedagogia: 42, psicoterapia: null, psicomotricidade: 12, neuropsicologia: 54, assistencia_social: 0, consulta_medica: 104 },
};

test("taxa por mil e profissionais; célula suprimida vira mínimo", () => {
  const p = planSchool(payload, 800, CAPACITY_DEFAULTS);
  assert.equal(p.ratePer1000, 130);
  assert.equal(p.professionals.fonoaudiologia, 1);
  assert.equal(p.professionals.psicoterapia, undefined);
  assert.equal(p.lowerBound, true);
});

test("sem matrícula não calcula taxa; total suprimido é sinalizado", () => {
  const p = planSchool({ ...payload, total: null }, null, CAPACITY_DEFAULTS);
  assert.equal(p.ratePer1000, null);
  assert.equal(p.suppressed, true);
});

test("capacidade inválida volta ao padrão", () => {
  assert.equal(parseCapacity({ fonoaudiologia: -3, psicopedagogia: 20 }).fonoaudiologia, 40);
  assert.equal(parseCapacity({ psicopedagogia: 20 }).psicopedagogia, 20);
});

test("lista os pontos sem informação", () => {
  assert.deepEqual(missingInfo({ latitude: null, longitude: null, enrollment: null, hasAggregate: false }), ["localização", "matrícula", "dados da base populacional"]);
  assert.deepEqual(missingInfo({ latitude: 1, longitude: 2, enrollment: 9, hasAggregate: true }), []);
});
