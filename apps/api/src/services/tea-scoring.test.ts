import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ABC_TEA_ITEMS,
  ASQ_ITEMS,
  ATA_GROUPS,
  MCHAT_ITEMS,
  SRS2_ITEMS,
  TEA_INSTRUMENTS,
  scoreAbc,
  scoreAsq,
  scoreAta,
  scoreMchat,
  scoreSrs2,
  scoreTea,
  validateAnswers,
  withoutReference,
} from "@periscopio/shared";

describe("catálogo TEA bate com o formulário-fonte", () => {
  test("quantidade de itens", () => {
    assert.equal(ATA_GROUPS.length, 22);
    assert.equal(ATA_GROUPS.reduce((s, g) => s + g.options.length, 0), 112);
    assert.equal(ASQ_ITEMS.length, 40);
    assert.equal(MCHAT_ITEMS.length, 23);
    assert.equal(SRS2_ITEMS.length, 65);
    assert.equal(ABC_TEA_ITEMS.length, 57);
    for (const [code, meta] of Object.entries(TEA_INSTRUMENTS)) assert.ok(meta.itemCount > 0, code);
  });

  test("numeração contínua e sem texto vazio", () => {
    for (const list of [ASQ_ITEMS, MCHAT_ITEMS, SRS2_ITEMS, ABC_TEA_ITEMS] as { n: number; text: string }[][]) {
      list.forEach((it, i) => {
        assert.equal(it.n, i + 1);
        assert.ok(it.text.length > 8, `item ${it.n}`);
      });
    }
    ATA_GROUPS.forEach((g, i) => {
      assert.equal(g.n, i + 1);
      assert.ok(g.options.length >= 2 && g.options.every((o) => o.length > 3), `grupo ${g.n}`);
    });
  });

  test("ABC: pesos 1 a 4, soma dos itens = 160 (o quadro-resumo do formulário diz 159)", () => {
    assert.ok(ABC_TEA_ITEMS.every((i) => [1, 2, 3, 4].includes(i.weight)));
    assert.equal(ABC_TEA_ITEMS.reduce((s, i) => s + i.weight, 0), 160);
    const by = (d: string) => ABC_TEA_ITEMS.filter((i) => i.domain === d).reduce((s, i) => s + i.weight, 0);
    assert.deepEqual({ ES: by("ES"), RE: by("RE"), CO: by("CO"), LG: by("LG"), PS: by("PS") }, { ES: 30, RE: 43, CO: 33, LG: 30, PS: 24 });
  });

  test("ASQ: colunas de pontuação do formulário (Sim=0 nas perguntas 2, 3, 10 e 20 a 40)", () => {
    const simZero = ASQ_ITEMS.filter((i) => i.n !== 1 && i.sim === 0).map((i) => i.n);
    assert.deepEqual(simZero, [2, 3, 10, ...Array.from({ length: 21 }, (_, k) => 20 + k)]);
    assert.ok(ASQ_ITEMS.filter((i) => i.n !== 1).every((i) => i.sim !== i.nao), "cada pergunta pontua em exatamente uma resposta");
  });
});

describe("ATA", () => {
  test("0/1/2 por grupo, +1 se antes dos 36 meses", () => {
    const s = scoreAta({ marcados: { "1": [0], "2": [0, 1, 2], "3": [] }, antes36meses: true });
    assert.equal(s.total, 1 + 2 + 0 + 1);
    assert.equal(s.max, 45);
    assert.equal(s.parts.find((p) => p.key === "g2")!.points, 2);
  });
  test("vazio = 0; todos os grupos com 2+ marcas e início precoce = 45", () => {
    assert.equal(scoreAta({ marcados: {}, antes36meses: null }).total, 0);
    const marcados = Object.fromEntries(ATA_GROUPS.map((g) => [String(g.n), [0, 1]]));
    assert.equal(scoreAta({ marcados, antes36meses: true }).total, 45);
  });
  test("faixa de referência existe no cálculo mas sai quando a pessoa não tem a capacidade", () => {
    const s = scoreAta({ marcados: {}, antes36meses: null });
    assert.ok(s.reference);
    assert.equal(withoutReference(s).reference, undefined);
  });
  test("validação recusa grupo/posição inexistente ou repetida", () => {
    assert.match(validateAnswers("ata", { marcados: { "99": [0] }, antes36meses: null })!, /desconhecido/);
    assert.match(validateAnswers("ata", { marcados: { "1": [99] }, antes36meses: null })!, /inválido/);
    assert.match(validateAnswers("ata", { marcados: { "1": [0, 0] }, antes36meses: null })!, /repetido/);
    assert.equal(validateAnswers("ata", { marcados: { "1": [0, 1] }, antes36meses: false }), null);
  });
});

describe("ASQ", () => {
  const all = (v: "sim" | "nao") => Object.fromEntries(ASQ_ITEMS.map((i) => [String(i.n), v]));
  test("verbal: todas Sim = 15 (nº de perguntas em que Sim pontua); todas Não = 24", () => {
    assert.equal(scoreAsq({ items: all("sim") }).total, 15);
    // com a pergunta 1 = Sim e as demais = Não: 39 perguntas aplicáveis menos as 15 que pontuam no Sim
    assert.equal(scoreAsq({ items: { ...all("nao"), "1": "sim" } }).total, 24);
  });
  test("máximo e completude seguem a resposta da pergunta 1", () => {
    const verbal = scoreAsq({ items: all("sim") });
    assert.equal(verbal.max, 39);
    assert.ok(verbal.complete);
    const nonverbal = scoreAsq({ items: { ...all("sim"), "1": "nao" } });
    assert.equal(nonverbal.max, 32);
    assert.ok(nonverbal.complete);
    assert.equal(nonverbal.verbal, false);
    assert.equal(scoreAsq({ items: { "1": "sim" } }).complete, false);
  });
  test("sem fala: perguntas 2 a 8 não contam mesmo se respondidas", () => {
    const withLang = scoreAsq({ items: { ...all("sim"), "1": "nao" } });
    const base = scoreAsq({ items: all("sim") });
    // as perguntas 2 e 3 (Sim=0) e 4 a 8 (Sim=1): ao sair, perdem-se 5 pontos
    assert.equal(base.total! - withLang.total!, 5);
  });
  test("validação", () => {
    assert.match(validateAnswers("asq", { items: { "41": "sim" } })!, /desconhecido/);
    assert.match(validateAnswers("asq", { items: { "2": "talvez" } })!, /Sim ou Não/);
  });
});

describe("M-CHAT e SRS-2 (somente registro)", () => {
  test("M-CHAT não devolve pontuação de risco, só contagem neutra", () => {
    const s = scoreMchat({ items: { "1": "sim", "2": "nao", "3": "nao" } });
    assert.equal(s.computed, false);
    assert.equal(s.total, null);
    assert.deepEqual(s.counts, { sim: 1, nao: 2 });
    assert.equal(s.complete, false);
  });
  test("SRS-2 não soma pontos (itens invertidos desconhecidos) e valida a escala 1 a 4", () => {
    const items = Object.fromEntries(SRS2_ITEMS.map((i) => [String(i.n), 3 as const]));
    const s = scoreSrs2({ items });
    assert.equal(s.total, null);
    assert.ok(s.complete);
    assert.match(validateAnswers("srs2", { items: { "1": 5 } })!, /1, 2, 3 ou 4/);
  });
});

describe("ABC", () => {
  test("soma pesos marcados, total e por área", () => {
    const first = ABC_TEA_ITEMS[0]; // item 1: gira em torno de si — CO, peso 4
    const s = scoreAbc({ items: { "1": true, "2": false } });
    assert.equal(s.total, first.weight);
    assert.equal(s.parts.find((p) => p.key === first.domain)!.points, first.weight);
    assert.equal(s.max, 160);
  });
  test("tudo marcado = 160; nada marcado = 0", () => {
    assert.equal(scoreAbc({ items: Object.fromEntries(ABC_TEA_ITEMS.map((i) => [String(i.n), true])) }).total, 160);
    assert.equal(scoreAbc({ items: {} }).total, 0);
  });
  test("o resultado nunca traz rótulo de classificação", () => {
    const s = scoreAbc({ items: { "1": true } });
    assert.doesNotMatch(JSON.stringify(s.notes), /alta probabilidade|moderada|diagn[oó]stico confirmado/i);
    assert.equal(s.reference?.reached, undefined, "sem 'atingiu corte' para o ABC");
  });
  test("scoreTea valida antes de pontuar", () => {
    assert.throws(() => scoreTea("abc", { items: { "1": "sim" } }));
    assert.equal(scoreTea("abc", { items: { "1": true } }).total, ABC_TEA_ITEMS[0].weight);
  });
});
