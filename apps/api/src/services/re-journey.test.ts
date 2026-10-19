import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  RE_FORMS,
  RE_PASSOS,
  camposDoForm,
  metaVazia,
  progressoReForm,
  situacaoDaJornada,
  validarPayloadReForm,
  type RePassoId,
} from "@periscopio/shared";
import { idadeAPartirDoNascimento } from "../routes/re-journey.routes";

describe("jornada do RE — catálogo A–F", () => {
  test("a ordem dos passos é exatamente A B C D E F G H I", () => {
    assert.deepEqual(RE_PASSOS.map((p) => p.letra).join(""), "ABCDEFGHI");
    assert.equal(RE_PASSOS.find((p) => p.id === "g")?.opcional, true);
  });

  test("chaves dos campos são únicas dentro de cada formulário", () => {
    for (const f of Object.values(RE_FORMS)) {
      const keys = camposDoForm(f).map((c) => c.key);
      assert.equal(new Set(keys).size, keys.length, `chaves repetidas em ${f.letra}`);
    }
  });

  test("nenhum formulário pede nome do aluno, nome de adulto ou telefone", () => {
    for (const f of Object.values(RE_FORMS)) {
      for (const c of camposDoForm(f)) {
        assert.doesNotMatch(c.key, /^(aluno|nome|professor|responsavel|contato|telefone)$/, `${f.letra}: ${c.key}`);
      }
    }
  });

  test("valida opções, textos e rejeita chaves desconhecidas; em branco é aceito", () => {
    assert.equal(validarPayloadReForm("a", {}), null);
    assert.equal(validarPayloadReForm("a", { gosta_escola: "sim" }), null);
    assert.match(validarPayloadReForm("a", { gosta_escola: "talvez" })!, /opção inválida/);
    assert.match(validarPayloadReForm("a", { nome: "x" })!, /desconhecido/);
    assert.match(validarPayloadReForm("b", { materiais: ["livro", "foguete"] })!, /opção inválida/);
    assert.equal(validarPayloadReForm("b", { materiais: ["livro"], materiais__outros: "mapas" }), null);
    assert.match(validarPayloadReForm("c", { sono: "x".repeat(2001) })!, /longo demais/);
    assert.match(validarPayloadReForm("d", { sala_aula: { timidez: { r: "quase" } } })!, /opção inválida/);
    assert.match(validarPayloadReForm("d", { sala_aula: { inexistente: { r: "sim" } } })!, /linha desconhecida/);
    assert.equal(validarPayloadReForm("f", { provas: { conhecimento_alfabeto: { n: 18, r: "sem_risco" } } }), null);
    assert.match(validarPayloadReForm("f", { provas: { conhecimento_alfabeto: { n: -1 } } })!, /inválido/);
    assert.match(validarPayloadReForm("a", { desenvolvimento_global: { postura: { n: 3 } } })!, /número não previsto/);
    assert.match(validarPayloadReForm("f", { data_aplicacao: "ontem" })!, /inválida/);
  });

  test("progresso conta só o que foi respondido (sem preencher padrão)", () => {
    const vazio = progressoReForm("e", {});
    assert.equal(vazio.respondidos, 0);
    assert.ok(vazio.total > 0);
    assert.equal(progressoReForm("e", { figura_corpo: "adequada", tracado: ["ansiedade"] }).respondidos, 2);
  });
});

describe("jornada do RE — motor de sequência", () => {
  const ate = (...ids: RePassoId[]) => Object.fromEntries(ids.map((i) => [i, "2026-10-19T12:00:00Z"]));

  test("começa só com A disponível", () => {
    const s = situacaoDaJornada({ meta: metaVazia() });
    assert.equal(s.atual, "a");
    assert.equal(s.podeEnviar, false);
    assert.deepEqual(s.passos.map((p) => p.estado), ["disponivel", ...Array(8).fill("bloqueado")]);
  });

  test("concluir um libera o próximo, na ordem", () => {
    const s = situacaoDaJornada({ meta: { ...metaVazia(), concluidos: ate("a", "b") } });
    assert.equal(s.atual, "c");
    assert.equal(s.passos[2].estado, "disponivel");
    assert.equal(s.passos[3].estado, "bloqueado");
  });

  test("um passo concluído depois de um não resolvido continua travado (dado inconsistente)", () => {
    const s = situacaoDaJornada({ meta: { ...metaVazia(), concluidos: ate("a", "c") } });
    assert.equal(s.passos[2].estado, "bloqueado");
    assert.equal(s.atual, "b");
  });

  test("G pulado e H aguardando o responsável deixam seguir até o Sumário", () => {
    const meta = { ...metaVazia(), concluidos: ate("a", "b", "c", "d", "e", "f"), g_pulado: true, h_aguardando: true };
    const s = situacaoDaJornada({ meta });
    assert.equal(s.atual, "i");
    assert.equal(s.podeEnviar, false);
    const fim = situacaoDaJornada({ meta: { ...meta, concluidos: ate("a", "b", "c", "d", "e", "f", "i") } });
    assert.equal(fim.podeEnviar, true);
    assert.equal(fim.passos[6].estado, "pulado");
    assert.equal(fim.passos[7].estado, "aguardando_responsavel");
  });

  test("ATA enviada conclui o H sozinha", () => {
    const meta = { ...metaVazia(), concluidos: ate("a", "b", "c", "d", "e", "f"), g_pulado: true };
    const s = situacaoDaJornada({ meta, ataEnviada: true });
    assert.equal(s.passos[7].estado, "concluido");
    assert.equal(s.atual, "i");
  });

  test("sem pular o G ele continua pendente e bloqueia H e I", () => {
    const s = situacaoDaJornada({ meta: { ...metaVazia(), concluidos: ate("a", "b", "c", "d", "e", "f") } });
    assert.equal(s.atual, "g");
    assert.equal(s.passos[7].estado, "bloqueado");
  });
});

describe("idade a partir do nascimento", () => {
  test("calcula anos e meses pelo ano/mês", () => {
    assert.deepEqual(idadeAPartirDoNascimento(2019, 3, "2026-10-19"), { anos: 7, meses: 7 });
    assert.deepEqual(idadeAPartirDoNascimento(2016, 11, "2026-10-19"), { anos: 9, meses: 11 });
    assert.equal(idadeAPartirDoNascimento(2030, 1, "2026-10-19").anos, -1);
  });
});
