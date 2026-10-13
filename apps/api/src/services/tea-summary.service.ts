/**
 * Sumário organizado da Triagem TEA (IA com trava).
 *
 * Fluxo: (1) monta um resumo SEM identificador a partir dos formulários enviados; (2) gera sempre uma versão por regras
 * (determinística, não depende de rede); (3) se o assistente (BI_RAG_URL) estiver ligado, pede ao modelo para reorganizar
 * o mesmo conteúdo; (4) revalida a saída do modelo (formato, tamanho, termos proibidos, números inventados) e, se qualquer
 * coisa falhar, devolve a versão por regras. A IA organiza o que a equipe marcou; não diagnostica nem recomenda conduta.
 */
import {
  ABC_DOMAINS,
  ABC_TEA_ITEMS,
  ASQ_ITEMS,
  ATA_GROUPS,
  TEA_INSTRUMENTS,
  scoreTea,
  type AbcAnswers,
  type AsqAnswers,
  type AtaAnswers,
  type TeaInstrumentCode,
} from "@periscopio/shared";

export const TEA_SUMMARY_NOTICE =
  "Resumo organizado automaticamente a partir do que a equipe marcou nos formulários. Não é diagnóstico e não substitui a avaliação do profissional responsável.";

export interface TeaDigestInstrument {
  codigo: TeaInstrumentCode;
  titulo: string;
  completo: boolean;
  /** Totais calculados pela regra do formulário (null quando o sistema não calcula). */
  pontos: { total: number; maximo: number } | null;
  areas: { rotulo: string; pontos: number; maximo: number }[];
  /** Comportamentos / respostas marcados, em texto do próprio formulário. */
  observados: { grupo: string; itens: string[] }[];
  respondidas: number;
  total_itens: number;
  contagens?: { sim: number; nao: number };
  observacao_do_sistema: string[];
}

export interface TeaDigest {
  aviso: string;
  instrumentos: TeaDigestInstrument[];
}

export interface TeaSummary {
  visaoGeral: string;
  porInstrumento: { instrumento: TeaInstrumentCode; titulo: string; pontos: string[] }[];
  lacunas: string[];
  perguntasAoProfissional: string[];
}

export interface SubmittedScreening {
  instrument: TeaInstrumentCode;
  answers: unknown;
}

const MAX_OBSERVED_PER_INSTRUMENT = 60;

export function buildDigest(screenings: SubmittedScreening[]): TeaDigest {
  const instrumentos: TeaDigestInstrument[] = [];
  for (const s of screenings) {
    const meta = TEA_INSTRUMENTS[s.instrument];
    const score = scoreTea(s.instrument, s.answers);
    const observados: { grupo: string; itens: string[] }[] = [];

    if (s.instrument === "ata") {
      const a = s.answers as AtaAnswers;
      for (const g of ATA_GROUPS) {
        const idx = a.marcados[String(g.n)] ?? [];
        if (idx.length) observados.push({ grupo: g.name, itens: idx.map((i) => g.options[i]) });
      }
      if (a.antes36meses === true) observados.push({ grupo: "Início", itens: ["Sinais referidos antes dos 36 meses"] });
    } else if (s.instrument === "asq") {
      const a = s.answers as AsqAnswers;
      const itens: string[] = [];
      for (const it of ASQ_ITEMS) {
        if (it.n === 1) continue;
        const r = a.items[String(it.n)];
        if (!r) continue;
        if ((r === "sim" ? it.sim : it.nao) === 1) itens.push(`(${it.n}) ${it.text}`);
      }
      if (itens.length) observados.push({ grupo: "Respostas que somaram ponto", itens });
    } else if (s.instrument === "abc") {
      const a = s.answers as AbcAnswers;
      for (const d of ABC_DOMAINS) {
        const itens = ABC_TEA_ITEMS.filter((i) => i.domain === d.code && a.items[String(i.n)] === true).map((i) => i.text);
        if (itens.length) observados.push({ grupo: d.label, itens });
      }
    }
    // M-CHAT e SRS-2: sem direção das perguntas / sem tabelas, o sistema não destaca nenhuma resposta.

    let budget = MAX_OBSERVED_PER_INSTRUMENT;
    const capped = observados.map((o) => {
      const itens = o.itens.slice(0, Math.max(0, budget));
      budget -= itens.length;
      return { grupo: o.grupo, itens };
    });

    instrumentos.push({
      codigo: s.instrument,
      titulo: meta.title,
      completo: score.complete,
      pontos: score.computed && score.total !== null && score.max !== null ? { total: score.total, maximo: score.max } : null,
      areas: score.parts.filter((p) => p.points > 0).map((p) => ({ rotulo: p.label, pontos: p.points, maximo: p.max })),
      observados: capped.filter((o) => o.itens.length > 0),
      respondidas: score.answered,
      total_itens: meta.itemCount,
      contagens: score.counts,
      observacao_do_sistema: score.notes,
    });
  }
  return {
    aviso: "Dados sem identificação do aluno. Os pontos são somas de formulário, não diagnóstico.",
    instrumentos,
  };
}

/** Versão por regras: sempre disponível, sem rede e sem modelo. */
export function deterministicSummary(digest: TeaDigest): TeaSummary {
  const n = digest.instrumentos.length;
  const lacunas: string[] = [];
  const porInstrumento = digest.instrumentos.map((i) => {
    const pontos: string[] = [];
    if (i.pontos) pontos.push(`Soma pela regra do formulário: ${i.pontos.total} de ${i.pontos.maximo} pontos.`);
    else pontos.push("O sistema não calcula pontuação para este instrumento; as respostas estão guardadas para o profissional.");
    if (i.areas.length) pontos.push("Áreas com pontos: " + i.areas.map((a) => `${a.rotulo} (${a.pontos})`).join("; ") + ".");
    for (const o of i.observados) {
      pontos.push(`${o.grupo}: ${o.itens.join("; ")}.`);
    }
    if (i.contagens) pontos.push(`Respostas Sim: ${i.contagens.sim}; Não: ${i.contagens.nao}.`);
    if (!i.completo) lacunas.push(`${i.titulo}: respostas incompletas (${i.respondidas} de ${i.total_itens}).`);
    if (i.pontos === null) lacunas.push(`${i.titulo}: sem pontuação calculada pelo sistema (regra ou tabela do instrumento pendente de validação).`);
    return { instrumento: i.codigo, titulo: i.titulo, pontos: pontos.map((p) => clip(p)) };
  });
  const faltando = (Object.keys(TEA_INSTRUMENTS) as TeaInstrumentCode[]).filter((c) => !digest.instrumentos.some((i) => i.codigo === c));
  if (faltando.length) lacunas.push("Instrumentos sem envio neste caso: " + faltando.map((c) => TEA_INSTRUMENTS[c].shortTitle).join(", ") + ".");
  return {
    visaoGeral:
      n === 0
        ? "Nenhum instrumento da triagem foi enviado ainda."
        : `Foram enviados ${n} de 5 instrumentos da triagem. Abaixo, o que a equipe marcou, organizado por instrumento.`,
    porInstrumento,
    lacunas,
    perguntasAoProfissional: [
      "Os comportamentos marcados pela família e pela escola são coerentes com o que foi observado na consulta?",
      "Há instrumentos pendentes ou incompletos que precisam ser concluídos antes da decisão?",
      "Quais especialidades precisam aprofundar a avaliação, segundo o seu critério clínico?",
    ],
  };
}

const clip = (s: string, n = 600) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

// ─── trava da saída do modelo ──────────────────────────────────────────────

const BANNED = [
  /diagn[oó]stic/i,
  /laudo/i,
  /\b(é|e|tem|possui|apresenta)\s+(autis|autista|tea\b|tdah)/i,
  /probabilidad/i,
  /\brisco\s+(alto|elevad|baixo|moderad|grave)/i,
  /gravidade|\bgrave\b|\bleve\b|moderad/i,
  /(ponto|nota)\s+de\s+corte/i,
  /recomend|sugere-se|sugerimos|indicamos|deve-se|deve ser encaminh/i,
  /tratament|medica[çc]|prescri|terapia indicada|interven[çc][ãa]o indicada/i,
  /conduta\s+(cl[ií]nica|terap|recomend|sugerid|indicad)/i,
  /confirm(a|ado|ada)\s+(tea|autismo)/i,
];

export function sanitizeLlmSummary(raw: unknown, digest: TeaDigest): TeaSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim().length > 0 && v.length <= max ? v.trim() : null);
  const list = (v: unknown, maxItems: number, maxLen: number): string[] | null => {
    if (!Array.isArray(v) || v.length > maxItems) return null;
    const out: string[] = [];
    for (const x of v) {
      const s = str(x, maxLen);
      if (!s) return null;
      out.push(s);
    }
    return out;
  };

  const visao = str(r.visao_geral, 700);
  const lacunas = list(r.lacunas ?? [], 12, 300);
  const perguntas = list(r.perguntas_ao_profissional ?? [], 8, 300);
  if (!visao || !lacunas || !perguntas || !Array.isArray(r.por_instrumento) || r.por_instrumento.length > 5) return null;

  const porInstrumento: TeaSummary["porInstrumento"] = [];
  for (const p of r.por_instrumento as Record<string, unknown>[]) {
    const code = p?.instrumento as TeaInstrumentCode;
    const known = digest.instrumentos.find((i) => i.codigo === code);
    const pontos = list(p?.pontos, 20, 500);
    if (!known || !pontos) return null;
    porInstrumento.push({ instrumento: code, titulo: known.titulo, pontos });
  }

  const everything = [visao, ...lacunas, ...perguntas, ...porInstrumento.flatMap((p) => p.pontos)].join("\n");
  if (BANNED.some((re) => re.test(everything))) return null;

  // Números inventados: todo número do texto precisa existir no resumo enviado.
  const source = JSON.stringify(digest);
  for (const m of everything.match(/\d+/g) ?? []) {
    if (!new RegExp(`(^|\\D)${m}(\\D|$)`).test(source)) return null;
  }
  return { visaoGeral: visao, porInstrumento, lacunas, perguntasAoProfissional: perguntas };
}

// ─── chamada ao assistente (opcional) ──────────────────────────────────────

async function callTeaRag(digest: TeaDigest): Promise<unknown | null> {
  const base = process.env.BI_RAG_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/summarize-tea`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-service-token": process.env.BI_RAG_TOKEN ?? "" },
      body: JSON.stringify({ digest }),
      signal: AbortSignal.timeout(45_000), // serviço gratuito pode estar dormindo (cold start)
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { summary?: unknown };
    return data.summary ?? null;
  } catch {
    return null;
  }
}

export async function summarizeTea(screenings: SubmittedScreening[]): Promise<{ summary: TeaSummary; source: "ia" | "regras"; notice: string }> {
  const digest = buildDigest(screenings);
  const rules = deterministicSummary(digest);
  if (digest.instrumentos.length === 0) return { summary: rules, source: "regras", notice: TEA_SUMMARY_NOTICE };
  const raw = await callTeaRag(digest);
  const checked = raw ? sanitizeLlmSummary(raw, digest) : null;
  if (!checked) return { summary: rules, source: "regras", notice: TEA_SUMMARY_NOTICE };
  // Lacunas calculadas pelas regras nunca são perdidas, mesmo que o modelo as omita.
  const lacunas = [...new Set([...rules.lacunas, ...checked.lacunas])];
  return { summary: { ...checked, lacunas }, source: "ia", notice: TEA_SUMMARY_NOTICE };
}
