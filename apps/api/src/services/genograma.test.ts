import test from "node:test";
import assert from "node:assert/strict";
import {
  GENOGRAMA_MAX_MEMBROS,
  GENOGRAMA_VAZIO,
  adicionarMembro,
  atualizarMembro,
  disponibilidade,
  genogramaParaDocumento,
  lacunasDoForm,
  lerGenograma,
  medicoTemConteudo,
  normalizarGenograma,
  normalizarGenogramaTexto,
  normalizarPayloadMedico,
  normalizarPayloadReForm,
  removerMembro,
  resumoDoGenograma,
  serializarGenograma,
  validarPayloadReForm,
  type Genograma,
  type ParentescoId,
} from "@periscopio/shared";

function montar(ids: ParentescoId[]): Genograma {
  let g: Genograma = GENOGRAMA_VAZIO;
  for (const id of ids) g = adicionarMembro(g, id);
  return g;
}
const parentescos = (g: Genograma) => g.membros.map((m) => m.parentesco);

test("normalizar: descarta o desconhecido, o repetido que deve ser único e o que ficou sem ligação", () => {
  const g = normalizarGenograma({
    aluno: "male",
    membros: [
      { id: "a", parentesco: "mae" },
      { id: "b", parentesco: "mae" },
      { id: "c", parentesco: "tio_paterno" }, // sem avô paterno
      { id: "d", parentesco: "primo" },
      { id: "e", parentesco: "avo_materna" },
      { id: "f", parentesco: "tia_materna", anotacao: "  informado   pelo responsável  " },
    ],
  });
  assert.deepEqual(parentescos(g), ["mae", "avo_materna", "tia_materna"]);
  assert.equal(g.membros[2]!.anotacao, "informado pelo responsável");
  assert.equal(g.aluno, "male");
});

test("normalizar: entrada inválida vira genograma vazio; ids repetidos ganham novo id", () => {
  assert.deepEqual(normalizarGenograma(null).membros, []);
  assert.deepEqual(normalizarGenograma("texto").membros, []);
  const g = normalizarGenograma({ membros: [{ id: "x", parentesco: "pai" }, { id: "x", parentesco: "mae" }, { id: "aluno", parentesco: "irma" }] });
  assert.equal(new Set(g.membros.map((m) => m.id)).size, 3);
  assert.ok(!g.membros.some((m) => m.id === "aluno"));
});

test("limite de figuras", () => {
  let g = montar(["mae", "pai"]);
  for (let i = 0; i < 40; i++) g = adicionarMembro(g, "irmao");
  assert.equal(g.membros.length, GENOGRAMA_MAX_MEMBROS);
  assert.equal(disponibilidade(g, "irma").ok, false);
});

test("disponibilidade: avós e tios dependem de quem liga", () => {
  assert.equal(disponibilidade(GENOGRAMA_VAZIO, "avo_materna").ok, false);
  assert.equal(disponibilidade(GENOGRAMA_VAZIO, "irmao").ok, false);
  assert.equal(disponibilidade(GENOGRAMA_VAZIO, "mae").ok, true);
  const g = montar(["mae"]);
  assert.equal(disponibilidade(g, "mae").ok, false, "mãe é única");
  assert.equal(disponibilidade(g, "avo_materno").ok, true);
  assert.equal(disponibilidade(g, "avo_paterno").ok, false, "falta o pai");
  assert.equal(disponibilidade(g, "tio_materno").ok, false, "falta avô/avó materno(a)");
});

test("remover a mãe retira avós e tios maternos e mantém o lado paterno", () => {
  const g = montar(["mae", "pai", "avo_materna", "tio_materno", "avo_paterno", "tia_paterna"]);
  const mae = g.membros.find((m) => m.parentesco === "mae")!;
  const r = removerMembro(g, mae.id);
  assert.deepEqual(parentescos(r), ["pai", "avo_paterno", "tia_paterna"]);
});

test("pais separados só vale com mãe e pai no desenho", () => {
  assert.equal(normalizarGenograma({ paisSeparados: true, membros: [{ id: "a", parentesco: "mae" }] }).paisSeparados, undefined);
  const g = normalizarGenograma({ ...montar(["mae", "pai"]), paisSeparados: true });
  assert.equal(g.paisSeparados, true);
  const doc = genogramaParaDocumento(g);
  const uniao = doc.relationships.find((r) => r.type === "union");
  assert.equal(uniao && uniao.type === "union" ? uniao.status : null, "separated");
});

test("documento da biblioteca: união dos pais, filhos ligados à união e nenhum nome", () => {
  const g = atualizarMembro(montar(["mae", "pai", "irmao", "irma", "avo_materna", "avo_materno", "tia_materna"]), "m1", { falecido: true, anotacao: "x" });
  const doc = genogramaParaDocumento(g);
  assert.equal(doc.people.find((p) => p.id === "aluno")?.isProband, true);
  assert.equal(doc.metadata.title, "Genograma");
  const rotulos = doc.people.map((p) => p.name).sort();
  assert.deepEqual(rotulos, ["Aluno(a)", "Avó materna", "Avô materno", "Irmã", "Irmão", "Mãe", "Pai", "Tia materna"].sort());
  const mae = doc.people.find((p) => p.name === "Mãe")!;
  assert.equal(mae.deceased, true);
  assert.ok(mae.style?.fillColor);
  const filhos = doc.relationships.filter((r) => r.type === "parent-child");
  const aluno = filhos.find((r) => r.type === "parent-child" && r.childId === "aluno");
  assert.equal(aluno && aluno.type === "parent-child" ? aluno.unionId : null, "u_pais");
  // toda referência aponta para alguém que existe
  const ids = new Set(doc.people.map((p) => p.id));
  for (const r of doc.relationships) {
    if (r.type === "union") r.partnerIds.forEach((i) => assert.ok(ids.has(i)));
    else {
      assert.ok(ids.has(r.childId));
      (r.parentIds ?? []).forEach((i) => assert.ok(ids.has(i)));
    }
  }
});

test("só a mãe: o aluno e o irmão ligam a ela, sem união", () => {
  const doc = genogramaParaDocumento(montar(["mae", "irmao"]));
  assert.equal(doc.relationships.filter((r) => r.type === "union").length, 0);
  const aluno = doc.relationships.find((r) => r.type === "parent-child" && r.childId === "aluno");
  assert.deepEqual(aluno && aluno.type === "parent-child" ? aluno.parentIds : null, ["m1"]);
});

test("serialização: sem figuras é campo em branco; texto inválido é ignorado", () => {
  assert.equal(serializarGenograma(GENOGRAMA_VAZIO), "");
  assert.equal(normalizarGenogramaTexto("não é json"), "");
  assert.equal(normalizarGenogramaTexto(JSON.stringify({ membros: [] })), "");
  const t = serializarGenograma(montar(["mae", "pai"]));
  assert.deepEqual(parentescos(lerGenograma(t)!), ["mae", "pai"]);
  assert.equal(resumoDoGenograma(lerGenograma(t)!), "Mãe, Pai");
});

test("formulário do médico: estrutura do genograma é normalizada e conta como conteúdo", () => {
  const vazio = normalizarPayloadMedico("genograma", {});
  assert.deepEqual(vazio, { estrutura: "", registro: "" });
  assert.equal(medicoTemConteudo(vazio), false);
  const sujo = JSON.stringify({ membros: [{ id: "a", parentesco: "mae" }, { id: "b", parentesco: "xyz" }], extra: 1 });
  const ok = normalizarPayloadMedico("genograma", { estrutura: sujo, registro: "texto" });
  assert.deepEqual(parentescos(lerGenograma(ok.estrutura)!), ["mae"]);
  assert.equal(medicoTemConteudo(normalizarPayloadMedico("genograma", { estrutura: sujo })), true);
});

test("RE: o desenho é opcional, é validado e normalizado", () => {
  const t = serializarGenograma(montar(["mae", "pai"]));
  assert.equal(validarPayloadReForm("c", { genograma_estrutura: t }), null);
  // o servidor normaliza antes de validar: lixo vira campo em branco, nunca é guardado
  assert.equal(normalizarPayloadReForm("c", { genograma_estrutura: 5 }).genograma_estrutura, "");
  assert.equal(normalizarPayloadReForm("c", { genograma_estrutura: "x".repeat(9000) }).genograma_estrutura, "");
  const n = normalizarPayloadReForm("c", { genograma_estrutura: "lixo" });
  assert.equal(n.genograma_estrutura, "");
  // em branco não vira pendência: o campo é opcional
  assert.ok(!lacunasDoForm("c", {}).some((l) => l.campo === "genograma_estrutura"));
});
