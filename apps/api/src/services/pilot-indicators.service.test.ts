import assert from "node:assert/strict";
import test from "node:test";
import {
  computeAcesso,
  computeCapacitacao,
  computeDesfecho,
  computeEstabilizacao,
  computeRastreio,
  guardCount,
  guardPercent,
  pairFor,
  studentCaseView,
  suppressBuckets,
  type CaseFact,
  type ClosingDecision,
  type MeasureFact,
} from "./pilot-indicators.service";
import { latestMeasures } from "./pilot-indicators.data";

const D = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

let seq = 0;
function mk(over: Partial<CaseFact> = {}): CaseFact {
  seq++;
  return {
    caseId: `c${seq}`,
    studentId: `s${seq}`,
    studentCode: `X-${seq}`,
    schoolId: "esc",
    ageBracket: "06-09",
    journeyState: "rascunho",
    createdAt: D("2026-03-01"),
    sentAt: null,
    firstEvaluationAt: null,
    closedAt: null,
    decision: null,
    followUp: null,
    measures: [],
    ...over,
  };
}
const many = (n: number, over: Partial<CaseFact> | (() => Partial<CaseFact>)) =>
  Array.from({ length: n }, () => mk(typeof over === "function" ? over() : over));
const sent = (over: Partial<CaseFact> = {}) => mk({ journeyState: "revisao_medica", sentAt: D("2026-03-10"), ...over });
const admitted = (over: Partial<CaseFact> = {}) =>
  sent({ journeyState: "delegado", firstEvaluationAt: D("2026-03-13"), ...over });
const closed = (decision: ClosingDecision, over: Partial<CaseFact> = {}) =>
  admitted({ journeyState: "encerrado", decision, closedAt: D("2026-06-01"), ...over });

test("guardCount: 1 a 4 viram oculto; zero e 5 ou mais aparecem", () => {
  assert.deepEqual(guardCount(0), { value: 0, suppressed: false });
  assert.deepEqual(guardCount(1), { value: null, suppressed: true });
  assert.deepEqual(guardCount(4), { value: null, suppressed: true });
  assert.deepEqual(guardCount(5), { value: 5, suppressed: false });
});

test("guardPercent: denominador pequeno, numerador pequeno ou complemento pequeno ocultam", () => {
  assert.equal(guardPercent(2, 4).suppressed, true);
  assert.equal(guardPercent(3, 40).suppressed, true);
  assert.equal(guardPercent(37, 40).suppressed, true, "complemento 3 revelaria o numerador");
  const ok = guardPercent(10, 40);
  assert.equal(ok.value, 25);
  assert.equal(ok.numerator, 10);
  assert.equal(guardPercent(0, 40).value, 0);
  assert.equal(guardPercent(40, 40).value, 100);
});

test("guardPercent: sem denominador válido não inventa percentual", () => {
  assert.equal(guardPercent(5, null).reason, "sem_denominador");
  assert.equal(guardPercent(5, 0).value, null);
});

test("suppressBuckets: se só uma categoria é ocultada, oculta também a menor visível", () => {
  const out = suppressBuckets({ a: 2, b: 9, c: 20 });
  assert.equal(out.a.suppressed, true);
  assert.equal(out.b.suppressed, true, "senão total − (b + c) revelaria a");
  assert.equal(out.c.value, 20);
  const two = suppressBuckets({ a: 2, b: 3, c: 20 });
  assert.equal(two.c.value, 20, "com duas ocultas não há subtração possível");
  assert.equal(suppressBuckets({ a: 0, b: 7 }).a.value, 0);
});

test("capacitação: conclui só quem terminou todos os cursos obrigatórios", () => {
  const educators = ["u1", "u2", "u3", "u4"].map((userId) => ({ userId, schoolId: "esc" }));
  const enr = [
    { userId: "u1", courseId: "A", progress: 100, completedAt: D("2026-04-01") },
    { userId: "u1", courseId: "B", progress: 100, completedAt: D("2026-04-02") },
    { userId: "u2", courseId: "A", progress: 100, completedAt: D("2026-04-01") },
    { userId: "u2", courseId: "B", progress: 40, completedAt: null },
    { userId: "u3", courseId: "Z", progress: 100, completedAt: D("2026-04-01") }, // curso que não é obrigatório
  ];
  const r = computeCapacitacao(educators, ["A", "B"], enr);
  assert.equal(r.concluiram, 1);
  assert.equal(r.emAndamento, 1);
  assert.equal(r.naoIniciaram, 2);
  assert.equal(r.percentual.value, 25);
});

test("capacitação: catálogo vazio não conta ninguém como capacitado", () => {
  const r = computeCapacitacao([{ userId: "u1", schoolId: "esc" }], [], []);
  assert.equal(r.catalogoVazio, true);
  assert.equal(r.concluiram, 0);
  assert.equal(r.percentual.value, 0);
});

test("rastreio: numerador é o FOGAP enviado, contando cada aluno uma vez", () => {
  const a = sent({ studentId: "dup" });
  const b = sent({ studentId: "dup" });
  const rest = [...many(9, () => ({ sentAt: D("2026-03-10"), journeyState: "revisao_medica" })), ...many(4, {})];
  const r = computeRastreio([a, b, ...rest], 200);
  assert.equal(r.fogapEnviado.value, 10);
  assert.equal(r.casosAbertos.value, 14);
  assert.equal(r.percentual.value, 5);
  assert.equal(computeRastreio([a], null).percentual.reason, "sem_denominador");
});

test("acesso: taxa, espera e mediana de dias só com 5 ou mais casos", () => {
  const cases = [...many(8, () => admitted()), ...many(7, () => sent())];
  const r = computeAcesso(cases);
  assert.equal(r.encaminhados.value, 15);
  assert.equal(r.acessaram.value, 8);
  assert.equal(r.aguardando.value, 7);
  assert.equal(r.percentual.value, 53.3);
  assert.equal(r.medianaDias, 3);
  const small = computeAcesso([...many(2, () => admitted()), ...many(10, () => sent())]);
  assert.equal(small.acessaram.suppressed, true);
  assert.equal(small.medianaDias, null);
  assert.equal(small.percentual.suppressed, true);
});

test("desfecho: taxas sobre quem acessou o núcleo; abandono e interrupção tiram da adesão", () => {
  const cases = [
    ...many(8, () => closed("alta")),
    ...many(5, () => closed("abandono")),
    ...many(5, () => closed("interrupcao_justificada")),
    ...many(6, () => admitted()),
    ...many(4, () => sent()), // ainda não acessaram: fora do denominador
  ];
  const r = computeDesfecho(cases);
  assert.equal(r.admitidos.value, 24);
  assert.equal(r.categorias.alta.value, 8);
  assert.equal(r.categorias.em_atendimento.value, 6);
  assert.equal(r.taxas.alta.value, 33.3);
  assert.equal(r.taxas.abandono.value, 20.8);
  assert.equal(r.taxas.adesao.value, 58.3);
});

test("desfecho: caso encerrado sem decisão legível conta como em atendimento, nunca como alta", () => {
  const weird = admitted({ journeyState: "encerrado", decision: null });
  const r = computeDesfecho([...many(9, () => admitted()), weird]);
  assert.equal(r.categorias.alta.value, 0);
  assert.equal(r.categorias.em_atendimento.value, 10);
});

function withMeasures(source: "escola" | "nucleo", ini: number, rea: number | null): Partial<CaseFact> {
  const measures: MeasureFact[] = [{ phase: "inicial", source, markedCount: ini, itemsTotal: 9, appliedOn: "2026-03-15" }];
  if (rea != null) measures.push({ phase: "reavaliacao", source, markedCount: rea, itemsTotal: 9, appliedOn: "2026-11-20" });
  return { measures };
}

test("estabilização: mostra variação bruta, sem dizer melhora ou piora", () => {
  const cases = [
    ...many(7, () => admitted(withMeasures("nucleo", 6, 3))),
    ...many(5, () => admitted(withMeasures("nucleo", 4, 4))),
    ...many(2, () => admitted(withMeasures("nucleo", 2, 5))),
    ...many(6, () => admitted(withMeasures("nucleo", 5, null))),
  ];
  const r = computeEstabilizacao(cases);
  assert.equal(r.admitidos.value, 20);
  assert.equal(r.nucleo.comMedidaInicial.value, 20);
  assert.equal(r.nucleo.comParCompleto.value, 14);
  assert.equal(r.nucleo.direcao.menos_itens.value, 7);
  assert.equal(r.nucleo.direcao.mais_itens.suppressed, true);
  assert.equal(r.nucleo.direcao.igual.suppressed, true, "ocultação complementar");
  assert.equal(r.nucleo.variacaoMedia, Number(((7 * -3 + 0 + 2 * 3) / 14).toFixed(1)));
  assert.equal(r.escola.comMedidaInicial.value, 0);
  const text = JSON.stringify(r).toLowerCase();
  for (const banned of ["melhora", "piora", "estabiliz", "remiss", "diagn"]) {
    assert.ok(!text.includes(banned), `a saída não deve conter "${banned}"`);
  }
});

test("pairFor: sem par completo não há variação", () => {
  const m = withMeasures("escola", 5, null).measures!;
  const p = pairFor(m, "escola");
  assert.equal(p.variacao, null);
  assert.equal(p.direcao, null);
  assert.equal(pairFor(m, "nucleo").inicial, null);
});

test("latestMeasures: vale a medida mais recente por fase e origem", () => {
  const rows = [
    { phase: "inicial", source: "nucleo", markedCount: 7, itemsTotal: 9, appliedOn: "2026-03-01", createdAt: new Date("2026-03-01T10:00:00Z") },
    { phase: "inicial", source: "nucleo", markedCount: 5, itemsTotal: 9, appliedOn: "2026-03-01", createdAt: new Date("2026-03-02T10:00:00Z") },
    { phase: "inicial", source: "escola", markedCount: 8, itemsTotal: 9, appliedOn: "2026-03-01", createdAt: new Date("2026-03-01T10:00:00Z") },
  ];
  const out = latestMeasures(rows);
  assert.equal(out.length, 2);
  assert.equal(out.find((m) => m.source === "nucleo")!.markedCount, 5);
});

test("visão do aluno: datas, dias até a avaliação e desfecho; sem nome nem documento", () => {
  const c = closed("acompanhamento", { followUp: "semestral", ...withMeasures("nucleo", 6, 4) });
  const v = studentCaseView(c);
  assert.equal(v.acesso.diasAteAvaliacao, 3);
  assert.equal(v.acesso.aguardando, false);
  assert.equal(v.desfecho.categoria, "acompanhamento");
  assert.equal(v.desfecho.acompanhamento, "semestral");
  assert.equal(v.estabilizacao.nucleo.variacao, -2);
  assert.equal(v.estabilizacao.nucleo.direcao, "menos_itens");
  const waiting = studentCaseView(sent());
  assert.equal(waiting.acesso.aguardando, true);
  assert.equal(waiting.desfecho.categoria, "em_atendimento");
});
