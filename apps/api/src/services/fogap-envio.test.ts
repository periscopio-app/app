import { test } from "node:test";
import assert from "node:assert/strict";
import { prontoParaRevisao, FOGAP_VERSION, type FogapPayload } from "@periscopio/shared";

const base = {
  fogap_version: FOGAP_VERSION,
  fogap_state: "rascunho",
  grupo: "G3",
  idade_anos: 7,
  idade_meses: 0,
  total_meses: 84,
  respostas_desenvolvimento: {},
  respostas_comportamentos: {},
  historico_insuficiente: { marcado: false, fonte: null, periodo_observado: null },
  secao_sumario: { dificuldades_persistentes: [], conduta: "nao", qual: "", tempo: "", resultado: "" },
  secao_encaminhamento: { observacoes: "", data: "2026-10-07" },
} as unknown as FogapPayload;

test("FOGAP com itens em branco pode ser enviado (avisos, sem bloqueio)", () => {
  const r = prontoParaRevisao(base);
  assert.equal(r.pronto, true);
  assert.deepEqual(r.pendencias, []);
  assert.ok(r.avisos.length > 0);
});

test("sem idade/grupo ou fora do piloto bloqueia o envio", () => {
  assert.equal(prontoParaRevisao({ ...base, grupo: null } as unknown as FogapPayload).pronto, false);
  assert.equal(prontoParaRevisao({ ...base, fogap_state: "faixa_fora_do_piloto" } as unknown as FogapPayload).pronto, false);
});
