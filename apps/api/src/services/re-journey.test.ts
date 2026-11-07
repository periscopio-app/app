import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  RE_FORMS,
  RE_PASSOS,
  camposDoForm,
  lacunasDoForm,
  lacunasDoSumario,
  ataTemRespostas,
  metaComPadroes,
  metaVazia,
  normalizarPayloadReForm,
  progressoReForm,
  situacaoDaJornada,
  montarEscalasSumario,
  validarPayloadReForm,
  type JornadaEntradas,
} from "@periscopio/shared";
import { idadeAPartirDoNascimento } from "../routes/re-journey.routes";
import { montarPayloadFogap } from "./re-journey.service";

const entrada = (patch: Partial<JornadaEntradas> = {}): JornadaEntradas => ({
  meta: metaVazia(),
  payloads: {},
  ata: { existe: false, enviada: false },
  serieDoAluno: "3º ano",
  ...patch,
});

const JUST_OK = "Foi observado em sala que o aluno evita atividades de leitura em voz alta e pede ajuda ao colega com frequência durante a aula.";

describe("jornada do RE — catálogo A–F", () => {
  test("a ordem de apresentação é ATA primeiro: H A B C D E F G I (R7); ids e letras não mudam", () => {
    assert.deepEqual(RE_PASSOS.map((p) => p.letra).join(""), "HABCDEFGI");
    assert.deepEqual(RE_PASSOS.map((p) => p.id).join(""), "habcdefgi");
    assert.equal(RE_PASSOS.length, 9);
    assert.equal(RE_PASSOS.find((p) => p.id === "g")?.opcional, true);
    assert.equal(RE_PASSOS.find((p) => p.id === "h")?.opcional, true, "a ATA é opcional (R5)");
  });

  test("o RE não desenha genograma: nenhum campo do tipo genograma no fluxo do RE (só o médico desenha)", () => {
    for (const f of Object.values(RE_FORMS)) {
      for (const c of camposDoForm(f)) {
        assert.notEqual(c.tipo, "genograma", `o formulário ${f.letra} ainda tem um campo de genograma (${c.key})`);
      }
    }
  });

  test("chaves dos campos são únicas dentro de cada formulário", () => {
    for (const f of Object.values(RE_FORMS)) {
      const keys = camposDoForm(f).map((c) => c.key);
      assert.equal(new Set(keys).size, keys.length, `chaves repetidas em ${f.letra}`);
    }
  });

  test("nenhum formulário pede nome do aluno nem telefone; o professor vem do cadastro da escola", () => {
    for (const f of Object.values(RE_FORMS)) {
      for (const c of camposDoForm(f)) {
        assert.doesNotMatch(c.key, /^(aluno|nome|responsavel|contato|telefone)$/, `${f.letra}: ${c.key}`);
        if (c.key === "professor") assert.equal(c.tipo, "professor");
      }
    }
    assert.equal(camposDoForm(RE_FORMS.b).find((c) => c.key === "professor")?.tipo, "professor");
  });

  test("Formulários A, D e F não repetem a identificação (série e sexo ficam só no A)", () => {
    const chaves = (id: "a" | "b" | "c" | "d" | "e" | "f") => camposDoForm(RE_FORMS[id]).map((c) => c.key);
    assert.ok(chaves("a").includes("sexo"));
    assert.ok(!chaves("a").includes("serie"));
    for (const id of ["d", "f"] as const) {
      assert.ok(!chaves(id).includes("sexo"), `${id} não repete sexo`);
      assert.ok(!chaves(id).includes("serie"), `${id} não repete série`);
    }
    // B só pede o professor no cabeçalho
    assert.deepEqual(RE_FORMS.b.secoes[0].campos.map((c) => c.key), ["professor"]);
  });

  test("regra das opções: 3 ou mais viram múltipla com observação, exceto as exclusões documentadas", () => {
    const exclusoes = new Set(["sexo", "alunos_turma", "risco_primeira", "risco_segunda", "provas"]);
    for (const f of Object.values(RE_FORMS)) {
      for (const c of camposDoForm(f)) {
        if (c.tipo === "unica" && c.opcoes.length >= 3) {
          assert.ok(exclusoes.has(c.key), `${f.letra}.${c.key} deveria ser múltipla`);
        }
        if (c.tipo === "multipla" && c.opcoes.length >= 3 && !c.outros) {
          assert.equal(c.comObs, true, `${f.letra}.${c.key} deveria ter observação`);
        }
        if (c.tipo === "matriz" && c.opcoes.length >= 3 && !exclusoes.has(c.key)) {
          assert.equal(c.multipla, true, `${f.letra}.${c.key} deveria aceitar várias respostas por linha`);
          assert.equal(c.comObs, true);
        }
      }
    }
  });

  test("valida opções, textos e rejeita chaves desconhecidas; em branco é aceito", () => {
    assert.equal(validarPayloadReForm("a", {}), null);
    assert.equal(validarPayloadReForm("a", { gosta_escola: ["sim"] }), null);
    assert.match(validarPayloadReForm("a", { gosta_escola: ["talvez"] })!, /opção inválida/);
    assert.match(validarPayloadReForm("a", { nome: "x" })!, /desconhecido/);
    assert.equal(validarPayloadReForm("a", { gosta_escola__obs: "só às vezes" }), null);
    assert.match(validarPayloadReForm("a", { gosta_escola__obs: "x".repeat(2001) })!, /longo demais/);
    assert.match(validarPayloadReForm("b", { materiais: ["livro", "foguete"] })!, /opção inválida/);
    assert.equal(validarPayloadReForm("b", { materiais: ["livro"], materiais__outros: "mapas" }), null);
    assert.match(validarPayloadReForm("c", { sono: "x".repeat(2001) })!, /longo demais/);
    assert.match(validarPayloadReForm("d", { sala_aula: { timidez: { r: ["quase"] } } })!, /opção inválida/);
    assert.match(validarPayloadReForm("d", { sala_aula: { inexistente: { r: ["sim"] } } })!, /linha desconhecida/);
    assert.match(validarPayloadReForm("f", { provas: { conhecimento_alfabeto: { n: -1 } } })!, /inválido/);
    assert.match(validarPayloadReForm("a", { desenvolvimento_global: { postura: { n: 3 } } })!, /número não previsto/);
    assert.match(validarPayloadReForm("f", { data_aplicacao: "ontem" })!, /inválida/);
    assert.match(validarPayloadReForm("f", { provas: { conhecimento_alfabeto: { r: ["sem_risco", "alto_risco"] } } })!, /só uma opção/);
  });

  test("professor do Formulário B aceita {id, nome} e recusa chaves estranhas", () => {
    assert.equal(validarPayloadReForm("b", { professor: { id: "abc", nome: "Profa. Teste" } }), null);
    assert.equal(validarPayloadReForm("b", { professor: { nome: "Profa. Teste" } }), null);
    assert.match(validarPayloadReForm("b", { professor: { id: "x", cpf: "1" } })!, /desconhecida/);
    assert.match(validarPayloadReForm("b", { professor: "texto" })!, /inválido/);
  });

  test("rascunhos antigos são aceitos: chaves de identificação saem e resposta única vira lista", () => {
    const antigo = normalizarPayloadReForm("d", { serie: "3º", sexo: "f" });
    assert.deepEqual(antigo, {});
    const unica = normalizarPayloadReForm("a", { gosta_escola: "sim" });
    assert.deepEqual(unica.gosta_escola, ["sim"]);
    assert.equal(validarPayloadReForm("a", { gosta_escola: "sim", serie: "3º" }), null);
    const matriz = normalizarPayloadReForm("d", { sala_aula: { timidez: { r: "sim" } } });
    assert.deepEqual((matriz.sala_aula as any).timidez.r, ["sim"]);
  });

  test("progresso conta só o que foi respondido (sem preencher padrão)", () => {
    const vazio = progressoReForm("e", {});
    assert.equal(vazio.respondidos, 0);
    assert.ok(vazio.total > 0);
    assert.equal(progressoReForm("e", { figura_corpo: ["adequada"], tracado: ["ansiedade"] }).respondidos, 2);
  });

  test("lacunas listam o que está em branco com rótulo legível; observações finais não contam", () => {
    const todas = lacunasDoForm("e", {});
    assert.ok(todas.length > 0);
    assert.ok(todas.every((l) => l.rotulo.startsWith("Formulário E ›")));
    assert.ok(!todas.some((l) => l.campo === "observacoes"));
    const menos = lacunasDoForm("e", { figura_corpo: ["adequada"] });
    assert.equal(menos.length, todas.length - 1);
  });
});

describe("jornada do RE — formulário único (sem bloqueio entre blocos)", () => {
  test("tudo em branco: nenhum passo bloqueado, todas as lacunas aparecem", () => {
    const s = situacaoDaJornada(entrada());
    assert.equal(s.passos.length, 9);
    assert.ok(s.passos.every((p) => p.estado === "vazio"));
    assert.ok(s.lacunas.length > 50);
    assert.ok(s.lacunas.some((l) => l.passo === "g"), "G pede decisão: preencher ou 'Não vou aplicar'");
    assert.ok(s.lacunas.some((l) => l.passo === "h"));
  });

  test("qualquer ordem: preencher o Formulário E sozinho não depende de A a D", () => {
    const s = situacaoDaJornada(entrada({ payloads: { e: { figura_corpo: ["adequada"] } } }));
    assert.equal(s.passos.find((p) => p.id === "e")?.estado, "parcial");
    assert.equal(s.passos.find((p) => p.id === "a")?.estado, "vazio");
  });

  test("G pulado conta como decisão e sai da lista; H aguardando NÃO libera o envio (ATA é obrigatória)", () => {
    const meta = { ...metaVazia(), g_pulado: true, h_aguardando: true };
    const s = situacaoDaJornada(entrada({ meta }));
    assert.equal(s.passos.find((p) => p.id === "g")?.estado, "pulado");
    assert.equal(s.passos.find((p) => p.id === "h")?.estado, "aguardando_responsavel");
    assert.ok(!s.lacunas.some((l) => l.passo === "g"));
    assert.ok(s.lacunas.some((l) => l.passo === "h" && l.bloqueante), "ATA ainda pendente bloqueia");
  });

  test("Formulário I: campos obrigatórios bloqueiam e o texto livre tem mínimo de caracteres", () => {
    const vazio = lacunasDoSumario({}, "3º ano");
    assert.ok(vazio.length >= 4 && vazio.every((l) => l.bloqueante));
    const curto = lacunasDoSumario({ queixa_professor: "curta", hipotese_espectro: "x", dificuldades_persistentes: ["Fala"], conduta: "nao" }, "3º ano");
    assert.ok(curto.some((l) => l.campo === "queixa_professor" && /20 caracteres/.test(l.rotulo)));
    assert.ok(curto.some((l) => l.campo === "hipotese_espectro" && /15 caracteres/.test(l.rotulo)));
    const ok = lacunasDoSumario({ queixa_professor: "Dificuldade para copiar da lousa.", hipotese_espectro: "Dimensão da comunicação.", dificuldades_persistentes: ["Fala"], conduta: "nao" }, "3º ano");
    assert.deepEqual(ok.map((l) => l.campo), ["conduta_just"], "conduta Não também exige justificativa (REG-024)");
    const okJust = lacunasDoSumario({ queixa_professor: "Dificuldade para copiar da lousa.", hipotese_espectro: "Dimensão da comunicação.", dificuldades_persistentes: ["Fala"], conduta: "nao", conduta_just: JUST_OK }, "3º ano");
    assert.equal(okJust.length, 0);
    const conduta = lacunasDoSumario({ queixa_professor: "Dificuldade para copiar da lousa.", hipotese_espectro: "Dimensão da comunicação.", dificuldades_persistentes: ["Fala"], conduta: "sim", qual: "x", tempo: "", resultado: "" }, "3º ano");
    assert.deepEqual(conduta.map((l) => l.campo).sort(), ["conduta_just", "qual", "resultado", "tempo"]);
  });

  test("retrato das escalas: ATA pontua pela regra da fonte; SNAP-IV só aparece se houver resposta e nunca conta os itens 10 a 18", () => {
    const sem = montarEscalasSumario({});
    assert.equal(sem.ata, null);
    assert.equal(sem.snap4, null);
    const ataRascunho = montarEscalasSumario({ ataAnswers: { marcados: { "1": [0] }, antes36meses: true }, ataEnviada: false });
    assert.equal(ataRascunho.ata, null, "só a ATA enviada entra");
    const e = montarEscalasSumario({
      ataAnswers: { marcados: { "1": [0, 1], "2": [0] }, antes36meses: true },
      ataEnviada: true,
      snap4: { respostas: { "SNAP4-01": "bastante", "SNAP4-02": "demais", "SNAP4-03": "so_um_pouco" } },
    });
    assert.equal(e.ata?.total, 2 + 1 + 1, "grupo 1 = 2, grupo 2 = 1, +1 por início antes dos 36 meses");
    assert.equal(e.snap4?.itens_1_a_9.marcados, 2);
    assert.deepEqual(e.snap4?.itens_10_a_18, { marcados: 0, de: 9 });
  });

  test("ATA enviada conclui o H", () => {
    const s = situacaoDaJornada(entrada({ ata: { existe: true, enviada: true } }));
    assert.equal(s.passos.find((p) => p.id === "h")?.estado, "completo");
  });

  test("SNAP-IV parcial lista os itens sem resposta", () => {
    const s = situacaoDaJornada(entrada({ snap4: { respostas: { "SNAP4-01": "nem_um_pouco" } } }));
    const g = s.lacunas.find((l) => l.passo === "g");
    assert.ok(g && /itens/.test(g.rotulo));
  });

  test("Sumário I: a série vem do cadastro do aluno", () => {
    const comSerie = situacaoDaJornada(entrada({ serieDoAluno: "3º ano" }));
    assert.ok(!comSerie.lacunas.some((l) => l.campo === "serie"));
    const semSerie = situacaoDaJornada(entrada({ serieDoAluno: null }));
    assert.ok(semSerie.lacunas.some((l) => l.campo === "serie"));
  });
});

describe("Formulário I — dados do aluno carregados automaticamente", () => {
  test("idade, grupo e série vêm do cadastro", () => {
    const p = montarPayloadFogap({ student: { birthYear: 2019, birthMonth: 3, grade: "3º ano" } });
    assert.equal(p.secao_sumario.serie, "3º ano");
    assert.equal(p.idade_anos !== null, true);
  });

  test("a série digitada pelo cliente é ignorada: vale o cadastro", () => {
    const p = montarPayloadFogap({
      student: { birthYear: 2019, birthMonth: 3, grade: "2º ano" },
      secaoSumario: { serie: "9º ano", queixa_professor: "Observa-se que..." },
    });
    assert.equal(p.secao_sumario.serie, "2º ano");
    assert.equal(p.secao_sumario.queixa_professor, "Observa-se que...");
  });

  test("encaminhamento com data futura é aceito (agendamento)", () => {
    const p = montarPayloadFogap({
      student: { birthYear: 2019, birthMonth: 3, grade: null },
      secaoEncaminhamento: { observacoes: "", data: "2099-01-01" },
    });
    assert.equal(p.secao_encaminhamento.data, "2099-01-01");
    assert.equal(p.secao_sumario.serie, "");
  });
});

describe("idade a partir do nascimento", () => {
  test("calcula anos e meses pelo ano/mês", () => {
    assert.deepEqual(idadeAPartirDoNascimento(2019, 3, "2026-10-19"), { anos: 7, meses: 7 });
    assert.deepEqual(idadeAPartirDoNascimento(2016, 11, "2026-10-19"), { anos: 9, meses: 11 });
    assert.equal(idadeAPartirDoNascimento(2030, 1, "2026-10-19").anos, -1);
  });
});

describe("jornada do RE — ATA opcional (R5, R7)", () => {
  const estadoH = (s: ReturnType<typeof situacaoDaJornada>) => s.passos.find((p) => p.id === "h")?.estado;
  const lacunasH = (s: ReturnType<typeof situacaoDaJornada>) => s.lacunas.filter((l) => l.passo === "h");

  test("registro antigo sem h_pulado lê como falso e preserva o resto", () => {
    const antigo = metaComPadroes({ concluidos: { a: "2026-10-01T00:00:00Z" }, g_pulado: true, h_aguardando: true });
    assert.equal(antigo.h_pulado, false);
    assert.equal(antigo.g_pulado, true);
    assert.equal(antigo.h_aguardando, true);
    assert.equal(metaComPadroes(null).h_pulado, false);
    assert.equal(metaComPadroes({ h_pulado: "true" }).h_pulado, false, "só booleano verdadeiro vale");
    assert.equal(metaVazia().h_pulado, false);
  });

  test("a situação segue a ordem da tela: a ATA vem primeiro, inclusive nas lacunas", () => {
    const s = situacaoDaJornada(entrada());
    assert.deepEqual(s.passos.map((p) => p.id).join(""), "habcdefgi");
    assert.equal(s.lacunas[0]?.passo, "h");
    assert.ok(s.lacunas.findIndex((l) => l.passo === "h") < s.lacunas.findIndex((l) => l.passo === "a"));
  });

  test("ATA pulada: estado pulado e nenhuma lacuna do passo H", () => {
    const s = situacaoDaJornada(entrada({ meta: { ...metaVazia(), h_pulado: true } }));
    assert.equal(estadoH(s), "pulado");
    assert.equal(lacunasH(s).length, 0);
  });

  test("ATA pulada não bloqueia o envio por causa do H (as demais lacunas seguem)", () => {
    const s = situacaoDaJornada(entrada({ meta: { ...metaVazia(), h_pulado: true, g_pulado: true } }));
    assert.ok(!s.lacunas.some((l) => l.passo === "h" || l.passo === "g"));
    assert.ok(s.lacunas.some((l) => l.passo === "a"), "os outros blocos continuam cobrando o que falta");
  });

  test("aguardando o responsável continua bloqueando e é diferente de pulado", () => {
    const aguardando = situacaoDaJornada(entrada({ meta: { ...metaVazia(), h_aguardando: true } }));
    assert.equal(estadoH(aguardando), "aguardando_responsavel");
    assert.ok(lacunasH(aguardando).some((l) => l.bloqueante));
  });

  test("pulado vence aguardando se os dois estiverem marcados (a rota limpa o aguardando ao pular)", () => {
    const s = situacaoDaJornada(entrada({ meta: { ...metaVazia(), h_pulado: true, h_aguardando: true } }));
    assert.equal(estadoH(s), "pulado");
    assert.equal(lacunasH(s).length, 0);
  });

  test("retomada: voltando h_pulado para falso, a ATA volta a ser pedida (bloqueante)", () => {
    const pulado = situacaoDaJornada(entrada({ meta: { ...metaVazia(), h_pulado: true } }));
    assert.equal(estadoH(pulado), "pulado");
    const retomado = situacaoDaJornada(entrada({ meta: { ...metaVazia(), h_pulado: false } }));
    assert.equal(estadoH(retomado), "vazio");
    assert.ok(lacunasH(retomado).some((l) => l.bloqueante && /Não vou aplicar/.test(l.rotulo)));
    const rascunho = situacaoDaJornada(entrada({ ata: { existe: true, enviada: false } }));
    assert.equal(estadoH(rascunho), "parcial");
  });

  test("ATA com respostas enviadas: completa, sem lacuna", () => {
    const s = situacaoDaJornada(entrada({ ata: { existe: true, enviada: true } }));
    assert.equal(estadoH(s), "completo");
    assert.equal(lacunasH(s).length, 0);
  });

  test("ataTemRespostas: só marca ou resposta de início antes dos 36 meses contam", () => {
    assert.equal(ataTemRespostas(undefined), false);
    assert.equal(ataTemRespostas(null), false);
    assert.equal(ataTemRespostas({ marcados: {}, antes36meses: null }), false);
    assert.equal(ataTemRespostas({ marcados: { "1": [] }, antes36meses: null }), false);
    assert.equal(ataTemRespostas({ marcados: { "1": [0] }, antes36meses: null }), true);
    assert.equal(ataTemRespostas({ marcados: {}, antes36meses: false }), true);
  });

  test("retrato das escalas: ATA pulada não leva pontuação e marca ata_nao_aplicada", () => {
    const respostas = { marcados: { "1": [0, 1] }, antes36meses: true };
    const pulada = montarEscalasSumario({ ataAnswers: respostas, ataEnviada: true, ataPulada: true });
    assert.equal(pulada.ata, null);
    assert.equal(pulada.ata_nao_aplicada, true);
    const normal = montarEscalasSumario({ ataAnswers: respostas, ataEnviada: true });
    assert.ok(normal.ata);
    assert.equal(normal.ata_nao_aplicada, undefined);
  });
});
