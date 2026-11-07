/**
 * REG-023 — modo rascunho da justificativa (Spec J-01).
 * Regra de ouro: o rascunho aceita o que está incompleto, nunca o que já está errado.
 * Todos os textos são sintéticos.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { JUSTIFICATIVA_MAX, justificativaRascunhoSchema, validarJustificativa } from "@periscopio/shared";

const VALIDA =
  "A professora observou que o aluno se afasta do grupo quando a sala fica barulhenta e volta a participar quando o ambiente fica mais calmo.";

const RASCUNHO = { rascunho: true } as const;

describe("justificativa em modo rascunho (REG-023)", () => {
  test("vazio é aceito no rascunho e recusado no envio", () => {
    const r = validarJustificativa("", RASCUNHO);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.caracteres, 0);
    assert.equal(validarJustificativa("").ok, false);
  });

  test("null, undefined e número contam como vazio no rascunho", () => {
    for (const bruto of [null, undefined, 123]) {
      const r = validarJustificativa(bruto, RASCUNHO);
      assert.equal(r.ok, true, String(bruto));
      if (r.ok) assert.equal(r.caracteres, 0);
    }
  });

  test("texto curto e incompleto é aceito no rascunho, mas recusado no envio", () => {
    assert.equal(validarJustificativa("Observei que o aluno", RASCUNHO).ok, true);
    assert.equal(validarJustificativa("Observei que o aluno").ok, false);
  });

  test("palavra cortada no meio (autosave) não é recusada", () => {
    assert.equal(validarJustificativa("O aluno apresenta dificuldad", RASCUNHO).ok, true);
  });

  test("texto completo e coerente passa nos dois modos", () => {
    assert.equal(validarJustificativa(VALIDA, RASCUNHO).ok, true);
    assert.equal(validarJustificativa(VALIDA).ok, true);
  });

  test("o limite de 150 caracteres vale também no rascunho", () => {
    // 151 caracteres exatos, sem espaço no fim (o espaço final seria cortado pela normalização).
    const longo = VALIDA + "z".repeat(JUSTIFICATIVA_MAX + 1 - [...VALIDA].length);
    assert.equal([...longo].length, JUSTIFICATIVA_MAX + 1);
    const r = validarJustificativa(longo, RASCUNHO);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.motivo, /Passou 1\./);
  });

  const recusadosNosDoisModos: [string, string, RegExp][] = [
    ["lorem ipsum", "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim.", /suas palavras/],
    ["lorem curto", "lorem ipsum", /suas palavras/],
    ["e-mail", "contato aluno@exemplo.com", /nome, e-mail/],
    ["telefone", "ligar (11) 91234-5678", /nome, e-mail/],
    ["CPF", "cpf 123.456.789-09", /nome, e-mail/],
    ["endereço da web", "veja https://site.exemplo", /nome, e-mail/],
    ["caractere repetido", "aaaaaaaaaa", /repetidos/],
    ["teclado sem sentido", "asdfgh qwerty", /sem sentido/],
  ];
  for (const [nome, texto, esperado] of recusadosNosDoisModos) {
    test(`recusa também no rascunho: ${nome}`, () => {
      const rascunho = validarJustificativa(texto, RASCUNHO);
      assert.equal(rascunho.ok, false, `rascunho: ${nome}`);
      if (!rascunho.ok) assert.match(rascunho.motivo, esperado, rascunho.motivo);
      assert.equal(validarJustificativa(texto).ok, false, `envio: ${nome}`);
    });
  }

  test("a mesma palavra repetida é aceita no rascunho (ainda está sendo escrito) e recusada no envio", () => {
    const repetido = "casa ".repeat(24).trim();
    assert.equal(validarJustificativa(repetido, RASCUNHO).ok, true);
    assert.equal(validarJustificativa(repetido).ok, false);
  });

  test("espaços extras são normalizados no rascunho", () => {
    const r = validarJustificativa("   texto   com   espaços   ", RASCUNHO);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.texto, "texto com espaços");
  });

  test("zod do rascunho: aceita incompleto, recusa lorem e devolve o texto normalizado", () => {
    const ok = justificativaRascunhoSchema.safeParse("  curto  ");
    assert.equal(ok.success, true);
    if (ok.success) assert.equal(ok.data, "curto");
    assert.equal(justificativaRascunhoSchema.safeParse("lorem ipsum dolor").success, false);
  });
});
