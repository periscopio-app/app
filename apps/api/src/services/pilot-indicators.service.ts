/**
 * Indicadores de avaliação do piloto (proposta institucional, seção "Da avaliação").
 *
 * Este arquivo é PURO (sem banco): recebe fatos já filtrados pelo escopo do usuário e devolve números.
 * Assim a regra de cálculo fica num lugar só, testável, e a Dra. consegue revisar as definições.
 *
 * Regras de segurança do produto que valem aqui:
 *  - Nenhum rótulo clínico é calculado. Não há "melhora", "estabilizou", "positivo" por escore.
 *    O indicador 5 mostra só a variação bruta da contagem que a fonte permite calcular (SNAP-IV, itens 1 a 9).
 *  - A alta continua sendo decisão do médico: aqui só contamos o que ele registrou (case:closed).
 *  - Grupos pequenos viram "<5" (mesmo limite do BI do gestor). Há supressão complementar para que o valor
 *    oculto não possa ser recuperado por subtração.
 *  - As definições abaixo são PROPOSTAS (status "proposta"): o texto da proposta institucional diz que os critérios
 *    de cálculo "deverão ser definidos no planejamento da implantação". Cada pendência está listada em `pendencias`.
 */
import { SMALL_CELL } from "./bi-semantic.service";

export { SMALL_CELL };

// ─── definições (o que a tela mostra ao lado de cada número) ────────────────

export type IndicatorId = "capacitacao" | "rastreio" | "acesso" | "desfecho" | "estabilizacao";

export interface IndicatorDef {
  id: IndicatorId;
  ordem: number;
  titulo: string;
  /** Texto da proposta institucional (sem alterar o sentido). */
  enunciado: string;
  numerador: string;
  denominador: string;
  fonte: string;
  status: "proposta";
  /** Perguntas para validação clínica/gestão. Enquanto abertas, o número é "proposto", não "oficial". */
  pendencias: string[];
}

export const INDICATOR_DEFS: IndicatorDef[] = [
  {
    id: "capacitacao",
    ordem: 1,
    titulo: "Capacitação",
    enunciado: "Percentual dos educadores que concluíram a capacitação.",
    numerador: "Educadores da escola (professores e RE) que concluíram todos os cursos obrigatórios.",
    denominador: "Educadores cadastrados na escola (professores e RE).",
    fonte: "Cadastro de usuários + matrículas e conclusões do LMS.",
    status: "proposta",
    pendencias: [
      "Quais cursos são obrigatórios para contar como capacitado? (hoje: todos os cursos do catálogo, ou a lista em PILOT_REQUIRED_COURSE_IDS).",
      "Quem entra como educador: apenas professor e RE, ou também a gestão escolar?",
    ],
  },
  {
    id: "rastreio",
    ordem: 2,
    titulo: "Rastreio positivo",
    enunciado: "Percentual de alunos com sinais de dificuldades emocionais ou comportamentais persistentes na escola.",
    numerador: "Alunos cujo FOGAP foi enviado pelo RE ao médico (o FOGAP registra os comportamentos observados por 6 meses).",
    denominador: "Alunos matriculados informados no cadastro da escola.",
    fonte: "Máquina de estados do caso (envio do FOGAP) + matrícula da escola.",
    status: "proposta",
    pendencias: [
      "Rastreio positivo = FOGAP enviado ao médico? Ou existe um critério de corte? (o sistema não calcula escore do FOGAP.)",
      "A matrícula usada como denominador deve ser só a faixa do piloto (6 a 9 anos)? Hoje é a matrícula total da escola.",
    ],
  },
  {
    id: "acesso",
    ordem: 3,
    titulo: "Acesso ao núcleo",
    enunciado: "Taxa de acesso ao núcleo para a primeira avaliação.",
    numerador: "Casos encaminhados que já tiveram a primeira avaliação médica registrada (o médico avaliou e delegou).",
    denominador: "Casos encaminhados ao núcleo (FOGAP enviado).",
    fonte: "Transições do caso (enviado_re → delegado).",
    status: "proposta",
    pendencias: [
      "A primeira avaliação do núcleo é a avaliação médica com delegação? Ou a primeira consulta presencial (que o sistema ainda não registra)?",
      "Existe um prazo-alvo (por exemplo, 30 dias) para contar como acesso oportuno?",
    ],
  },
  {
    id: "desfecho",
    ordem: 4,
    titulo: "Adesão, abandono e alta",
    enunciado: "Adesão, abandono e alta: avaliação de taxas.",
    numerador: "Casos por desfecho registrado pelo médico: alta, abandono, interrupção justificada, encaminhamento, acompanhamento; e em atendimento.",
    denominador: "Casos que acessaram o núcleo (primeira avaliação registrada).",
    fonte: "Encerramento do caso (case:closed) e estado atual da jornada.",
    status: "proposta",
    pendencias: [
      "Adesão = casos sem abandono e sem interrupção justificada? Ou a interrupção justificada conta como adesão?",
      "Casos em atendimento entram no denominador das taxas ou só os encerrados?",
    ],
  },
  {
    id: "estabilizacao",
    ordem: 5,
    titulo: "Estabilização do transtorno",
    enunciado: "Comparação entre a avaliação inicial e a reavaliação de sintomas ao final do ano letivo, pelo núcleo e pela escola.",
    numerador: "Casos com a medida inicial e a reavaliação da mesma origem (escola ou núcleo).",
    denominador: "Casos que acessaram o núcleo.",
    fonte: "Medidas de sintomas registradas (SNAP-IV, itens 1 a 9 marcados Bastante ou Demais).",
    status: "proposta",
    pendencias: [
      "Qual é o critério de estabilização? Sem ele, o sistema mostra só se a contagem foi menor, igual ou maior, sem interpretar o resultado.",
      "Quais instrumentos entram além do SNAP-IV? Só o bloco de itens 1 a 9 tem regra de contagem na fonte; os itens 12 a 18 estão ausentes.",
      "Quando é a data da reavaliação final do ano letivo?",
    ],
  },
];

/** Comparador histórico do programa analógico (documento institucional, 531 crianças, 2015–2025). Não é meta. */
export const HISTORICAL_REFERENCE = {
  fonte: "Proposta institucional: programa analógico 2015–2025 (531 crianças tratadas pelo núcleo).",
  abandono: 15.5,
  interrupcaoJustificada: 8,
  alta: 61.5,
  nota: "O restante seguia em acompanhamento. Comparador de contexto, não meta nem critério de qualidade.",
} as const;

// ─── supressão ──────────────────────────────────────────────────────────────

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface CountCell {
  value: number | null;
  suppressed: boolean;
}

/** Contagem de pessoas (alunos): 1 a 4 vira "<5". Zero aparece como zero. */
export function guardCount(n: number): CountCell {
  return n > 0 && n < SMALL_CELL ? { value: null, suppressed: true } : { value: n, suppressed: false };
}

export interface PercentCell {
  /** Percentual 0–100 com 1 casa; null se oculto ou sem denominador válido. */
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  suppressed: boolean;
  /** Por que não há número (para a tela explicar). */
  reason?: "grupo_pequeno" | "sem_denominador";
}

/**
 * Percentual protegido. Oculta quando:
 *  - o denominador é menor que 5 (grupo pequeno);
 *  - o numerador ou o complemento (den − num) está entre 1 e 4, porque o par numerador/denominador entregaria o outro.
 * Denominador zero ou ausente → "sem denominador" (prevalência só com denominador válido).
 */
export function guardPercent(numerator: number, denominator: number | null, opts: { aluno: boolean } = { aluno: true }): PercentCell {
  if (denominator == null || denominator <= 0) {
    return { value: null, numerator: null, denominator: null, suppressed: false, reason: "sem_denominador" };
  }
  if (opts.aluno) {
    const complement = denominator - numerator;
    const small = (n: number) => n > 0 && n < SMALL_CELL;
    if (denominator < SMALL_CELL || small(numerator) || small(complement)) {
      return { value: null, numerator: null, denominator: denominator < SMALL_CELL ? null : denominator, suppressed: true, reason: "grupo_pequeno" };
    }
  }
  return { value: round1((numerator / denominator) * 100), numerator, denominator, suppressed: false };
}

/**
 * Supressão complementar de um conjunto de categorias que somam o total: se só UMA categoria foi ocultada,
 * a diferença para o total a revelaria; então oculta também a menor categoria visível.
 */
export function suppressBuckets<K extends string>(counts: Record<K, number>): Record<K, CountCell> {
  const keys = Object.keys(counts) as K[];
  const out = {} as Record<K, CountCell>;
  for (const k of keys) out[k] = guardCount(counts[k]);
  const hidden = keys.filter((k) => out[k].suppressed);
  if (hidden.length === 1) {
    const visible = keys.filter((k) => !out[k].suppressed && counts[k] > 0).sort((a, b) => counts[a] - counts[b]);
    if (visible[0]) out[visible[0]] = { value: null, suppressed: true };
  }
  return out;
}

// ─── fatos de entrada ───────────────────────────────────────────────────────

export type ClosingDecision = "encaminhamento" | "acompanhamento" | "alta" | "abandono" | "interrupcao_justificada";
export type MeasurePhase = "inicial" | "reavaliacao";
export type MeasureSource = "escola" | "nucleo";

export interface MeasureFact {
  phase: MeasurePhase;
  source: MeasureSource;
  markedCount: number;
  itemsTotal: number;
  appliedOn: string; // yyyy-mm-dd
}

export interface CaseFact {
  caseId: string;
  studentId: string;
  studentCode: string;
  schoolId: string;
  ageBracket: string | null;
  journeyState: string;
  createdAt: Date;
  /** Primeira vez que o RE enviou o FOGAP (transição para enviado_re). */
  sentAt: Date | null;
  /** Primeira avaliação médica com delegação (transição para delegado). */
  firstEvaluationAt: Date | null;
  closedAt: Date | null;
  decision: ClosingDecision | null;
  followUp: "semestral" | "anual" | null;
  /** Medidas já reduzidas à mais recente por (fase, origem). */
  measures: MeasureFact[];
}

export interface EducatorFact {
  userId: string;
  schoolId: string;
}

export interface EnrollmentFact {
  userId: string;
  courseId: string;
  progress: number;
  completedAt: Date | null;
}

export interface SchoolFact {
  id: string;
  name: string;
  enrollment: number | null;
  isControlGroup: boolean;
}

// ─── cálculos ───────────────────────────────────────────────────────────────

export interface CapacitacaoResult {
  educadores: number;
  concluiram: number;
  emAndamento: number;
  naoIniciaram: number;
  percentual: PercentCell;
  cursosObrigatorios: number;
  catalogoVazio: boolean;
}

/** Não há dado de criança aqui (são profissionais), então não há supressão de grupo pequeno. */
export function computeCapacitacao(
  educators: EducatorFact[],
  requiredCourseIds: string[],
  enrollments: EnrollmentFact[],
): CapacitacaoResult {
  const required = new Set(requiredCourseIds);
  const byUser = new Map<string, EnrollmentFact[]>();
  for (const e of enrollments) {
    if (!required.has(e.courseId)) continue;
    const list = byUser.get(e.userId) ?? [];
    list.push(e);
    byUser.set(e.userId, list);
  }
  let concluiram = 0;
  let emAndamento = 0;
  let naoIniciaram = 0;
  for (const ed of educators) {
    const mine = byUser.get(ed.userId) ?? [];
    const doneCourses = new Set(mine.filter((e) => e.completedAt).map((e) => e.courseId));
    if (required.size > 0 && [...required].every((c) => doneCourses.has(c))) concluiram++;
    else if (mine.some((e) => e.completedAt || e.progress > 0)) emAndamento++;
    else naoIniciaram++;
  }
  const total = educators.length;
  return {
    educadores: total,
    concluiram,
    emAndamento,
    naoIniciaram,
    percentual: guardPercent(concluiram, total, { aluno: false }),
    cursosObrigatorios: required.size,
    catalogoVazio: required.size === 0,
  };
}

export interface RastreioResult {
  matricula: number | null;
  casosAbertos: CountCell;
  fogapEnviado: CountCell;
  percentual: PercentCell;
}

const distinctStudents = (cases: CaseFact[]) => new Set(cases.map((c) => c.studentId)).size;

export function computeRastreio(cases: CaseFact[], matricula: number | null): RastreioResult {
  const abertos = distinctStudents(cases);
  const enviados = distinctStudents(cases.filter((c) => c.sentAt));
  return {
    matricula,
    casosAbertos: guardCount(abertos),
    fogapEnviado: guardCount(enviados),
    percentual: guardPercent(enviados, matricula),
  };
}

const DAY_MS = 86_400_000;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export interface AcessoResult {
  encaminhados: CountCell;
  acessaram: CountCell;
  aguardando: CountCell;
  percentual: PercentCell;
  /** Dias entre o envio do FOGAP e a primeira avaliação. Só com 5 ou mais casos. */
  medianaDias: number | null;
}

export function computeAcesso(cases: CaseFact[]): AcessoResult {
  const sent = cases.filter((c) => c.sentAt);
  const accessed = sent.filter((c) => c.firstEvaluationAt);
  const waiting = sent.length - accessed.length;
  const days = accessed.map((c) => Math.max(0, (c.firstEvaluationAt!.getTime() - c.sentAt!.getTime()) / DAY_MS));
  const pct = guardPercent(accessed.length, sent.length);
  const cells = suppressBuckets({ acessaram: accessed.length, aguardando: waiting });
  return {
    encaminhados: guardCount(sent.length),
    acessaram: cells.acessaram,
    aguardando: cells.aguardando,
    percentual: pct,
    medianaDias: accessed.length >= SMALL_CELL ? round1(median(days)!) : null,
  };
}

export type DesfechoKey = "alta" | "abandono" | "interrupcao_justificada" | "encaminhamento" | "acompanhamento" | "em_atendimento";

export const DESFECHO_LABELS: Record<DesfechoKey, string> = {
  alta: "Alta",
  abandono: "Abandono",
  interrupcao_justificada: "Interrupção justificada",
  encaminhamento: "Encaminhamento",
  acompanhamento: "Acompanhamento (semestral/anual)",
  em_atendimento: "Em atendimento",
};

export interface DesfechoResult {
  admitidos: CountCell;
  categorias: Record<DesfechoKey, CountCell>;
  taxas: { adesao: PercentCell; abandono: PercentCell; alta: PercentCell };
}

export function desfechoOf(c: CaseFact): DesfechoKey {
  if (c.journeyState === "encerrado" && c.decision) return c.decision;
  return "em_atendimento";
}

export function computeDesfecho(cases: CaseFact[]): DesfechoResult {
  const admitted = cases.filter((c) => c.firstEvaluationAt);
  const counts: Record<DesfechoKey, number> = {
    alta: 0, abandono: 0, interrupcao_justificada: 0, encaminhamento: 0, acompanhamento: 0, em_atendimento: 0,
  };
  for (const c of admitted) counts[desfechoOf(c)]++;
  const n = admitted.length;
  const adesao = n - counts.abandono - counts.interrupcao_justificada;
  return {
    admitidos: guardCount(n),
    categorias: suppressBuckets(counts),
    taxas: {
      adesao: guardPercent(adesao, n),
      abandono: guardPercent(counts.abandono, n),
      alta: guardPercent(counts.alta, n),
    },
  };
}

export type VariationKey = "menos_itens" | "igual" | "mais_itens";

export const VARIATION_LABELS: Record<VariationKey, string> = {
  menos_itens: "Menos itens marcados",
  igual: "Mesma contagem",
  mais_itens: "Mais itens marcados",
};

export interface SourcePair {
  inicial: number | null;
  reavaliacao: number | null;
  itemsTotal: number | null;
  /** reavaliação − inicial; negativo = menos itens marcados. Não é "melhora". */
  variacao: number | null;
  direcao: VariationKey | null;
}

export function pairFor(measures: MeasureFact[], source: MeasureSource): SourcePair {
  const ini = measures.find((m) => m.source === source && m.phase === "inicial");
  const rea = measures.find((m) => m.source === source && m.phase === "reavaliacao");
  const variacao = ini && rea ? rea.markedCount - ini.markedCount : null;
  return {
    inicial: ini?.markedCount ?? null,
    reavaliacao: rea?.markedCount ?? null,
    itemsTotal: ini?.itemsTotal ?? rea?.itemsTotal ?? null,
    variacao,
    direcao: variacao == null ? null : variacao < 0 ? "menos_itens" : variacao > 0 ? "mais_itens" : "igual",
  };
}

export interface EstabilizacaoSource {
  comMedidaInicial: CountCell;
  comReavaliacao: CountCell;
  comParCompleto: CountCell;
  percentualComPar: PercentCell;
  direcao: Record<VariationKey, CountCell>;
  /** Média da variação (reavaliação − inicial), só com 5 ou mais pares. */
  variacaoMedia: number | null;
}

export interface EstabilizacaoResult {
  admitidos: CountCell;
  medida: string;
  escola: EstabilizacaoSource;
  nucleo: EstabilizacaoSource;
}

function estabilizacaoSource(admitted: CaseFact[], source: MeasureSource): EstabilizacaoSource {
  const pairs = admitted.map((c) => pairFor(c.measures, source));
  const withInitial = pairs.filter((p) => p.inicial != null).length;
  const withRe = pairs.filter((p) => p.reavaliacao != null).length;
  const complete = pairs.filter((p) => p.variacao != null);
  const dir: Record<VariationKey, number> = { menos_itens: 0, igual: 0, mais_itens: 0 };
  for (const p of complete) dir[p.direcao!]++;
  const mean = complete.length >= SMALL_CELL ? round1(complete.reduce((s, p) => s + p.variacao!, 0) / complete.length) : null;
  return {
    comMedidaInicial: guardCount(withInitial),
    comReavaliacao: guardCount(withRe),
    comParCompleto: guardCount(complete.length),
    percentualComPar: guardPercent(complete.length, admitted.length),
    direcao: suppressBuckets(dir),
    variacaoMedia: mean,
  };
}

export const MEASURE_LABEL = "SNAP-IV: itens 1 a 9 marcados Bastante ou Demais";

export function computeEstabilizacao(cases: CaseFact[]): EstabilizacaoResult {
  const admitted = cases.filter((c) => c.firstEvaluationAt);
  return {
    admitidos: guardCount(admitted.length),
    medida: MEASURE_LABEL,
    escola: estabilizacaoSource(admitted, "escola"),
    nucleo: estabilizacaoSource(admitted, "nucleo"),
  };
}

// ─── visão de um grupo (escola ou rede) ─────────────────────────────────────

export interface GroupIndicators {
  capacitacao: CapacitacaoResult;
  rastreio: RastreioResult;
  acesso: AcessoResult;
  desfecho: DesfechoResult;
  estabilizacao: EstabilizacaoResult;
}

export interface GroupInput {
  cases: CaseFact[];
  educators: EducatorFact[];
  enrollments: EnrollmentFact[];
  requiredCourseIds: string[];
  matricula: number | null;
}

export function computeGroup(input: GroupInput): GroupIndicators {
  return {
    capacitacao: computeCapacitacao(input.educators, input.requiredCourseIds, input.enrollments),
    rastreio: computeRastreio(input.cases, input.matricula),
    acesso: computeAcesso(input.cases),
    desfecho: computeDesfecho(input.cases),
    estabilizacao: computeEstabilizacao(input.cases),
  };
}

// ─── visão individual (um aluno, por código) ────────────────────────────────

export interface StudentCaseView {
  caseId: string;
  journeyState: string;
  abertoEm: string;
  rastreio: { fogapEnviadoEm: string | null };
  acesso: { primeiraAvaliacaoEm: string | null; diasAteAvaliacao: number | null; aguardando: boolean };
  desfecho: { categoria: DesfechoKey; rotulo: string; encerradoEm: string | null; acompanhamento: "semestral" | "anual" | null };
  estabilizacao: { medida: string; escola: SourcePair; nucleo: SourcePair };
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function studentCaseView(c: CaseFact): StudentCaseView {
  const cat = desfechoOf(c);
  const days = c.sentAt && c.firstEvaluationAt ? round1(Math.max(0, (c.firstEvaluationAt.getTime() - c.sentAt.getTime()) / DAY_MS)) : null;
  return {
    caseId: c.caseId,
    journeyState: c.journeyState,
    abertoEm: c.createdAt.toISOString(),
    rastreio: { fogapEnviadoEm: iso(c.sentAt) },
    acesso: { primeiraAvaliacaoEm: iso(c.firstEvaluationAt), diasAteAvaliacao: days, aguardando: !!c.sentAt && !c.firstEvaluationAt },
    desfecho: {
      categoria: cat,
      rotulo: DESFECHO_LABELS[cat],
      encerradoEm: iso(c.closedAt),
      acompanhamento: cat === "acompanhamento" ? c.followUp : null,
    },
    estabilizacao: { medida: MEASURE_LABEL, escola: pairFor(c.measures, "escola"), nucleo: pairFor(c.measures, "nucleo") },
  };
}
