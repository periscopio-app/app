import test from "node:test";
import assert from "node:assert/strict";
import { ageBracketOf, generateStudentCode, validateBirth, validatePilotAge } from "./student-code";

test("código tem formato estável e não repete", () => {
  const set = new Set(Array.from({ length: 500 }, () => generateStudentCode("escola-a1", 2026)));
  assert.equal(set.size, 500);
  for (const c of set) assert.match(c, /^ESCO-2026-[A-HJ-NP-Z2-9]{8}$/);
});

test("valida ano e mês de nascimento", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  assert.equal(validateBirth({ birthYear: 2017, birthMonth: 3 }, now).ok, true);
  assert.equal(validateBirth({ birthYear: 0, birthMonth: 3 }, now).ok, false);
  assert.equal(validateBirth({ birthYear: 2017, birthMonth: 0 }, now).ok, false);
  assert.equal(validateBirth({ birthYear: 2017 }, now).ok, false);
  assert.equal(validateBirth({ birthYear: 2026, birthMonth: 12 }, now).ok, false);
});

test("faixa etária", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  assert.equal(ageBracketOf(2017, 3, now), "06-09");
  assert.equal(ageBracketOf(2021, 1, now), "00-05");
});

test("trava de idade do piloto: 6 anos completos até 9 anos e 11 meses", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  assert.equal(validatePilotAge(2020, 10, now).ok, true, "6a0m entra");
  assert.equal(validatePilotAge(2020, 11, now).ok, false, "5a11m fica de fora");
  assert.equal(validatePilotAge(2016, 11, now).ok, true, "9a11m entra");
  assert.equal(validatePilotAge(2016, 10, now).ok, false, "10a0m fica de fora");
  assert.equal(validatePilotAge(2024, 1, now).ok, false, "2 anos (caso do print) fica de fora");
  const r = validatePilotAge(2024, 1, now);
  assert.ok(!r.ok && /6 anos a 9 anos e 11 meses/.test(r.error));
});
