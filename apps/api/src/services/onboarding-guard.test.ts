import { test } from "node:test";
import assert from "node:assert";
import { validateProfessionalsInput, MAX_PROFESSIONALS } from "./onboarding-guard";

const ok = { name: "Fulana", email: "f@escola.gov.br", specialty: "medicina" };

test("aceita ausência de lista e lista válida", () => {
  assert.equal(validateProfessionalsInput(undefined).ok, true);
  assert.equal(validateProfessionalsInput([ok]).ok, true);
});

test("rejeita e-mail, especialidade e nome inválidos", () => {
  assert.equal(validateProfessionalsInput([{ ...ok, email: "x" }]).ok, false);
  assert.equal(validateProfessionalsInput([{ ...ok, specialty: "admin_platform" }]).ok, false);
  assert.equal(validateProfessionalsInput([{ ...ok, name: "" }]).ok, false);
  assert.equal(validateProfessionalsInput("x").ok, false);
});

test("limita o tamanho do lote", () => {
  assert.equal(validateProfessionalsInput(Array(MAX_PROFESSIONALS + 1).fill(ok)).ok, false);
});
