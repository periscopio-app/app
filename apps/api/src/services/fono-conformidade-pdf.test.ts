/**
 * Conformidade do formulário da fonoaudiologia com o PDF `docs/Cap FONO plataforma 1809.pdf` ([REG-007]).
 *
 * Em 05/nov/2026 a clínica apontou 10 telas que não seguiam o PDF (relatório qa/specs/2026-11-05-fono-pdf-e-producao.md).
 * Causa: cada tabela do PDF tinha sido reduzida a "uma classificação + um número + observação". Este teste guarda as
 * colunas, rótulos, faixas e opções impressos no PDF. Se alguém simplificar uma tabela de novo, a CI quebra.
 * O sistema continua sem calcular nem interpretar: aqui só se confere o que o formulário MOSTRA.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  camposDoForm,
  ehFormularioDeSumario,
  formDaEspecialidade,
  formsDaEspecialidade,
  idsDeSumarioDaEspecialidade,
  normalizarPayloadDef,
  numerosDoCampo,
  progressoDef,
  textoDosNumeros,
  validarPayloadDef,
  type CampoMatriz,
  type CampoUnica,
  type CampoMultipla,
} from "@periscopio/shared";

const form = (id: string) => formDaEspecialidade("fonoaudiologia", id)!;
const matriz = (formId: string, key: string): CampoMatriz => {
  const c = camposDoForm(form(formId)).find((x) => x.key === key);
  assert.ok(c && c.tipo === "matriz", `${formId}.${key} deveria ser uma tabela`);
  return c as CampoMatriz;
};
const unica = (formId: string, key: string): CampoUnica => camposDoForm(form(formId)).find((x) => x.key === key) as CampoUnica;
const rotulos = (opcoes: { label: string }[]) => opcoes.map((o) => o.label);
const chavesNumeros = (c: CampoMatriz) => numerosDoCampo(c).map((n) => n.key);
const rotulosNumeros = (c: CampoMatriz) => numerosDoCampo(c).map((n) => n.label);

const PADRAO_PDF = [
  "Pontuação-padrão < 70 – muito baixa",
  "Pontuação-padrão entre 70 e 84 – baixa",
  "Pontuação-padrão entre 85 e 114 – média",
  "Pontuação-padrão entre 115 e 129 – alta",
  "Pontuação-padrão > ou + 130 – muito alta",
];
const SEIS_CLASSES = ["Superior", "Médio superior", "Médio", "Médio inferior", "Alerta para déficit", "Déficit"];

describe("[REG-007] fonoaudiologia conforme o PDF — linguagem oral", () => {
  test("F1 TNI: pontuação bruta /60, pontuação-padrão com as faixas do PDF e as 6 marcações", () => {
    const f = camposDoForm(form("fono_linguagem_oral"));
    assert.match(f.find((c) => c.key === "tin_bruta")!.label, /\/60/);
    const classe = unica("fono_linguagem_oral", "tin_classe");
    assert.equal(classe.label, "Pontuação-padrão de acordo com idade");
    assert.deepEqual(rotulos(classe.opcoes), PADRAO_PDF);
    const erros = f.find((c) => c.key === "tin_erros") as CampoMultipla;
    assert.equal(erros.opcoes.length, 6);
    assert.equal(erros.opcoes[0].label, "Fala sobre a figura, mas dá o nome errado");
    assert.ok(rotulos(erros.opcoes).includes("Beneficia-se de pista fonológica"));
    assert.equal((erros as { comObs?: boolean }).comObs, false, "o PDF não tem observação nessas marcações");
  });

  test("F2 FV: nº de palavras, percentil, repetições, intrusões e clusters + as 6 classes, sem observação", () => {
    const fv = matriz("fono_linguagem_oral", "fv");
    assert.deepEqual(rotulosNumeros(fv), ["Nº de palavras", "Percentil", "Repetições", "Intrusões", "Clusters"]);
    assert.deepEqual(rotulos(fv.opcoes), SEIS_CLASSES);
    assert.deepEqual(fv.linhas.map((l) => l.label), ["Evocação lexical livre", "Palavras começando com /p/", "Palavras referentes a roupas/vestimentas"]);
    assert.equal(fv.comObs, false, "o PDF não tem observação nesta tabela");
  });

  test("F3 TRPP: pontuação bruta antes, com /10, /10 e /20, e as 5 faixas de pontuação-padrão", () => {
    const t = matriz("fono_linguagem_oral", "trpp");
    assert.equal(t.numerosAntes, true);
    assert.deepEqual(t.sufixosPorLinha, { palavras: { n: "/10" }, pseudopalavras: { n: "/10" }, total: { n: "/20" } });
    assert.deepEqual(rotulos(t.opcoes), PADRAO_PDF);
  });

  test("F4 TDF e total do TCFPO: bruta /23 e pontuação-padrão com as faixas", () => {
    assert.match(camposDoForm(form("fono_linguagem_oral")).find((c) => c.key === "tdf_bruta")!.label, /\/23/);
    assert.deepEqual(rotulos(unica("fono_linguagem_oral", "tdf_classe").opcoes), PADRAO_PDF);
    assert.deepEqual(rotulos(unica("fono_linguagem_oral", "tcfpo_classe").opcoes), PADRAO_PDF);
  });

  test("F8 ADL e DNO: escore bruto/padrão e pontuação/percentil como no PDF", () => {
    assert.deepEqual(rotulosNumeros(matriz("fono_linguagem_oral", "adl")), ["Escore bruto", "Escore padrão"]);
    assert.deepEqual(rotulosNumeros(matriz("fono_linguagem_oral", "dno")), ["Pontuação", "Percentil"]);
  });

  test("F5/F9 síntese da linguagem oral: só Sim/Não, com Aplicação e Áreas avaliadas em cada instrumento", () => {
    const s = matriz("fono_linguagem_oral", "sintese_instrumentos");
    assert.deepEqual(rotulos(s.opcoes), ["Sim", "Não"], "'Não avaliado' só existe na síntese completa do PDF");
    assert.equal(s.linhas.length, 8);
    for (const l of s.linhas) assert.deepEqual(l.info?.map((i) => i.rotulo), ["Aplicação", "Áreas avaliadas"], l.label);
    assert.equal(s.linhas[0].info![0].texto, "Para crianças que não respondem a testes formais, 12 a 48 meses");
    assert.equal(s.linhas[3].info![0].texto, "3 a 14 anos");
  });

  test("F5 rascunho antigo com 'Não avaliado' continua salvando e a resposta vira branco", () => {
    const f = form("fono_linguagem_oral");
    const antigo = { sintese_instrumentos: { proc: { r: "nao_avaliado" }, adl: { r: "sim" } } };
    assert.equal(validarPayloadDef(f, antigo), null);
    const n = normalizarPayloadDef(f, antigo) as any;
    assert.equal(n.sintese_instrumentos.proc.r, null);
    assert.equal(n.sintese_instrumentos.adl.r, "sim");
  });
});

describe("[REG-007] fonoaudiologia conforme o PDF — linguagem escrita e fala", () => {
  test("F7 TDE II: resultados + percentis, classificação 1 a 9 e a legenda do PDF (literal)", () => {
    const t = matriz("fono_linguagem_escrita", "tde");
    assert.deepEqual(rotulosNumeros(t), ["Resultados", "Percentis"]);
    assert.deepEqual(rotulos(t.opcoes), ["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    assert.equal(t.legenda?.titulo, "Legenda: classificação");
    assert.equal(t.legenda?.itens.length, 9);
    assert.equal(t.legenda?.itens[3], "4. Entre 10 e 25 – alerta para déficit (abaixo do esperado)");
    assert.equal(t.legenda?.itens[8], "9. 95 a 99 – muito acima do esperado");
  });

  test("F8 DNE: tempo em segundos e percentil; pontuação e percentil; sem observação", () => {
    const fl = matriz("fono_linguagem_escrita", "dne_fluencia");
    assert.deepEqual(rotulosNumeros(fl), ["Tempo em segundos", "Percentil"]);
    assert.deepEqual(fl.linhas.map((l) => l.label), ["Tempo de leitura", "Velocidade"]);
    const r = matriz("fono_linguagem_escrita", "dne");
    assert.deepEqual(rotulosNumeros(r), ["Pontuação", "Percentil"]);
    assert.deepEqual(rotulos(r.opcoes), SEIS_CLASSES);
    assert.equal(fl.comObs || r.comObs, false);
  });

  test("F9 sínteses da escrita e da fala têm a coluna Aplicação e Sim/Não", () => {
    for (const [formId, n] of [["fono_linguagem_escrita", 6], ["fono_fala", 4]] as const) {
      const s = matriz(formId, "sintese_instrumentos");
      assert.equal(s.linhas.length, n, formId);
      assert.deepEqual(rotulos(s.opcoes), ["Sim", "Não"], formId);
      for (const l of s.linhas) assert.deepEqual(l.info?.map((i) => i.rotulo), ["Aplicação", "Áreas avaliadas"], `${formId} ${l.label}`);
    }
    assert.equal(matriz("fono_linguagem_escrita", "sintese_instrumentos").linhas[5].info![0].texto, "Idade Escolar");
    assert.equal(matriz("fono_fala", "sintese_instrumentos").linhas[2].info![0].texto, "Infantil a Adulto");
  });
});

describe("[REG-007] fonoaudiologia conforme o PDF — anamnese e sumário", () => {
  test("F10 anamnese: sem 'Conclusão da anamnese' e sem 'Observações'; dados antigos não bloqueiam", () => {
    const f = form("fono_anamnese");
    const chaves = camposDoForm(f).map((c) => c.key);
    assert.ok(!chaves.includes("conclusao"));
    assert.ok(!chaves.includes("observacoes"));
    assert.deepEqual(f.secoes.map((s) => s.id), ["audicao", "alimentacao", "linguagem_oral", "comunicacao", "escolaridade", "linguagem_escrita", "tratamentos", "familia"]);
    const antigo = { conclusao: "texto antigo", observacoes: "outro texto", observacoes__obs: "x" };
    assert.equal(validarPayloadDef(f, antigo), null);
    assert.deepEqual(normalizarPayloadDef(f, antigo), {});
  });

  test("F6 o sumário que vai ao médico é o item 4 (plano terapêutico), não a síntese 2.9", () => {
    assert.deepEqual(idsDeSumarioDaEspecialidade("fonoaudiologia"), ["fono_plano_terapeutico"]);
    assert.equal(ehFormularioDeSumario("fonoaudiologia", "fono_plano_terapeutico"), true);
    assert.equal(ehFormularioDeSumario("fonoaudiologia", "fono_sintese"), false);
    assert.equal(form("fono_plano_terapeutico").letra, "4");
  });
});

describe("[REG-007] fonoaudiologia conforme o PDF — Conduta como item próprio (após o 3)", () => {
  test("a Conduta é um formulário próprio, logo antes do plano terapêutico (4); o SRS-2 saiu da fono em 06/nov/2026", () => {
    const ids = formsDaEspecialidade("fonoaudiologia").map((f) => f.id);
    assert.deepEqual(ids.slice(-2), ["fono_conduta", "fono_plano_terapeutico"]);
    assert.ok(!ids.includes("fono_srs2"), "decisão do PM: SRS-2 só na neuropsicologia");
    assert.equal(form("fono_conduta").letra, "3.1");
  });

  test("as 4 áreas do PDF, com o texto literal, e Conclusão/Conduta ao final", () => {
    const campos = camposDoForm(form("fono_conduta"));
    assert.deepEqual(campos.map((c) => c.key), ["conduta_audicao", "conduta_linguagem_oral", "conduta_linguagem_escrita", "conduta_fala", "conclusao", "conduta"]);
    const aud = campos[0] as CampoMultipla;
    assert.equal(aud.opcoes.length, 2);
    assert.match(aud.opcoes[1].label, /avaliação formal do Processamento auditivo central$/);
    const oral = campos[1] as CampoMultipla;
    assert.equal(oral.ajuda, "Estimulação cognitivo-linguística");
    assert.equal(oral.opcoes.length, 5);
    assert.equal(oral.opcoes[4].label, "Pragmática (inferências, organização discursiva, uso da linguagem).");
    assert.equal((campos[2] as CampoMultipla).opcoes.length, 5);
    assert.equal((campos[3] as CampoMultipla).opcoes.length, 4);
    for (const c of campos.slice(0, 4)) assert.equal((c as { comObs?: boolean }).comObs, false, c.key);
  });

  test("a síntese 2.9 não carrega mais a conduta; dados antigos dela não bloqueiam o salvamento", () => {
    const sint = form("fono_sintese");
    const chaves = camposDoForm(sint).map((c) => c.key);
    for (const k of ["conduta_audicao", "conduta_linguagem_oral", "conduta_linguagem_escrita", "conduta_fala", "conclusao", "conduta"]) assert.ok(!chaves.includes(k), k);
    const antigo = { conduta_audicao: ["encaminhar_orl"], conclusao: "x", conduta: "y" };
    assert.equal(validarPayloadDef(sint, antigo), null);
    assert.deepEqual(normalizarPayloadDef(sint, antigo), {});
  });

  test("não é sumário: só o plano terapêutico (item 4) vai ao médico", () => {
    assert.equal(ehFormularioDeSumario("fonoaudiologia", "fono_conduta"), false);
  });
});

describe("motor de formulários: vários números por linha", () => {
  const fv = () => matriz("fono_linguagem_oral", "fv");
  const f = () => form("fono_linguagem_oral");

  test("o número antigo (n) e os novos (nums) são aceitos e mostrados com o rótulo", () => {
    const celula = { r: "medio", n: 12, nums: { percentil: 40, repeticoes: 1, intrusoes: 0, clusters: 2 } };
    assert.equal(validarPayloadDef(f(), { fv: { livre: celula } }), null);
    assert.equal(textoDosNumeros(fv(), celula), "Nº de palavras: 12 · Percentil: 40 · Repetições: 1 · Intrusões: 0 · Clusters: 2");
  });

  test("dados salvos antes (resposta + n + observação) continuam válidos", () => {
    assert.equal(validarPayloadDef(f(), { fv: { livre: { r: "medio", n: 12, obs: "percentil 40, 1 repetição" } } }), null);
  });

  test("número não previsto, valor inválido ou fora do limite são recusados", () => {
    assert.match(validarPayloadDef(f(), { fv: { livre: { nums: { inventado: 1 } } } }) ?? "", /não previsto/);
    assert.match(validarPayloadDef(f(), { fv: { livre: { nums: { percentil: "40" } } } }) ?? "", /inválido/);
    assert.match(validarPayloadDef(f(), { fv: { livre: { nums: { percentil: -1 } } } }) ?? "", /inválido/);
    assert.match(validarPayloadDef(f(), { fv: { livre: { nums: { percentil: 5000 } } } }) ?? "", /inválido/);
  });

  test("uma linha só com percentil já conta como respondida (em branco continua em branco)", () => {
    const vazio = progressoDef(f(), {});
    const comPercentil = progressoDef(f(), { fv: { livre: { nums: { percentil: 40 } } } });
    assert.equal(comPercentil.respondidos, vazio.respondidos + 1);
    assert.equal(comPercentil.total, vazio.total);
  });
});
