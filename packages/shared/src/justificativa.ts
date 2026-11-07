import { z } from "zod";

/**
 * Justificativa de campos Sim/Não/Às vezes, "Houve conduta" e devolução ao RE (REG-016).
 *
 * Regra do produto (PM, 06/nov/2026): entre 100 e 150 caracteres, pelo menos 5 palavras, e nunca texto de enchimento
 * (lorem ipsum, letras soltas, teclado sem sentido, sequência repetida) nem dado que identifique pessoa (regra 3 do projeto).
 *
 * São regras objetivas e determinísticas: sem IA, sem chamada externa, o mesmo texto dá sempre o mesmo resultado.
 * O texto NUNCA é enviado ao serviço de IA (bi-rag) nem entra em métrica: só as contagens (ver `medirJustificativa`).
 * Web e API usam este mesmo arquivo; quem decide de verdade é a API.
 */

export const JUSTIFICATIVA_MIN = 100;
export const JUSTIFICATIVA_MAX = 150;
export const JUSTIFICATIVA_MIN_PALAVRAS = 5;

export interface JustificativaMedida {
  /** Texto normalizado (sem espaços nas pontas, espaços repetidos viram um). */
  texto: string;
  caracteres: number;
  palavras: number;
  /** Estimativa de volume (ceil(caracteres / 4)). Não é o tokenizador de nenhum modelo. */
  tokensEstimados: number;
}

export type JustificativaResultado =
  | ({ ok: true } & JustificativaMedida)
  | { ok: false; motivo: string; caracteres: number };

const VOGAIS = "aeiouyáàâãäéèêëíìîïóòôõöúùûü";
const SEQUENCIAS_DE_TECLADO = [
  "asdf", "sdfg", "dfgh", "fghj", "ghjk", "hjkl", "qwer", "wert", "erty", "rtyu", "tyui", "yuio", "uiop",
  "zxcv", "xcvb", "cvbn", "vbnm", "qaz", "wsx", "edc", "poiu", "lkjh", "mnbv",
];

/** Tira acento e põe em minúsculas, só para comparar. */
function simples(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function normalizarJustificativa(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

function palavrasDe(texto: string): string[] {
  return (texto.match(/\p{L}[\p{L}'’-]*/gu) ?? []).filter((p) => p.replace(/[^\p{L}]/gu, "").length >= 2);
}

function pareceDadoPessoal(texto: string): boolean {
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(texto)) return true; // e-mail
  if (/https?:\/\/|www\./i.test(texto)) return true; // endereço da web
  if (/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/.test(texto)) return true; // CPF
  if (/\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/.test(texto)) return true; // telefone
  if (/\d{8,}/.test(texto.replace(/[\s.-]/g, ""))) return true; // número longo (documento)
  return false;
}

/**
 * Valida e mede. Devolve sempre uma frase curta, observável, que diz o que falta.
 * `rascunho`: texto ainda incompleto é aceito (sem mínimo de caracteres, palavras e variedade), mas o que já foi digitado não pode ser
 * lorem ipsum, dado pessoal, repetição nem palavra sem sentido, e nunca passa de 150 caracteres. Usado ao salvar rascunho.
 */
export function validarJustificativa(bruto: unknown, opcoes: { rascunho?: boolean } = {}): JustificativaResultado {
  const texto = normalizarJustificativa(typeof bruto === "string" ? bruto : "");
  const caracteres = [...texto].length;
  const rascunho = opcoes.rascunho === true;
  const falha = (motivo: string): JustificativaResultado => ({ ok: false, motivo, caracteres });

  if (rascunho && caracteres === 0) return { ok: true, texto, caracteres: 0, palavras: 0, tokensEstimados: 0 };

  if (!rascunho && caracteres < JUSTIFICATIVA_MIN) {
    return falha(`Escreva entre ${JUSTIFICATIVA_MIN} e ${JUSTIFICATIVA_MAX} caracteres. Faltam ${JUSTIFICATIVA_MIN - caracteres}.`);
  }
  if (caracteres > JUSTIFICATIVA_MAX) {
    return falha(`Escreva entre ${JUSTIFICATIVA_MIN} e ${JUSTIFICATIVA_MAX} caracteres. Passou ${caracteres - JUSTIFICATIVA_MAX}.`);
  }

  const palavras = palavrasDe(texto);
  if (!rascunho && palavras.length < JUSTIFICATIVA_MIN_PALAVRAS) {
    return falha(`Use pelo menos ${JUSTIFICATIVA_MIN_PALAVRAS} palavras.`);
  }

  const semEspaco = texto.replace(/\s/g, "");
  const letras = (semEspaco.match(/\p{L}/gu) ?? []).length;
  if (!rascunho && letras / semEspaco.length < 0.6) {
    return falha("Escreva a justificativa com palavras, sem depender de números e símbolos.");
  }

  const s = simples(texto);
  if (/lorem|ipsum|dolor sit|consectetur|adipiscing/.test(s)) {
    return falha("Escreva a justificativa com as suas palavras sobre este caso.");
  }
  if (pareceDadoPessoal(texto)) {
    return falha("Não escreva nome, e-mail, telefone, documento ou endereço. Descreva só o que foi observado.");
  }
  if (/(\p{L}|\d|[^\s\p{L}\d])\1{3,}/u.test(s)) {
    return falha("Há letras ou sinais repetidos em sequência. Reescreva a justificativa.");
  }

  const simplesPalavras = palavras.map((p) => simples(p).replace(/[^a-z]/g, "")).filter((p) => p.length >= 2);
  const distintas = new Set(simplesPalavras);
  if (!rascunho && distintas.size < 4) {
    return falha("Use pelo menos 4 palavras diferentes.");
  }
  const maisRepetida = Math.max(0, ...[...distintas].map((p) => simplesPalavras.filter((x) => x === p).length));
  if (!rascunho && maisRepetida / simplesPalavras.length > 0.4) {
    return falha("A mesma palavra se repete demais. Reescreva a justificativa.");
  }

  for (const p of simplesPalavras) {
    const original = p;
    if (original.length >= 5 && ![...original].some((c) => VOGAIS.includes(c))) {
      return falha("Há palavras sem sentido. Reescreva a justificativa.");
    }
    if (/[^aeiouy]{6,}/.test(original)) {
      return falha("Há palavras sem sentido. Reescreva a justificativa.");
    }
    if (original.length >= 3 && SEQUENCIAS_DE_TECLADO.some((seq) => original.includes(seq) && (seq.length >= 4 || original.length <= 4))) {
      return falha("Há palavras sem sentido. Reescreva a justificativa.");
    }
  }

  return { ok: true, texto, caracteres, palavras: palavras.length, tokensEstimados: Math.ceil(caracteres / 4) };
}

/** Só as contagens que o KPI do Admin Master guarda. O texto não sai daqui. */
export function medirJustificativa(texto: string): Pick<JustificativaMedida, "caracteres" | "palavras" | "tokensEstimados"> {
  const t = normalizarJustificativa(texto);
  const caracteres = [...t].length;
  return { caracteres, palavras: palavrasDe(t).length, tokensEstimados: Math.ceil(caracteres / 4) };
}

/** Esquema zod. Devolve o texto já normalizado quando válido. */
export const justificativaSchema = z.string().superRefine((valor, ctx) => {
  const r = validarJustificativa(valor);
  if (!r.ok) ctx.addIssue({ code: "custom", message: r.motivo });
}).transform((valor) => normalizarJustificativa(valor));
