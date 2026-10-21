import test from "node:test";
import assert from "node:assert/strict";
import { sumarioExecutivoMedico } from "./specialist-view.service";

test("sumário do médico em rascunho ou inexistente fica pendente e sem texto", () => {
  assert.deepEqual(sumarioExecutivoMedico(null), { status: "pendente", registro: null, completedAt: null });
  assert.deepEqual(
    sumarioExecutivoMedico({ status: "rascunho", payload: { registro: "ainda escrevendo" }, completedAt: null }),
    { status: "pendente", registro: null, completedAt: null }
  );
});

test("sumário do médico concluído libera só o texto do registro", () => {
  const quando = new Date();
  const out = sumarioExecutivoMedico({ status: "concluido", payload: { registro: "texto sintético", outro: "x" }, completedAt: quando });
  assert.deepEqual(out, { status: "concluido", registro: "texto sintético", completedAt: quando });
});

test("payload inválido concluído vira texto vazio, sem quebrar", () => {
  assert.equal(sumarioExecutivoMedico({ status: "concluido", payload: null, completedAt: null }).registro, "");
});
