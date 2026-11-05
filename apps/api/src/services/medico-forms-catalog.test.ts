import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { MD_FORMS, MD_FORM_IDS, normalizarPayloadMedico, medicoTemConteudo, respostaMedicoLegivel, sumarioMedicoComoTexto } from "@periscopio/shared";

describe("formulários do médico: reproduzem o capítulo em papel", () => {
  test("cada seção B a R tem campos do papel; nenhum campo provisório 'registro'", () => {
    for (const id of MD_FORM_IDS) {
      const f = MD_FORMS[id];
      assert.ok(f.campos.length > 0, id);
      assert.ok(!f.campos.some((c) => c.id === "registro"), `${id} ainda tem o campo provisório`);
      const ids = f.campos.map((c) => c.id);
      assert.equal(new Set(ids).size, ids.length, `${id}: ids de campo repetidos`);
      for (const c of f.campos) if (c.tipo === "escolha" || c.tipo === "multi" || c.tipo === "simnao") assert.ok((c.opcoes?.length ?? 0) >= 1, `${id}.${c.id}`);
    }
  });

  test("estruturas-chave do papel", () => {
    assert.equal(MD_FORMS.queixa_escola.campos[0].opcoes?.length, 12, "B: 0 a 11");
    assert.equal(MD_FORMS.avaliacao_psiquiatrica.campos.filter((c) => c.tipo === "escolha").length, 12, "D: 12 itens Normal/Alterada");
    assert.equal(MD_FORMS.outras_queixas.campos.filter((c) => c.tipo === "escolha").length, 10, "E: 10 sistemas");
    assert.equal(MD_FORMS.genograma.campos.find((c) => c.id === "legenda_mae")?.opcoes?.length, 32, "G: legenda 1 a 32");
    assert.equal(MD_FORMS.hipotese_diagnostica.campos.length, 2, "I: um campo CID-10 e um CID-11");
    assert.deepEqual(MD_FORMS.hipotese_diagnostica.campos.map((c) => c.id), ["cid10", "cid11"]);
    assert.equal(MD_FORMS.encaminhamentos.campos.length, 7, "K: 7 encaminhamentos");
    assert.equal(MD_FORMS.sumario_medico.campos.find((c) => c.id === "conduta")?.opcoes?.length, 10, "Q: itens 5 a 14");
    assert.equal(MD_FORMS.recomendacao_escola.campos.find((c) => c.id === "recomendacoes")?.opcoes?.length, 4, "R: itens 15 a 18");
  });

  test("normalização por tipo: escolha, múltipla, número e texto", () => {
    const p = normalizarPayloadMedico("exame_fisico", { estatura: "132,5", peso: "abc", facies: "talvez", estado_nutricional: "eutrofia", pa_max: 120 });
    assert.equal(p.estatura, "132,5");
    assert.equal(p.peso, "");
    assert.equal(p.facies, "");
    assert.equal(p.estado_nutricional, "eutrofia");
    assert.equal(p.pa_max, "120");
    const q = normalizarPayloadMedico("queixa_escola", { queixas: "5,2,99", outra_queixa: "x" });
    assert.equal(q.queixas, "2,5", "só opções válidas, na ordem do papel");
    assert.equal(normalizarPayloadMedico("queixa_escola", { queixas: "0,3" }).queixas, "0", "'0. nenhuma' exclui as demais");
  });

  test("hipótese diagnóstica agrupa campos CID legados sem sobrescrever o campo atual", () => {
    const p = normalizarPayloadMedico("hipotese_diagnostica", {
      cid10_1: " A10 ", cid10_2: "", cid10_3: "B20", cid11_1: "11A", cid11_6: "11F",
    });
    assert.deepEqual(p, { cid10: "A10; B20", cid11: "11A; 11F" });
    const atual = normalizarPayloadMedico("hipotese_diagnostica", { cid10: "Manual", cid10_1: "Legado", cid11_1: "11A" });
    assert.equal(atual.cid10, "Manual");
    assert.equal(atual.cid11, "11A");
  });

  test("não há escore: nenhum campo calcula, soma ou classifica; Σ FR é digitado", () => {
    const fr = MD_FORMS.genograma.campos.filter((c) => c.id.startsWith("fr_"));
    assert.equal(fr.length, 3);
    assert.ok(fr.every((c) => c.tipo === "numero"));
    assert.equal(medicoTemConteudo(normalizarPayloadMedico("genograma", {})), false);
  });

  test("sumário executivo para o especialista: texto legível, aceita o formato antigo", () => {
    const t = sumarioMedicoComoTexto({ queixa_professor: "observa-se X", conduta: "6,10" });
    assert.ok(t.includes("1. Queixa do professor: observa-se X"));
    assert.ok(t.includes("6. sim, está sob farmacoterapia"));
    assert.ok(t.includes("10. Fez avaliação fonoaudiológica"));
    assert.equal(sumarioMedicoComoTexto({ registro: "texto antigo" }), "texto antigo");
    assert.equal(sumarioMedicoComoTexto({}), "");
  });
});

describe("[REG-004] Conduta do sumário do médico: cada item é Sim (1) ou Não (0), escolhido pelo médico", () => {
  const campo = MD_FORMS.sumario_medico.campos.find((c) => c.id === "conduta")!;

  test("o campo é do tipo simnao e guarda 1 e 0 por item, na ordem do formulário", () => {
    assert.equal(campo.tipo, "simnao");
    const out = normalizarPayloadMedico("sumario_medico", { conduta: "9=0,5=1,7=1,999=1,8=talvez" });
    assert.equal(out.conduta, "5=1,7=1,9=0", "valor inexistente e resposta inválida são descartados");
  });

  test("Não é resposta de verdade (0) e é diferente de em branco", () => {
    assert.equal(normalizarPayloadMedico("sumario_medico", { conduta: "7=0" }).conduta, "7=0");
    assert.equal(normalizarPayloadMedico("sumario_medico", { conduta: "" }).conduta, "");
  });

  test("dados antigos (lista de caixas marcadas) continuam valendo como Sim", () => {
    assert.equal(normalizarPayloadMedico("sumario_medico", { conduta: "8,6,999" }).conduta, "6=1,8=1");
  });

  test("o texto para leitura mostra Sim ou Não de cada item respondido e omite o que está em branco", () => {
    assert.equal(
      respostaMedicoLegivel(campo, "5=1,9=0"),
      "5. não está sob farmacoterapia: Sim; 9. Fez avaliação motora: Não",
    );
  });
});
