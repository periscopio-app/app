import test from "node:test";
import assert from "node:assert/strict";
import { sumarioExecutivoMedico } from "./specialist-view.service";

test("sumário do médico em rascunho ou inexistente fica pendente e sem texto", () => {
  assert.deepEqual(sumarioExecutivoMedico(null), { status: "pendente", registro: null, completedAt: null, campos: [] });
  assert.deepEqual(
    sumarioExecutivoMedico({ status: "rascunho", payload: { registro: "ainda escrevendo" }, completedAt: null }),
    { status: "pendente", registro: null, completedAt: null, campos: [] }
  );
});

test("sumário concluído devolve campos normalizados, conduta marcada na ordem do papel e data pura", () => {
  const quando = new Date();
  const out = sumarioExecutivoMedico({
    status: "concluido",
    payload: {
      queixa_professor: "Queixa sintética",
      avaliacao_re: "Avaliação sintética",
      hipotese: "Hipótese sintética",
      conduta: "8,6,999",
      data: "2026-10-27",
      outro: "não deve sair",
    },
    completedAt: quando,
  });
  assert.equal(out.status, "concluido");
  assert.equal(out.completedAt, quando);
  assert.ok(out.registro?.includes("Queixa sintética"));
  assert.ok(out.registro?.includes("4. Conduta (0. Não · 1. Sim):"));
  assert.deepEqual(out.campos, [
    { id: "queixa_professor", rotulo: "1. Queixa do professor", tipo: "texto", valor: "Queixa sintética" },
    { id: "avaliacao_re", rotulo: "2. Avaliação do RE", tipo: "texto", valor: "Avaliação sintética" },
    { id: "hipotese", rotulo: "3. Hipótese Diagnóstica", tipo: "texto", valor: "Hipótese sintética" },
    {
      id: "conduta",
      rotulo: "4. Conduta",
      tipo: "lista",
      valor: null,
      itens: ["6. sim, está sob farmacoterapia", "8. Fez avaliação neuropsicológica"],
    },
    { id: "data", rotulo: "Data", tipo: "data", valor: "2026-10-27" },
  ]);
  assert.ok(!JSON.stringify(out.campos).includes("não deve sair"));
});

test("payload inválido concluído vira texto vazio, sem quebrar", () => {
  const out = sumarioExecutivoMedico({ status: "concluido", payload: null, completedAt: null });
  assert.equal(out.registro, "");
  assert.deepEqual(out.campos.map((campo) => campo.valor), [null, null, null, null, null]);
});
