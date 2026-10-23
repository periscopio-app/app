import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FAIXAS_FOGAP,
  FOGAP_VERSION,
  G2_ITENS_4A5,
  G3_ITENS,
  faixaEmUso,
  faixaPadraoPorMeses,
  getItensGrupo,
  itensDaFaixa,
  prontoParaRevisao,
  rotearPorIdade,
  validarPayloadFogap,
  type FogapPayload,
} from "@periscopio/shared";

test("faixa 4 a 5 anos tem 20 itens (75 a 94) e a de 6 a 9 tem 15 (95 a 109), sem repetir id", () => {
  assert.equal(G2_ITENS_4A5.length, 20);
  assert.equal(G2_ITENS_4A5[0].n, 75);
  assert.equal(G2_ITENS_4A5[19].n, 94);
  assert.equal(G2_ITENS_4A5[0].id, "FOGAP-D-075");
  assert.ok(G2_ITENS_4A5.every((i) => i.bloco_idade === "4 a 5 anos"));
  assert.equal(G3_ITENS.length, 15);
  const ids = [...G2_ITENS_4A5, ...G3_ITENS].map((i) => i.id);
  assert.equal(new Set(ids).size, 35);
  assert.deepEqual(FAIXAS_FOGAP.map((f) => f.id), ["4a5", "6a9"]);
});

test("textos de itens sensíveis a aspas e fonemas ficam como na fonte", () => {
  assert.equal(G2_ITENS_4A5.find((i) => i.n === 87)?.texto, "Entende palavras como “primeiro”, “próximo”, “último”, “hoje”, “ontem”, “amanhã”");
  assert.match(G2_ITENS_4A5.find((i) => i.n === 85)!.texto, /até os 5 anos, \/pl\/, \/pr\/, com omissões e trocas$/);
});

test("roteamento: 4a0m a 5a11m entram (G2); 3 anos e menos ficam fora; 6 a 9 seguem em G3", () => {
  assert.deepEqual(rotearPorIdade(4, 0), { estado: "rascunho", grupo: "G2", total_meses: 48 });
  assert.deepEqual(rotearPorIdade(5, 11), { estado: "rascunho", grupo: "G2", total_meses: 71 });
  assert.equal(rotearPorIdade(3, 11).estado, "faixa_fora_do_piloto");
  assert.equal(rotearPorIdade(6, 0).estado, "rascunho");
  assert.equal(rotearPorIdade(9, 11).estado, "rascunho");
  assert.equal(rotearPorIdade(10, 0).estado, "fora_da_faixa");
  assert.equal(rotearPorIdade(0, 3).estado, "faixa_fora_do_piloto");
});

test("faixa padrão pela idade e escolha manual da RE", () => {
  assert.equal(faixaPadraoPorMeses(47), null);
  assert.equal(faixaPadraoPorMeses(48), "4a5");
  assert.equal(faixaPadraoPorMeses(71), "4a5");
  assert.equal(faixaPadraoPorMeses(72), "6a9");
  assert.equal(faixaPadraoPorMeses(119), "6a9");
  assert.equal(faixaPadraoPorMeses(120), null);
  assert.equal(faixaEmUso({ faixa_fogap: "4a5", total_meses: 90 }), "4a5", "RE escolhe a outra faixa");
  assert.equal(faixaEmUso({ faixa_fogap: null, total_meses: 90 }), "6a9");
  assert.equal(faixaEmUso({ faixa_fogap: "xx", total_meses: 60 }), "4a5", "valor estranho é ignorado");
  assert.equal(getItensGrupo("G2").length, 20);
  assert.equal(itensDaFaixa("6a9").length, 15);
});

const base = {
  fogap_version: FOGAP_VERSION,
  fogap_state: "rascunho",
  grupo: "G2",
  faixa_fogap: "4a5",
  idade_anos: 5,
  idade_meses: 0,
  total_meses: 60,
  respostas_desenvolvimento: { "FOGAP-D-075": "adequada" },
  respostas_comportamentos: {},
  historico_insuficiente: { marcado: false, fonte: null, periodo_observado: null },
  secao_sumario: { dificuldades_persistentes: [], conduta: "nao", qual: "", tempo: "", resultado: "" },
  secao_encaminhamento: { observacoes: "", data: null },
} as unknown as FogapPayload;

test("envio conta em branco só dos itens da faixa em uso (19 em branco de 20)", () => {
  const r = prontoParaRevisao(base);
  assert.equal(r.pronto, true);
  assert.ok(r.avisos.some((a) => a.startsWith("19 item(s) de desenvolvimento em branco")), r.avisos.join("|"));
  const outra = prontoParaRevisao({ ...base, faixa_fogap: "6a9" } as unknown as FogapPayload);
  assert.ok(outra.avisos.some((a) => a.startsWith("15 item(s)")), "faixa 6 a 9 tem 15 itens, todos em branco");
});

test("validação recusa faixa fora de 4a5 e 6a9", () => {
  assert.equal(validarPayloadFogap(base), null);
  assert.match(validarPayloadFogap({ ...base, faixa_fogap: "3a4" }) ?? "", /Faixa do FOGAP inválida/);
});
