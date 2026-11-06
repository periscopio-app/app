/**
 * REG-016 — validação da justificativa (100 a 150 caracteres, 5 palavras, sem texto de enchimento nem dado pessoal).
 * Os textos abaixo são sintéticos. O mesmo arquivo `justificativa.ts` roda no navegador e na API.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { JUSTIFICATIVA_MAX, JUSTIFICATIVA_MIN, justificativaSchema, medirJustificativa, validarJustificativa } from "@periscopio/shared";

const VALIDA =
  "A professora observou que o aluno se afasta do grupo quando a sala fica barulhenta e volta a participar quando o ambiente fica mais calmo.";

describe("justificativa (REG-016)", () => {
  test("texto de exemplo está dentro da faixa e é aceito", () => {
    const r = validarJustificativa(VALIDA);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.ok(r.caracteres >= JUSTIFICATIVA_MIN && r.caracteres <= JUSTIFICATIVA_MAX, `tamanho ${r.caracteres}`);
      assert.ok(r.palavras >= 5);
      assert.equal(r.tokensEstimados, Math.ceil(r.caracteres / 4));
    }
  });

  test("limites exatos: 100 e 150 passam; 99 e 151 não, e a mensagem diz quanto falta ou sobra", () => {
    const base = VALIDA;
    const ajusta = (n: number) => (base + " e depois segue com calma a rotina da turma sem novos episodios na semana").slice(0, n).replace(/\s+$/, "a");
    const com = (n: number) => {
      let t = ajusta(n);
      while ([...t].length < n) t += "a";
      return t.slice(0, n);
    };
    assert.equal(validarJustificativa(com(100)).ok, true, "100");
    assert.equal(validarJustificativa(com(150)).ok, true, "150");
    const curto = validarJustificativa(com(99));
    assert.equal(curto.ok, false);
    if (!curto.ok) assert.match(curto.motivo, /Faltam 1\./);
    const longo = validarJustificativa(com(151));
    assert.equal(longo.ok, false);
    if (!longo.ok) assert.match(longo.motivo, /Passou 1\./);
  });

  test("espaços extras e quebras de linha são normalizados antes de contar", () => {
    const r = validarJustificativa("  " + VALIDA.replace(/ /g, "  \n ") + "  ");
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.texto, VALIDA);
  });

  const invalidos: [string, string, RegExp][] = [
    ["vazio", "", /Faltam 100/],
    ["só espaços", " ".repeat(200), /Faltam 100/],
    ["lorem ipsum", "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim.", /suas palavras/],
    ["lorem em maiúsculas", "LOREM IPSUM " + VALIDA.slice(0, 100), /suas palavras/],
    ["letras repetidas", "aaaaaaaaaa ".repeat(11), /repetidos|repete|diferentes/],
    ["uma palavra repetida", "casa ".repeat(24), /diferentes|repete/],
    ["teclado sem sentido", "asdfgh qwerty zxcvbn hjklç poiuyt lkjhgf mnbvcx asdfgh qwerty zxcvbn hjklç poiuyt lkjhgf mnbvcx asdfgh", /sem sentido|diferentes|repete/],
    ["consoantes sem vogal", "sdfghjk tfgrvbn pqrstvw bcdfghj klmnpqr stvwxzb dfghjkl mnpqrst vwxzbcd fghjklm npqrstv wxzbcdf ghjklmn pqrstvw xzbcdfg", /sem sentido|diferentes|repete/],
    ["só números e símbolos", "1234 5678 !!!! @@@@ #### 9999 8888 7777 6666 5555 4444 3333 2222 1111 0000 1234 5678 9999 8888 7777 6666 5555 4444 3333 22", /palavras|repetidos|dado|Escreva/],
    ["menos de 5 palavras", "Observacao".padEnd(60, "o") + " " + "Cansaco".padEnd(40, "o"), /palavras|diferentes|sem sentido/],
    ["e-mail", VALIDA.slice(0, 90) + " contato aluno@exemplo.com", /nome, e-mail/],
    ["CPF", VALIDA.slice(0, 100) + " cpf 123.456.789-09", /nome, e-mail/],
    ["telefone", VALIDA.slice(0, 100) + " ligar (11) 91234-5678", /nome, e-mail/],
    ["endereço da web", VALIDA.slice(0, 100) + " veja https://site.exemplo", /nome, e-mail/],
  ];
  for (const [nome, texto, esperado] of invalidos) {
    test(`recusa: ${nome}`, () => {
      const r = validarJustificativa(texto);
      assert.equal(r.ok, false, nome);
      if (!r.ok) assert.match(r.motivo, esperado, r.motivo);
    });
  }

  test("palavras reais do português com muitas consoantes seguidas não são recusadas", () => {
    const t = "O aluno apresentou instrução difícil, transtorno de atenção e obstrução nasal relatada pela família, sem estrutura para a rotina em casa e na escola.";
    const r = validarJustificativa(t);
    assert.equal(r.ok, true, JSON.stringify(r));
  });

  test("zod: devolve o texto normalizado quando válido e a mesma mensagem quando inválido", () => {
    const ok = justificativaSchema.safeParse("  " + VALIDA + "  ");
    assert.equal(ok.success, true);
    if (ok.success) assert.equal(ok.data, VALIDA);
    const ruim = justificativaSchema.safeParse("curto");
    assert.equal(ruim.success, false);
    if (!ruim.success) assert.match(ruim.error.issues[0].message, /Escreva entre 100 e 150/);
    assert.equal(justificativaSchema.safeParse(123 as unknown).success, false);
  });

  test("medição devolve só contagens (nenhum texto)", () => {
    const m = medirJustificativa(VALIDA);
    assert.deepEqual(Object.keys(m).sort(), ["caracteres", "palavras", "tokensEstimados"]);
    assert.equal(m.tokensEstimados, Math.ceil(m.caracteres / 4));
  });
});
