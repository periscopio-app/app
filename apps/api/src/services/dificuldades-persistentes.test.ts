/**
 * REG-021 — Dificuldades persistentes do sumário do RE: "Aprendizagem" sai e entram Leitura, Matemática e Escrita.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DIFICULDADES_PERSISTENTES_OPCOES, sumarioComPadroes } from "@periscopio/shared";

describe("dificuldades persistentes (REG-021)", () => {
  test("a lista não oferece mais Aprendizagem e traz Leitura, Matemática e Escrita no lugar, mantendo Outra por último", () => {
    assert.ok(!DIFICULDADES_PERSISTENTES_OPCOES.includes("Aprendizagem"));
    const i = DIFICULDADES_PERSISTENTES_OPCOES.indexOf("Compreensão");
    assert.deepEqual(DIFICULDADES_PERSISTENTES_OPCOES.slice(i + 1, i + 4), ["Leitura", "Matemática", "Escrita"]);
    assert.equal(DIFICULDADES_PERSISTENTES_OPCOES.at(-1), "Outra");
    assert.equal(new Set(DIFICULDADES_PERSISTENTES_OPCOES).size, DIFICULDADES_PERSISTENTES_OPCOES.length, "sem repetição");
  });

  test("registro antigo com Aprendizagem continua sendo lido (aparece como valor avulso, nada se perde)", () => {
    const s = sumarioComPadroes({ dificuldades_persistentes: ["Fala", "Aprendizagem"] } as never);
    assert.deepEqual(s.dificuldades_persistentes, ["Fala", "Aprendizagem"]);
    const extras = s.dificuldades_persistentes.filter((d) => !DIFICULDADES_PERSISTENTES_OPCOES.includes(d));
    assert.deepEqual(extras, ["Aprendizagem"], "a tela mostra o valor antigo fora da lista nova");
  });
});
