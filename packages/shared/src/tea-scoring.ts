/**
 * Validação e pontuação da Triagem TEA — funções puras (sem banco, sem rede).
 *
 * Regras aplicadas SÓ onde o formulário-fonte (TRIAGEM_TEA_out26) as declara:
 *   ATA  — por grupo 0/1/2 + 1 ponto se apareceu antes dos 36 meses.
 *   ASQ  — 0/1 por pergunta, conforme a coluna do formulário; pergunta 1 não pontua; 2 a 8 saem se a criança não fala.
 *   ABC  — soma dos pesos dos comportamentos marcados, total e por área (sem classificar).
 * M-CHAT e SRS-2: só registro (faltam direção das perguntas / tabelas licenciadas) — nada é somado como risco.
 *
 * Nada aqui produz diagnóstico, classe de risco ou recomendação clínica.
 */
import {
  ABC_DOMAINS,
  ABC_TEA_ITEMS,
  ASQ_ITEMS,
  ASQ_SKIPPED_WHEN_NONVERBAL,
  ATA_GROUPS,
  MCHAT_ITEMS,
  SRS2_ITEMS,
  TEA_REFERENCE_NOTES,
  type AbcDomainCode,
  type TeaInstrumentCode,
} from "./tea-catalog";

export type YesNo = "sim" | "nao";

export interface AtaAnswers {
  /** número do grupo (1 a 22) → posições (0, 1, 2…) dos comportamentos marcados */
  marcados: Record<string, number[]>;
  antes36meses: boolean | null;
}
export interface AsqAnswers { items: Record<string, YesNo> }
export interface MchatAnswers { items: Record<string, YesNo> }
export interface Srs2Answers { items: Record<string, 1 | 2 | 3 | 4> }
export interface AbcAnswers { items: Record<string, boolean> }

export type TeaAnswers = AtaAnswers | AsqAnswers | MchatAnswers | Srs2Answers | AbcAnswers;

export function emptyAnswers(code: TeaInstrumentCode): TeaAnswers {
  switch (code) {
    case "ata": return { marcados: {}, antes36meses: null };
    default: return { items: {} };
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Confere o formato das respostas (rascunho pode estar incompleto, mas nunca inválido). Devolve a mensagem de erro, ou null. */
export function validateAnswers(code: TeaInstrumentCode, raw: unknown): string | null {
  if (!isObj(raw)) return "Respostas em formato inválido";
  if (code === "ata") {
    const m = raw.marcados;
    if (!isObj(m)) return "Informe os comportamentos marcados";
    for (const [g, arr] of Object.entries(m)) {
      const group = ATA_GROUPS.find((x) => String(x.n) === g);
      if (!group) return `Grupo desconhecido: ${g}`;
      if (!Array.isArray(arr) || arr.some((i) => !Number.isInteger(i) || (i as number) < 0 || (i as number) >= group.options.length)) {
        return `Comportamento inválido no grupo ${g}`;
      }
      if (new Set(arr as number[]).size !== arr.length) return `Comportamento repetido no grupo ${g}`;
    }
    if (raw.antes36meses !== null && typeof raw.antes36meses !== "boolean" && raw.antes36meses !== undefined) return "Campo 'antes dos 36 meses' inválido";
    return null;
  }
  const items = raw.items;
  if (!isObj(items)) return "Informe as respostas dos itens";
  const max = code === "asq" ? ASQ_ITEMS.length : code === "mchat" ? MCHAT_ITEMS.length : code === "srs2" ? SRS2_ITEMS.length : ABC_TEA_ITEMS.length;
  for (const [k, v] of Object.entries(items)) {
    const n = Number(k);
    if (!Number.isInteger(n) || n < 1 || n > max) return `Item desconhecido: ${k}`;
    if (code === "abc") {
      if (typeof v !== "boolean") return `Item ${k}: marque ou desmarque`;
    } else if (code === "srs2") {
      if (![1, 2, 3, 4].includes(v as number)) return `Item ${k}: use 1, 2, 3 ou 4`;
    } else if (v !== "sim" && v !== "nao") {
      return `Item ${k}: use Sim ou Não`;
    }
  }
  return null;
}

// ─── resultados ─────────────────────────────────────────────────────────────

export interface TeaScore {
  instrument: TeaInstrumentCode;
  /** Há pontuação calculada pelo sistema? (M-CHAT e SRS-2: não) */
  computed: boolean;
  total: number | null;
  max: number | null;
  /** Subtotais (ATA: por grupo; ABC: por área) */
  parts: { key: string; label: string; points: number; max: number }[];
  answered: number;
  required: number;
  complete: boolean;
  /** Frases curtas para a tela (sem interpretação clínica). */
  notes: string[];
  /** Só para ASQ: a criança fala frases curtas? */
  verbal?: boolean | null;
  /** Só para M-CHAT: contagem neutra de respostas. */
  counts?: { sim: number; nao: number };
  /** Faixas do formulário-fonte; a tela só mostra com a capacidade tea.reference.view. */
  reference?: { notes: readonly string[]; reached?: { label: string; value: boolean }[] };
}

export function scoreAta(a: AtaAnswers): TeaScore {
  const parts = ATA_GROUPS.map((g) => {
    const n = (a.marcados[String(g.n)] ?? []).length;
    const points = n === 0 ? 0 : n === 1 ? 1 : 2;
    return { key: `g${g.n}`, label: g.name, points, max: 2 };
  });
  const onset = a.antes36meses === true ? 1 : 0;
  const total = parts.reduce((s, p) => s + p.points, 0) + onset;
  return {
    instrument: "ata",
    computed: true,
    total,
    max: ATA_GROUPS.length * 2 + 1,
    parts,
    answered: ATA_GROUPS.length + (a.antes36meses === null || a.antes36meses === undefined ? 0 : 1),
    required: 0, // nenhum campo é obrigatório: sem marca = nenhum sintoma
    complete: true,
    notes: [
      `${parts.filter((p) => p.points > 0).length} de ${ATA_GROUPS.length} grupos com ao menos um comportamento marcado.`,
      a.antes36meses === true ? "Sinais referidos antes dos 36 meses (+1 ponto)." : "Início antes dos 36 meses: não marcado.",
    ],
    reference: { notes: TEA_REFERENCE_NOTES.ata, reached: [{ label: "Ponto de corte 15 do formulário", value: total >= 15 }] },
  };
}

export function asqApplicable(a: AsqAnswers): number[] {
  const verbal = a.items["1"] !== "nao";
  return ASQ_ITEMS.filter((i) => i.n !== 1 && (verbal || !(ASQ_SKIPPED_WHEN_NONVERBAL as readonly number[]).includes(i.n))).map((i) => i.n);
}

export function scoreAsq(a: AsqAnswers): TeaScore {
  const verbal = a.items["1"] === "sim" ? true : a.items["1"] === "nao" ? false : null;
  const applicable = asqApplicable(a);
  let total = 0;
  let answered = 0;
  for (const n of applicable) {
    const r = a.items[String(n)];
    if (!r) continue;
    answered++;
    const it = ASQ_ITEMS.find((x) => x.n === n)!;
    total += (r === "sim" ? it.sim : it.nao) ?? 0;
  }
  const required = applicable.length + 1; // + pergunta 1
  const answeredWith1 = answered + (verbal === null ? 0 : 1);
  const complete = verbal !== null && answered === applicable.length;
  return {
    instrument: "asq",
    computed: true,
    total,
    max: applicable.length,
    parts: [],
    answered: answeredWith1,
    required,
    complete,
    verbal,
    notes: [
      verbal === false
        ? "A criança não conversa com frases curtas: perguntas 2 a 8 não se aplicam."
        : verbal === true
          ? "A criança conversa com frases curtas."
          : "Responda a pergunta 1 para saber quais perguntas se aplicam.",
      complete ? "Todas as perguntas aplicáveis foram respondidas." : `Faltam ${applicable.length - answered} pergunta(s) aplicável(is).`,
    ],
    reference: {
      notes: TEA_REFERENCE_NOTES.asq,
      reached: [
        { label: "15 pontos ou mais (nota de corte principal do formulário)", value: total >= 15 },
        { label: "Mais de 22 pontos", value: total > 22 },
      ],
    },
  };
}

export function scoreMchat(a: MchatAnswers): TeaScore {
  const vals = Object.values(a.items);
  const sim = vals.filter((v) => v === "sim").length;
  const nao = vals.filter((v) => v === "nao").length;
  return {
    instrument: "mchat",
    computed: false,
    total: null,
    max: null,
    parts: [],
    answered: vals.length,
    required: MCHAT_ITEMS.length,
    complete: vals.length === MCHAT_ITEMS.length,
    counts: { sim, nao },
    notes: ["Pontuação de risco não calculada: falta a direção de cada pergunta (qual resposta indica risco) e a versão do instrumento."],
    reference: { notes: TEA_REFERENCE_NOTES.mchat },
  };
}

export function scoreSrs2(a: Srs2Answers): TeaScore {
  const n = Object.keys(a.items).length;
  return {
    instrument: "srs2",
    computed: false,
    total: null,
    max: null,
    parts: [],
    answered: n,
    required: SRS2_ITEMS.length,
    complete: n === SRS2_ITEMS.length,
    notes: ["Respostas guardadas. A pontuação T e as faixas dependem das tabelas de normas e da lista de itens invertidos da editora."],
    reference: { notes: TEA_REFERENCE_NOTES.srs2 },
  };
}

export function scoreAbc(a: AbcAnswers): TeaScore {
  const byDomain = new Map<AbcDomainCode, { points: number; max: number; marked: number; items: number }>();
  for (const d of ABC_DOMAINS) byDomain.set(d.code, { points: 0, max: 0, marked: 0, items: 0 });
  let total = 0;
  let max = 0;
  let marked = 0;
  for (const it of ABC_TEA_ITEMS) {
    const d = byDomain.get(it.domain)!;
    d.max += it.weight;
    d.items++;
    max += it.weight;
    if (a.items[String(it.n)] === true) {
      d.points += it.weight;
      d.marked++;
      total += it.weight;
      marked++;
    }
  }
  return {
    instrument: "abc",
    computed: true,
    total,
    max,
    parts: ABC_DOMAINS.map((d) => ({ key: d.code, label: d.label, points: byDomain.get(d.code)!.points, max: byDomain.get(d.code)!.max })),
    answered: ABC_TEA_ITEMS.length,
    required: 0, // sem marca = não observado
    complete: true,
    notes: [`${marked} de ${ABC_TEA_ITEMS.length} comportamentos marcados.`, "O sistema não classifica o resultado: os dois critérios de corte do formulário se contradizem."],
    reference: { notes: TEA_REFERENCE_NOTES.abc },
  };
}

export function scoreTea(code: TeaInstrumentCode, answers: unknown): TeaScore {
  const err = validateAnswers(code, answers);
  if (err) throw new Error(err);
  switch (code) {
    case "ata": return scoreAta(answers as AtaAnswers);
    case "asq": return scoreAsq(answers as AsqAnswers);
    case "mchat": return scoreMchat(answers as MchatAnswers);
    case "srs2": return scoreSrs2(answers as Srs2Answers);
    case "abc": return scoreAbc(answers as AbcAnswers);
  }
}

/** Tira a faixa de referência do resultado (usado quando a pessoa não tem a capacidade tea.reference.view). */
export function withoutReference(score: TeaScore): TeaScore {
  const { reference: _r, ...rest } = score;
  return rest;
}
