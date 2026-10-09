/**
 * Camada semântica do BI do gestor.
 *
 * Regras de privacidade (valem para tela, API e assistente):
 *  - só existem métricas e dimensões da lista abaixo; nada de SQL livre e nada de campo individual;
 *  - aluno aparece apenas como contagem (nunca nome, código ou data de nascimento);
 *  - célula com 1 a 4 casos é ocultada ("<5"); média com menos de 5 casos também;
 *  - total só é informado quando nenhuma célula foi ocultada (evita subtração).
 * Isto é aritmética de gestão, não critério clínico.
 */
import { z } from "zod";

export const SMALL_CELL = 5;

export const DIMENSIONS = {
  school: "Escola",
  age_bracket: "Faixa etária do aluno",
  journey_state: "Etapa da jornada do caso",
  month: "Mês",
  specialty: "Especialidade",
  delegation_status: "Situação da delegação",
  age_band: "Faixa etária (base populacional)",
  complaint: "Queixa registrada (base populacional)",
  service: "Serviço",
} as const;
export type DimId = keyof typeof DIMENSIONS;

export const JOURNEY_STATES = ["rascunho", "enviado_re", "revisao_medica", "delegado", "retornado", "encerrado"] as const;
export const JOURNEY_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  enviado_re: "Enviado pelo RE",
  revisao_medica: "Em revisão médica",
  delegado: "Delegado a especialistas",
  retornado: "Retornado ao médico",
  encerrado: "Encerrado",
};
export const AGE_BRACKETS = ["00-05", "06-09", "10-12", "13-17", "18+"] as const;
export const SPECIALTIES = [
  "fonoaudiologia",
  "medicina",
  "psicologia",
  "psicopedagogia",
  "psicomotricidade",
  "servico_social",
] as const;

export const METRIC_IDS = [
  "students",
  "cases",
  "case_cycle_days",
  "delegations",
  "population_total",
  "population_by_age",
  "population_by_complaint",
  "population_by_service",
  "professionals_needed",
] as const;
export type MetricId = (typeof METRIC_IDS)[number];

export interface MetricDef {
  id: MetricId;
  label: string;
  description: string;
  unit: "alunos" | "casos" | "dias" | "delegações" | "profissionais (equivalente a tempo integral)";
  additive: boolean;
  dims: DimId[];
  filters: ("schoolId" | "ageBracket" | "journeyState" | "specialty" | "from" | "to")[];
  source: "live" | "population";
  synonyms: string[];
}

export const METRICS: MetricDef[] = [
  {
    id: "students",
    label: "Alunos cadastrados",
    description: "Quantidade de alunos pseudonimizados cadastrados nas escolas.",
    unit: "alunos",
    additive: true,
    dims: ["school", "age_bracket", "month"],
    filters: ["schoolId", "ageBracket", "from", "to"],
    source: "live",
    synonyms: ["alunos", "estudantes", "criancas", "cadastrados", "matriculados cadastrados"],
  },
  {
    id: "cases",
    label: "Casos abertos",
    description: "Casos na jornada Professor → RE → Médico → Especialistas → Médico.",
    unit: "casos",
    additive: true,
    dims: ["school", "age_bracket", "journey_state", "month"],
    filters: ["schoolId", "ageBracket", "journeyState", "from", "to"],
    source: "live",
    synonyms: ["casos", "jornada", "andamento", "fila", "etapa"],
  },
  {
    id: "case_cycle_days",
    label: "Tempo médio até o encerramento",
    description: "Média de dias entre a abertura e o encerramento, só de casos encerrados.",
    unit: "dias",
    additive: false,
    dims: ["school", "age_bracket", "month"],
    filters: ["schoolId", "ageBracket", "from", "to"],
    source: "live",
    synonyms: ["tempo medio", "dias", "demora", "prazo", "duracao", "ciclo", "encerramento"],
  },
  {
    id: "delegations",
    label: "Delegações a especialistas",
    description: "Seções do prontuário delegadas por especialidade e situação.",
    unit: "delegações",
    additive: true,
    dims: ["school", "specialty", "delegation_status", "month"],
    filters: ["schoolId", "specialty", "from", "to"],
    source: "live",
    synonyms: ["delegacoes", "delegado", "especialidade", "especialistas", "secoes"],
  },
  {
    id: "population_total",
    label: "Casos registrados na base populacional",
    description: "Total de casos por escola na base agregada (ex.: Tarumã).",
    unit: "casos",
    additive: true,
    dims: ["school"],
    filters: ["schoolId"],
    source: "population",
    synonyms: ["base populacional", "taruma", "prevalencia", "casos registrados", "populacao"],
  },
  {
    id: "population_by_age",
    label: "Base populacional por faixa etária",
    description: "Casos da base agregada por faixa etária.",
    unit: "casos",
    additive: true,
    dims: ["school", "age_band"],
    filters: ["schoolId"],
    source: "population",
    synonyms: ["idade", "faixa etaria", "idades"],
  },
  {
    id: "population_by_complaint",
    label: "Base populacional por queixa registrada",
    description: "Queixas registradas na base agregada. Um caso pode ter mais de uma queixa, então as linhas não somam o total.",
    unit: "casos",
    additive: false,
    dims: ["school", "complaint"],
    filters: ["schoolId"],
    source: "population",
    synonyms: ["queixa", "queixas", "motivo", "motivos", "problema", "dificuldade"],
  },
  {
    id: "population_by_service",
    label: "Demanda por serviço (base populacional)",
    description: "Casos que demandam cada serviço na base agregada. Um caso pode demandar mais de um serviço.",
    unit: "casos",
    additive: false,
    dims: ["school", "service"],
    filters: ["schoolId"],
    source: "population",
    synonyms: ["demanda", "servico", "servicos", "fono", "psicoterapia", "atendimento"],
  },
  {
    id: "professionals_needed",
    label: "Profissionais necessários (estimativa)",
    description:
      "Demanda registrada ÷ capacidade por profissional. Capacidades provisórias e editáveis; não é critério clínico.",
    unit: "profissionais (equivalente a tempo integral)",
    additive: true,
    dims: ["school", "service"],
    filters: ["schoolId"],
    source: "population",
    synonyms: ["profissionais", "necessarios", "contratar", "equipe", "quantos profissionais", "capacidade"],
  },
];

export const METRIC_BY_ID = Object.fromEntries(METRICS.map((m) => [m.id, m])) as Record<MetricId, MetricDef>;

const ym = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const planSchema = z
  .object({
    metric: z.enum(METRIC_IDS),
    groupBy: z.array(z.enum(Object.keys(DIMENSIONS) as [DimId, ...DimId[]])).max(2).default([]),
    filters: z
      .object({
        schoolId: z.string().uuid().optional(),
        ageBracket: z.enum(AGE_BRACKETS).optional(),
        journeyState: z.enum(JOURNEY_STATES).optional(),
        specialty: z.enum(SPECIALTIES).optional(),
        from: ym.optional(),
        to: ym.optional(),
      })
      .strict()
      .default({}),
    viz: z.enum(["table", "bar", "line"]).optional(),
    capacity: z.record(z.number().min(1).max(1000)).optional(),
  })
  .strict();
export type QueryPlan = z.infer<typeof planSchema>;

/** Valida o plano contra a definição da métrica. Devolve mensagem de erro ou null. */
export function checkPlan(plan: QueryPlan): string | null {
  const m = METRIC_BY_ID[plan.metric];
  if (new Set(plan.groupBy).size !== plan.groupBy.length) return "Agrupamento repetido";
  for (const d of plan.groupBy) {
    if (!m.dims.includes(d)) return `"${DIMENSIONS[d]}" não está disponível para "${m.label}"`;
  }
  for (const k of Object.keys(plan.filters) as (keyof QueryPlan["filters"])[]) {
    if (plan.filters[k] !== undefined && !m.filters.includes(k)) return `Filtro "${k}" não existe para "${m.label}"`;
  }
  const must: Partial<Record<MetricId, DimId>> = {
    population_by_age: "age_band",
    population_by_complaint: "complaint",
    population_by_service: "service",
  };
  const need = must[plan.metric];
  if (need && !plan.groupBy.includes(need)) return `"${m.label}" precisa ser agrupado por "${DIMENSIONS[need]}"`;
  const { from, to } = plan.filters;
  if (from && to && from > to) return "Período inválido: início depois do fim";
  return null;
}

/** Linha de fato já sem identificador de pessoa. `value` null = já suprimido na origem. */
export interface Fact {
  schoolId: string | null;
  dims: Partial<Record<DimId, string>>;
  value: number | null;
}

export interface ResultRow {
  dims: Record<string, string>;
  value: number | null;
  suppressed: boolean;
  /** Para médias: quantidade de casos que entrou na média (só informado quando ≥ 5). */
  n?: number;
}

export interface QueryResult {
  metric: MetricId;
  label: string;
  unit: string;
  groupBy: DimId[];
  groupLabels: string[];
  rows: ResultRow[];
  total: number | null;
  suppressedCount: number;
  additive: boolean;
  viz: "table" | "bar" | "line";
  notes: string[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function defaultViz(plan: QueryPlan): "table" | "bar" | "line" {
  if (plan.viz) return plan.viz;
  if (plan.groupBy.length === 1 && plan.groupBy[0] === "month") return "line";
  if (plan.groupBy.length === 1) return "bar";
  return "table";
}

/** Executa o plano sobre fatos. Função pura: toda a regra de privacidade fica aqui. */
export function runPlan(facts: Fact[], plan: QueryPlan, extra?: { counts?: Map<string, number> }): QueryResult {
  const m = METRIC_BY_ID[plan.metric];
  const f = plan.filters;
  const kept = facts.filter((x) => {
    if (f.schoolId && x.schoolId !== f.schoolId) return false;
    if (f.ageBracket && x.dims.age_bracket !== f.ageBracket) return false;
    if (f.journeyState && x.dims.journey_state !== f.journeyState) return false;
    if (f.specialty && x.dims.specialty !== f.specialty) return false;
    if (f.from && (!x.dims.month || x.dims.month < f.from)) return false;
    if (f.to && (!x.dims.month || x.dims.month > f.to)) return false;
    return true;
  });

  type Acc = { dims: Record<string, string>; sum: number; n: number; nullSeen: boolean };
  const groups = new Map<string, Acc>();
  for (const x of kept) {
    const dims: Record<string, string> = {};
    for (const d of plan.groupBy) dims[d] = x.dims[d] ?? "Sem informação";
    const key = plan.groupBy.map((d) => dims[d]).join("\u0001");
    const g = groups.get(key) ?? { dims, sum: 0, n: 0, nullSeen: false };
    if (x.value == null) g.nullSeen = true;
    else {
      g.sum += x.value;
      g.n += 1;
    }
    groups.set(key, g);
  }

  const rows: ResultRow[] = [];
  for (const g of groups.values()) {
    if (plan.metric === "case_cycle_days") {
      const suppressed = g.n < SMALL_CELL;
      rows.push({ dims: g.dims, value: suppressed ? null : round1(g.sum / g.n), suppressed, ...(suppressed ? {} : { n: g.n }) });
      continue;
    }
    const isCount = m.source === "live";
    const value = g.nullSeen ? null : round1(g.sum);
    // Em contagens vivas a regra é aplicada aqui; na base populacional o valor já veio suprimido da origem.
    const suppressed = value == null || (isCount && value > 0 && value < SMALL_CELL);
    rows.push({ dims: g.dims, value: suppressed ? null : value, suppressed });
  }

  rows.sort((a, b) => {
    if (plan.groupBy.includes("month")) {
      return String(a.dims.month).localeCompare(String(b.dims.month));
    }
    return (b.value ?? -1) - (a.value ?? -1);
  });

  const suppressedCount = rows.filter((r) => r.suppressed).length;
  const total =
    m.additive && suppressedCount === 0 && rows.length > 0 ? round1(rows.reduce((s, r) => s + (r.value ?? 0), 0)) : null;

  const notes: string[] = [];
  if (suppressedCount > 0) notes.push(`${suppressedCount} grupo(s) com menos de ${SMALL_CELL} casos foram ocultados ("<5") para proteger os alunos.`);
  if (!m.additive && plan.metric !== "case_cycle_days") notes.push("Um caso pode aparecer em mais de uma linha; por isso não há total somado.");
  if (plan.metric === "professionals_needed") notes.push("Estimativa de gestão com capacidades provisórias; não é critério clínico.");
  if (m.source === "population" && suppressedCount > 0 && plan.metric === "professionals_needed")
    notes.push("Com grupos ocultados, o total de profissionais é um mínimo e não é exibido.");
  if (rows.length === 0) notes.push("Nenhum dado para esse recorte.");
  void extra;

  return {
    metric: m.id,
    label: m.label,
    unit: m.unit,
    groupBy: plan.groupBy,
    groupLabels: plan.groupBy.map((d) => DIMENSIONS[d]),
    rows,
    total,
    suppressedCount,
    additive: m.additive,
    viz: defaultViz(plan),
    notes,
  };
}

/** Remove dados pessoais digitados na pergunta antes de guardar ou enviar ao assistente. */
export function scrubQuestion(q: string): { text: string; scrubbed: boolean } {
  let scrubbed = false;
  const rep = (re: RegExp, to: string) => {
    q = q.replace(re, () => {
      scrubbed = true;
      return to;
    });
  };
  rep(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[documento removido]");
  rep(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[e-mail removido]");
  rep(/\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, "[telefone removido]");
  rep(/\b\d{9,}\b/g, "[número removido]");
  return { text: q.trim().slice(0, 500), scrubbed };
}

export const GLOSSARY: Record<string, string> = {
  "<5": "Grupo com menos de 5 casos, ocultado para impedir identificar crianças.",
  "Faixa etária do aluno": "Calculada do ano de nascimento informado no cadastro; o sistema não guarda data completa.",
  "Etapa da jornada": "Rascunho, enviado pelo RE, revisão médica, delegado, retornado ou encerrado.",
  "Profissionais necessários": "Demanda registrada dividida pela capacidade de atendimento por profissional (editável).",
};
