import test from "node:test";
import assert from "node:assert/strict";
import { hojeBrasilia, makeFogapPayloadVazio, sumarioComPadroes, validarPayloadFogap, SUMARIO_TEXTO_MAX } from "@periscopio/shared";

const agora = new Date("2026-10-13T15:00:00Z"); // 12h em Brasília

test("registros antigos ganham os campos do Formulário I vazios", () => {
  const s = sumarioComPadroes({ dificuldades_persistentes: ["Fala"], conduta: "nao", qual: "", tempo: "", resultado: "" });
  assert.equal(s.serie, "");
  assert.equal(s.queixa_professor, "");
  assert.equal(s.hipotese_espectro, "");
  assert.deepEqual(s.encaminhado, { nucleo: null, cras: null, conselho_tutelar: null, ubs: null, outro_nome: "", outro: null });
  assert.deepEqual(s.dificuldades_persistentes, ["Fala"]);
  assert.equal(makeFogapPayloadVazio().secao_sumario.serie, "");
});

test("data futura no encaminhamento é aceita (agendamento); formato inválido continua recusado", () => {
  assert.equal(hojeBrasilia(agora), "2026-10-13");
  const base = makeFogapPayloadVazio();
  const comData = (data: string | null) => ({ ...base, secao_encaminhamento: { observacoes: "", data } });
  assert.equal(validarPayloadFogap(comData("2026-10-13"), agora), null);
  assert.equal(validarPayloadFogap(comData("2026-10-01"), agora), null);
  assert.equal(validarPayloadFogap(comData("2026-10-14"), agora), null, "data futura é permitida");
  assert.equal(validarPayloadFogap(comData("2027-01-15"), agora), null);
  assert.match(validarPayloadFogap(comData("13/10/2026"), agora) ?? "", /inválida/);
  // 22h em Brasília já é o dia seguinte em UTC: o dia de Brasília continua valendo
  const noite = new Date("2026-10-14T01:30:00Z");
  assert.equal(validarPayloadFogap(comData("2026-10-13"), noite), null);
  assert.equal(validarPayloadFogap(comData("2026-10-14"), noite), null);
});

test("datas dos destinos do Formulário I podem ser futuras; formato e textos têm limite", () => {
  const base = makeFogapPayloadVazio();
  const s = (patch: object) => ({ ...base, secao_sumario: { ...base.secao_sumario, ...patch } });
  assert.equal(validarPayloadFogap(s({ encaminhado: { ...base.secao_sumario.encaminhado, cras: "2026-10-10" } }), agora), null);
  assert.equal(validarPayloadFogap(s({ encaminhado: { ...base.secao_sumario.encaminhado, ubs: "2026-12-01" } }), agora), null);
  assert.match(validarPayloadFogap(s({ encaminhado: { ...base.secao_sumario.encaminhado, ubs: "01/12/2026" } }), agora) ?? "", /inválida/);
  assert.match(validarPayloadFogap(s({ queixa_professor: "x".repeat(SUMARIO_TEXTO_MAX + 1) }), agora) ?? "", /longo demais/);
  assert.equal(validarPayloadFogap(s({ queixa_professor: "x".repeat(SUMARIO_TEXTO_MAX) }), agora), null);
});
