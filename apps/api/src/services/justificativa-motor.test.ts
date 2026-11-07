/**
 * REG-024 — justificativa obrigatória no motor de formulários A–F (Spec J-02).
 * Sim, Não ou Às vezes abrem a justificativa; o rascunho aceita incompleto; o envio só passa com texto válido.
 * Os campos são escolhidos no catálogo real, e todos os textos são sintéticos.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  RE_FORMS,
  camposDoForm,
  justificativasPendentes,
  lacunasDeJustificativa,
  respostaExigeJustificativa,
  validarPayloadReForm,
} from "@periscopio/shared";

const JUST_OK = "Foi observado em sala que o aluno evita atividades de leitura em voz alta e pede ajuda ao colega com frequência durante a aula.";
const JUST_CURTA = "Observei que o aluno";
const JUST_LOREM = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim.";

function campoEscolha(): string {
  for (const c of camposDoForm(RE_FORMS.b)) {
    if (c.tipo === "unica" && c.opcoes.some((o) => o.value === "sim")) return c.key;
  }
  throw new Error("O catálogo do formulário B não tem campo de escolha com Sim.");
}

function linhaDeMatriz(): { campo: string; linha: string } {
  for (const c of camposDoForm(RE_FORMS.d)) {
    if (c.tipo === "matriz" && c.opcoes.some((o) => o.value === "sim") && c.linhas.length > 0) return { campo: c.key, linha: c.linhas[0].key };
  }
  throw new Error("O catálogo do formulário D não tem matriz com Sim.");
}

describe("justificativa obrigatória no motor (REG-024)", () => {
  test("só Sim, Não e Às vezes exigem justificativa", () => {
    for (const r of ["sim", "nao", "as_vezes", ["sim"], ["nao", "outra"]]) assert.equal(respostaExigeJustificativa(r), true, JSON.stringify(r));
    for (const r of [null, undefined, "", "talvez", [], 3]) assert.equal(respostaExigeJustificativa(r), false, JSON.stringify(r));
  });

  test("campo de escolha: Sim e Não abrem a pendência; vazio não; texto válido fecha", () => {
    const k = campoEscolha();
    for (const resposta of ["sim", "nao"]) {
      const p = justificativasPendentes(RE_FORMS.b, { [k]: resposta });
      assert.equal(p.length, 1, resposta);
      assert.equal(p[0].campo, k);
    }
    assert.equal(justificativasPendentes(RE_FORMS.b, {}).length, 0, "sem resposta não exige");
    assert.equal(justificativasPendentes(RE_FORMS.b, { [k]: null }).length, 0, "null não exige");
    assert.equal(justificativasPendentes(RE_FORMS.b, { [k]: "sim", [`${k}__just`]: JUST_OK }).length, 0);
    assert.equal(justificativasPendentes(RE_FORMS.b, { [k]: "sim", [`${k}__just`]: JUST_CURTA }).length, 1, "texto curto ainda é pendência no envio");
  });

  test("linha de tabela: a pendência aponta a linha e fecha com texto válido", () => {
    const { campo, linha } = linhaDeMatriz();
    for (const r of ["sim", "nao", "as_vezes"]) {
      const sem = justificativasPendentes(RE_FORMS.d, { [campo]: { [linha]: { r } } });
      assert.equal(sem.length, 1, r);
      assert.equal(sem[0].campo, campo);
      assert.equal(sem[0].linha, linha);
      const com = justificativasPendentes(RE_FORMS.d, { [campo]: { [linha]: { r, just: JUST_OK } } });
      assert.equal(com.length, 0, r);
    }
  });

  test("a pendência vira lacuna bloqueante do formulário, com o rótulo da pergunta e sem eco do texto", () => {
    const k = campoEscolha();
    const lacunas = lacunasDeJustificativa(RE_FORMS.b, "b", { [k]: "sim", [`${k}__just`]: JUST_CURTA });
    assert.equal(lacunas.length, 1);
    assert.equal(lacunas[0].bloqueante, true);
    assert.equal(lacunas[0].passo, "b");
    assert.match(lacunas[0].rotulo, /justificativa/);
    assert.ok(!lacunas[0].rotulo.includes(JUST_CURTA), "o rótulo não repete o texto digitado");
  });

  test("rascunho: texto incompleto é aceito no campo de escolha", () => {
    const k = campoEscolha();
    assert.equal(validarPayloadReForm("b", { [k]: "sim", [`${k}__just`]: JUST_CURTA }), null);
    assert.equal(validarPayloadReForm("b", { [k]: "sim", [`${k}__just`]: "" }), null);
  });

  test("rascunho: lorem ipsum e texto acima de 150 são recusados no campo de escolha", () => {
    const k = campoEscolha();
    const lorem = validarPayloadReForm("b", { [k]: "sim", [`${k}__just`]: JUST_LOREM });
    assert.equal(typeof lorem, "string");
    const longo = validarPayloadReForm("b", { [k]: "sim", [`${k}__just`]: JUST_OK + " " + JUST_OK });
    assert.equal(typeof longo, "string");
  });

  test("rascunho: o mesmo vale para a linha de tabela", () => {
    const { campo, linha } = linhaDeMatriz();
    assert.equal(validarPayloadReForm("d", { [campo]: { [linha]: { r: "sim", just: JUST_CURTA } } }), null);
    assert.equal(typeof validarPayloadReForm("d", { [campo]: { [linha]: { r: "sim", just: JUST_LOREM } } }), "string");
  });

  test("justificativa em campo que não aceita é recusada", () => {
    const k = campoEscolha();
    const outro = camposDoForm(RE_FORMS.b).find((c) => c.tipo === "texto" || c.tipo === "texto_longo");
    if (!outro) return;
    assert.equal(typeof validarPayloadReForm("b", { [`${outro.key}__just`]: JUST_OK }), "string");
    assert.equal(validarPayloadReForm("b", { [k]: "sim" }), null);
  });
});
