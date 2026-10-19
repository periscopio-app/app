import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { montarContexto, rascunhoPorRegras, sugerirObservacoes, validarTextoModelo } from "./re-observacoes.service";

describe("sugestão de observações do RE", () => {
  const payload = { gosta_escola: "sim", observacoes: "A criança chegou animada." } as Record<string, unknown>;

  test("o contexto não leva professor nem identificação", () => {
    const ctx = montarContexto("b", { professor: { id: "x", nome: "Fulana de Tal" }, observacoes: "" });
    assert.equal(JSON.stringify(ctx).includes("Fulana"), false);
  });

  test("sem nada preenchido, a reserva por regras avisa que não há o que resumir", async () => {
    const r = await sugerirObservacoes("d", {});
    assert.equal(r.source, "regras");
    assert.match(r.texto, /Ainda não há respostas/);
  });

  test("a reserva preserva o texto atual e não interpreta", () => {
    const ctx = montarContexto("d", payload);
    const t = rascunhoPorRegras(ctx);
    assert.match(t, /A criança chegou animada\./);
    assert.equal(/diagn|risco|recomend/i.test(t), false);
  });

  test("a trava rejeita termos proibidos, números inventados e identificadores", () => {
    const ctx = montarContexto("d", payload);
    assert.equal(validarTextoModelo({ texto: "Foi relatado que a criança chegou animada à escola." }, ctx), "Foi relatado que a criança chegou animada à escola.");
    assert.equal(validarTextoModelo({ texto: "A criança apresenta autismo e precisa de tratamento imediato." }, ctx), null);
    assert.equal(validarTextoModelo({ texto: "Foi relatado que a criança tem 47 faltas no ano." }, ctx), null);
    assert.equal(validarTextoModelo({ texto: "Contato da mãe: maria@exemplo.com para dúvidas." }, ctx), null);
    assert.equal(validarTextoModelo({ texto: "curto" }, ctx), null);
    assert.equal(validarTextoModelo({ outro: "x" }, ctx), null);
  });
});
