import test from "node:test";
import assert from "node:assert/strict";
import { prontoParaRevisao, type FogapPayload } from "@periscopio/shared";

test("prontoParaRevisao não derruba o servidor com payload sem objetos internos", () => {
  const torto = { fogap_version: "x", fogap_state: "em_andamento", grupo: "G3" } as unknown as FogapPayload;
  const r = prontoParaRevisao(torto);
  assert.equal(r.pronto, true);
  assert.ok(r.avisos.length > 0, "itens em branco viram avisos, não erro");
});
