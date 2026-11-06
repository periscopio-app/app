/**
 * Conformidade da psicomotricidade com o PDF `docs/Cap.PSICOMOT plataforma 1809.pdf` ([REG-011]).
 *
 * Em 05/nov/2026 a clínica notou que as tabelas "Resultado" apareciam sem a legenda 1 a 4 de cada prova
 * (ex.: Autoimagem). O profissional não tinha como saber o que significa marcar 1, 2, 3 ou 4.
 * Este teste exige a legenda abaixo de cada bloco: Tonicidade, Equilibração, Lateralidade, Noção do corpo,
 * Estruturação espaço-temporal, Praxia global e Praxia fina. Só se confere o que o formulário MOSTRA; nada é somado.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { camposDoForm, formDaEspecialidade, type CampoMatriz } from "@periscopio/shared";

const campo = (formId: string, key: string): CampoMatriz => {
  const f = formDaEspecialidade("psicomotricidade", formId);
  assert.ok(f, `form ${formId}`);
  const c = camposDoForm(f).find((x) => x.key === key);
  assert.ok(c && c.tipo === "matriz", `${formId}.${key} deveria ser uma tabela`);
  return c;
};
const grupos = (c: CampoMatriz) => (c.legenda?.itens ?? []).filter((i) => i.startsWith("## ")).map((i) => i.slice(3));
const itensNumerados = (c: CampoMatriz) => (c.legenda?.itens ?? []).filter((i) => /^[1-4]\. /.test(i));

describe("[REG-011] psicomotricidade: legenda 1 a 4 de cada prova (PDF)", () => {
  const casos: [string, string, number][] = [
    ["psm_habilidades_basicas", "tonicidade_extensibilidade", 3],
    ["psm_habilidades_basicas", "tonicidade_paratonia", 1],
    ["psm_habilidades_basicas", "tonicidade_diadococinesia", 1],
    ["psm_habilidades_basicas", "tonicidade_sincinesia", 1],
    ["psm_equilibrio_lateralidade", "equilibracao_imobilidade", 1],
    ["psm_equilibrio_lateralidade", "equilibracao_estatico", 1],
    ["psm_equilibrio_lateralidade", "equilibracao_dinamico", 1],
    ["psm_equilibrio_lateralidade", "equilibracao_trave", 3],
    ["psm_equilibrio_lateralidade", "lateralidade_nivel", 1],
    ["psm_equilibrio_lateralidade", "noco_corpo", 5],
    ["psm_espaco_praxias", "espaco_temporal", 4],
    ["psm_espaco_praxias", "praxia_global", 4],
    ["psm_espaco_praxias", "praxia_fina", 3],
  ];
  for (const [formId, key, nGrupos] of casos) {
    test(`${key}: ${nGrupos} grupo(s) com os níveis 1 a 4`, () => {
      const c = campo(formId, key);
      assert.ok(c.legenda, "sem legenda");
      assert.equal(grupos(c).length, nGrupos);
      assert.equal(itensNumerados(c).length, nGrupos * 4, "cada grupo precisa dos 4 níveis");
    });
  }

  test("Noção do corpo traz Autoimagem com os critérios do PDF (ponta do nariz)", () => {
    const c = campo("psm_equilibrio_lateralidade", "noco_corpo");
    assert.deepEqual(grupos(c), ["Desenho do corpo", "Sentido cinestésico", "Reconhecimento direita-esquerda", "Autoimagem", "Imitação de gestos"]);
    const texto = c.legenda!.itens.join("\n");
    assert.match(texto, /1\. Não acerta ou acerta uma vez na ponta do nariz/);
    assert.match(texto, /4\. Toca quatro vezes exatamente no ponta do nariz/);
    assert.match(texto, /4\. Reproduz com perfeição, precisão e acabamento/);
  });

  test("a legenda não vira cálculo: as opções continuam sendo só 1 a 4 marcados pelo profissional", () => {
    const c = campo("psm_equilibrio_lateralidade", "noco_corpo");
    assert.deepEqual(c.opcoes.map((o) => o.value), ["1", "2", "3", "4"]);
  });
});
