import { and, desc, eq, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import {
  caseSummaries,
  caseTransitions,
  cases,
  expertMeetingRequests,
  lgpdRequests,
  notifications,
  reStepTimings,
  reTimeBaselines,
  students,
  supportTickets,
  teacherObservations,
  users,
} from "@periscopio/shared";
import { db } from "../db/client";
import { PASSOS, mediana } from "./re-observability.service";
import { SMALL_CELL } from "./bi-semantic.service";
import { canonicalRole } from "../security/capabilities";

/**
 * Métricas do "Meu painel": o que cada profissional precisa para melhorar o próprio trabalho.
 *
 * Princípios (iguais aos do resto do produto):
 *  - cada pessoa vê o próprio trabalho; perfis de gestão veem só agregados, com células < 5 ocultas;
 *  - nada de aluno identificável: só contagens, tempos e especialidades;
 *  - nenhum escore, risco, diagnóstico ou "alta automática";
 *  - nenhum ranking nem comparação entre colegas.
 */

export interface Cartao {
  chave: string;
  rotulo: string;
  valor: number | null;
  unidade: string | null;
  ajuda: string;
  /** true quando o grupo é pequeno demais (< 5) para ser mostrado. */
  oculto?: boolean;
}

export interface Tabela {
  chave: string;
  titulo: string;
  colunas: string[];
  linhas: (string | number | null)[][];
}

export interface MetricasPerfil {
  papel: string;
  titulo: string;
  descricao: string;
  cartoes: Cartao[];
  tabelas: Tabela[];
  aviso: string;
  geradoEm: string;
}

export interface MetricasActor {
  id: string;
  tenantId: string;
  schoolId: string | null;
  role: string;
  email?: string;
}

/** Mediana só vale com amostra mínima; abaixo disso a tela diz "poucos casos ainda". */
export const MIN_PARA_MEDIANA = 3;
const AVISO_PADRAO =
  "Indicadores de apoio ao seu trabalho. Não são avaliação de desempenho, não comparam você com colegas e não substituem decisão clínica.";

const DIA_MS = 86_400_000;

// ─── funções puras (testadas sem banco) ──────────────────────────────────────

/** Mediana de uma lista de durações em milissegundos, devolvida em dias com 1 casa. Null com amostra pequena. */
export function medianaEmDias(duracoesMs: number[], minimo = MIN_PARA_MEDIANA): number | null {
  const validas = duracoesMs.filter((d) => Number.isFinite(d) && d >= 0);
  if (validas.length < minimo) return null;
  const minutos = mediana(validas.map((d) => Math.round(d / 60_000)));
  if (minutos === null) return null;
  return Math.round((minutos / 1440) * 10) / 10;
}

/** Mediana em horas com 1 casa. */
export function medianaEmHoras(duracoesMs: number[], minimo = MIN_PARA_MEDIANA): number | null {
  const validas = duracoesMs.filter((d) => Number.isFinite(d) && d >= 0);
  if (validas.length < minimo) return null;
  const minutos = mediana(validas.map((d) => Math.round(d / 60_000)));
  if (minutos === null) return null;
  return Math.round((minutos / 60) * 10) / 10;
}

/** Oculta contagens agregadas pequenas (1 a 4). Zero continua zero. */
export function cartaoAgregado(chave: string, rotulo: string, n: number, ajuda: string, unidade = "casos"): Cartao {
  const oculto = n > 0 && n < SMALL_CELL;
  return { chave, rotulo, valor: oculto ? null : n, unidade, ajuda, oculto };
}

function cartao(chave: string, rotulo: string, valor: number | null, unidade: string | null, ajuda: string): Cartao {
  return { chave, rotulo, valor, unidade, ajuda };
}

export interface TempoPessoalRow {
  caseId: string;
  step: string;
  activeSeconds: number;
}

export interface TempoPessoalResumo {
  casosMedidos: number;
  medianaTotalMin: number | null;
  horasGanhasEstimadas: number | null;
  passos: { step: string; casos: number; medianaMin: number | null; referenciaMin: number | null; ganhoMin: number | null }[];
}

/**
 * Tempo ativo de preenchimento do próprio RE, por parte (A–I), comparado ao tempo de referência do processo em papel.
 * "Tempo ganho" é estimativa: depende do tempo de referência que a gestão informou.
 */
export function resumirTempoPessoal(rows: TempoPessoalRow[], baselines: Partial<Record<string, number>>): TempoPessoalResumo {
  const porPasso = new Map<string, Map<string, number>>();
  const porCaso = new Map<string, number>();
  for (const r of rows) {
    if (!(PASSOS as readonly string[]).includes(r.step)) continue;
    const m = porPasso.get(r.step) ?? new Map<string, number>();
    m.set(r.caseId, (m.get(r.caseId) ?? 0) + r.activeSeconds);
    porPasso.set(r.step, m);
    porCaso.set(r.caseId, (porCaso.get(r.caseId) ?? 0) + r.activeSeconds);
  }

  let ganhoTotalMin = 0;
  let algumGanho = false;
  const passos = PASSOS.filter((s) => porPasso.has(s)).map((step) => {
    const segundos = [...porPasso.get(step)!.values()];
    const casos = segundos.length;
    const medSeg = casos >= MIN_PARA_MEDIANA ? mediana(segundos) : null;
    const medianaMin = medSeg === null ? null : Math.round((medSeg / 60) * 10) / 10;
    const referenciaMin = baselines[step] ?? null;
    const ganhoMin = medianaMin !== null && referenciaMin !== null ? Math.round((referenciaMin - medianaMin) * 10) / 10 : null;
    if (ganhoMin !== null) {
      ganhoTotalMin += ganhoMin * casos;
      algumGanho = true;
    }
    return { step, casos, medianaMin, referenciaMin, ganhoMin };
  });

  const totais = [...porCaso.values()];
  const medTotal = totais.length >= MIN_PARA_MEDIANA ? mediana(totais) : null;
  return {
    casosMedidos: porCaso.size,
    medianaTotalMin: medTotal === null ? null : Math.round((medTotal / 60) * 10) / 10,
    horasGanhasEstimadas: algumGanho ? Math.round((ganhoTotalMin / 60) * 10) / 10 : null,
    passos,
  };
}

const ROTULO_ESTADO: Record<string, string> = {
  rascunho: "Em preenchimento (rascunho)",
  enviado_re: "Enviado ao médico",
  revisao_medica: "Em revisão médica",
  delegado: "Com especialistas",
  retornado: "Retornado ao médico",
  encerrado: "Encerrado",
};
const ORDEM_ESTADOS = ["rascunho", "enviado_re", "revisao_medica", "delegado", "retornado", "encerrado"];

const ROTULO_ESPECIALIDADE: Record<string, string> = {
  fonoaudiologia: "Fonoaudiologia",
  medicina: "Medicina",
  psicologia: "Psicologia",
  neuropsicologia: "Neuropsicologia",
  psicopedagogia: "Psicopedagogia",
  psicomotricidade: "Psicomotricidade",
  servico_social: "Serviço social",
};

const ROTULO_DOMINIO: Record<string, string> = {
  social: "Social",
  crisis: "Crise",
  neuro: "Neuro",
  mental_learning: "Aprendizagem",
};

// ─── consultas ───────────────────────────────────────────────────────────────

async function contagemPorEstado(tenantId: string, schoolId: string | null | undefined, todaRede: boolean) {
  const filtros = [eq(cases.tenantId, tenantId)];
  if (!todaRede) {
    if (!schoolId) return new Map<string, number>();
    filtros.push(eq(students.schoolId, schoolId));
  }
  const rows = await db
    .select({ estado: cases.journeyState, n: sql<number>`count(*)::int` })
    .from(cases)
    .innerJoin(students, eq(cases.studentId, students.id))
    .where(and(...filtros))
    .groupBy(cases.journeyState);
  return new Map(rows.map((r) => [r.estado, Number(r.n)]));
}

function tabelaPorEstado(porEstado: Map<string, number>, agregado: boolean): Tabela {
  return {
    chave: "casos_por_etapa",
    titulo: "Casos por etapa da jornada",
    colunas: ["Etapa", "Casos"],
    linhas: ORDEM_ESTADOS.map((e) => {
      const n = porEstado.get(e) ?? 0;
      return [ROTULO_ESTADO[e]!, agregado && n > 0 && n < SMALL_CELL ? "< 5" : n];
    }),
  };
}

async function notificacoesNaoLidas(actor: MetricasActor): Promise<Cartao> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.recipientId, actor.id), isNull(notifications.readAt), isNull(notifications.dismissedAt)));
  return cartao("avisos_nao_lidos", "Avisos não lidos", Number(r?.n ?? 0), "avisos", "Avisos da plataforma que ainda esperam por você.");
}

async function metricasRe(actor: MetricasActor): Promise<Pick<MetricasPerfil, "cartoes" | "tabelas" | "titulo" | "descricao">> {
  const desde90 = new Date(Date.now() - 90 * DIA_MS);
  const porEstado = await contagemPorEstado(actor.tenantId, actor.schoolId, false);

  const devolvidos = actor.schoolId
    ? await db
        .select({ n: sql<number>`count(*)::int` })
        .from(caseTransitions)
        .innerJoin(cases, eq(caseTransitions.caseId, cases.id))
        .innerJoin(students, eq(cases.studentId, students.id))
        .where(
          and(
            eq(caseTransitions.tenantId, actor.tenantId),
            eq(caseTransitions.toState, "rascunho"),
            isNotNull(caseTransitions.fromState),
            gte(caseTransitions.createdAt, desde90),
            eq(students.schoolId, actor.schoolId)
          )
        )
    : [{ n: 0 }];

  const timings = await db
    .select({ caseId: reStepTimings.caseId, step: reStepTimings.step, activeSeconds: reStepTimings.activeSeconds })
    .from(reStepTimings)
    .where(and(eq(reStepTimings.userId, actor.id), eq(reStepTimings.tenantId, actor.tenantId)));
  const baseRows = await db
    .select({ step: reTimeBaselines.step, minutes: reTimeBaselines.baselineMinutes })
    .from(reTimeBaselines)
    .where(eq(reTimeBaselines.tenantId, actor.tenantId));
  const tempo = resumirTempoPessoal(timings, Object.fromEntries(baseRows.map((b) => [b.step, b.minutes])));

  const emAndamento = (porEstado.get("enviado_re") ?? 0) + (porEstado.get("revisao_medica") ?? 0) + (porEstado.get("delegado") ?? 0) + (porEstado.get("retornado") ?? 0);

  return {
    titulo: "Seu trabalho como Responsável Escolar",
    descricao: "Onde estão os casos da sua escola e quanto tempo o preenchimento leva para você.",
    cartoes: [
      cartao("em_preenchimento", "Em preenchimento", porEstado.get("rascunho") ?? 0, "casos", "Casos da sua escola ainda em rascunho, aguardando você."),
      cartao("em_andamento", "Com o núcleo", emAndamento, "casos", "Já enviados: em revisão médica, com especialistas ou retornados ao médico."),
      cartao("encerrados", "Encerrados", porEstado.get("encerrado") ?? 0, "casos", "Casos concluídos pelo médico responsável."),
      cartao("devolvidos_90d", "Devolvidos para ajuste (90 dias)", Number(devolvidos[0]?.n ?? 0), "casos", "Vezes em que o médico devolveu o caso para você completar ou corrigir."),
      cartao("tempo_total_mediano", "Tempo mediano por caso", tempo.medianaTotalMin, "min", tempo.casosMedidos < MIN_PARA_MEDIANA ? "Disponível a partir de 3 casos medidos." : "Tempo ativo de preenchimento, somando as partes A a I."),
      cartao("tempo_ganho", "Tempo ganho (estimativa)", tempo.horasGanhasEstimadas, "h", "Diferença para o tempo do processo em papel informado pela gestão, somada nos seus casos. É uma estimativa."),
      cartao("casos_medidos", "Casos com tempo medido", tempo.casosMedidos, "casos", "Casos em que você preencheu pelo menos uma parte."),
    ],
    tabelas: [
      tabelaPorEstado(porEstado, false),
      {
        chave: "tempo_por_parte",
        titulo: "Tempo mediano por parte do formulário",
        colunas: ["Parte", "Casos", "Seu tempo (min)", "Papel (min)", "Ganho (min)"],
        linhas: tempo.passos.map((p) => [p.step.toUpperCase(), p.casos, p.medianaMin, p.referenciaMin, p.ganhoMin]),
      },
    ],
  };
}

async function metricasMedico(actor: MetricasActor): Promise<Pick<MetricasPerfil, "cartoes" | "tabelas" | "titulo" | "descricao">> {
  const desde30 = new Date(Date.now() - 30 * DIA_MS);
  const desde365 = new Date(Date.now() - 365 * DIA_MS);
  const porEstado = await contagemPorEstado(actor.tenantId, null, true);

  const minhas = await db
    .select({ caseId: caseTransitions.caseId, de: caseTransitions.fromState, para: caseTransitions.toState, em: caseTransitions.createdAt })
    .from(caseTransitions)
    .where(and(eq(caseTransitions.tenantId, actor.tenantId), eq(caseTransitions.actorId, actor.id), gte(caseTransitions.createdAt, desde365)))
    .orderBy(desc(caseTransitions.createdAt))
    .limit(1000);

  const recentes = minhas.filter((t) => t.em >= desde30);
  const encerrados30 = recentes.filter((t) => t.para === "encerrado").length;
  const devolvidos30 = recentes.filter((t) => t.para === "rascunho" && t.de !== null).length;
  const delegados30 = recentes.filter((t) => t.para === "delegado").length;

  const meusDelegados = [...new Set(minhas.filter((t) => t.para === "delegado").map((t) => t.caseId))].slice(0, 500);
  let emEspecialistas = 0;
  let linhasEspecialidade: (string | number | null)[][] = [];
  if (meusDelegados.length) {
    const estados = await db.select({ id: cases.id, estado: cases.journeyState }).from(cases).where(inArray(cases.id, meusDelegados));
    emEspecialistas = estados.filter((c) => c.estado === "delegado").length;
    const secoes = await db
      .select({ specialty: caseSummaries.specialty, status: caseSummaries.status })
      .from(caseSummaries)
      .where(and(eq(caseSummaries.tenantId, actor.tenantId), inArray(caseSummaries.caseId, meusDelegados)));
    const porEsp = new Map<string, { abertas: number; concluidas: number }>();
    for (const s of secoes) {
      const v = porEsp.get(s.specialty) ?? { abertas: 0, concluidas: 0 };
      if (s.status === "concluido") v.concluidas++;
      else v.abertas++;
      porEsp.set(s.specialty, v);
    }
    linhasEspecialidade = [...porEsp.entries()].map(([esp, v]) => [ROTULO_ESPECIALIDADE[esp] ?? esp, v.abertas, v.concluidas]);
  }

  // Quanto tempo leva da chegada do caso à minha decisão (delegar ou devolver).
  const decisoes = minhas.filter((t) => t.de === "revisao_medica" && (t.para === "delegado" || t.para === "rascunho"));
  let medianaRevisaoDias: number | null = null;
  if (decisoes.length >= MIN_PARA_MEDIANA) {
    const ids = [...new Set(decisoes.map((d) => d.caseId))].slice(0, 500);
    const chegadas = await db
      .select({ caseId: caseTransitions.caseId, em: caseTransitions.createdAt })
      .from(caseTransitions)
      .where(and(eq(caseTransitions.tenantId, actor.tenantId), eq(caseTransitions.toState, "revisao_medica"), inArray(caseTransitions.caseId, ids)));
    const duracoes: number[] = [];
    for (const d of decisoes) {
      const anteriores = chegadas.filter((c) => c.caseId === d.caseId && c.em <= d.em).map((c) => c.em.getTime());
      if (anteriores.length) duracoes.push(d.em.getTime() - Math.max(...anteriores));
    }
    medianaRevisaoDias = medianaEmDias(duracoes);
  }

  return {
    titulo: "Seu trabalho como médico(a)",
    descricao: "Fila de casos, devoluções, especialistas e tempo até a sua decisão.",
    cartoes: [
      cartao("aguardando_revisao", "Aguardando sua revisão", porEstado.get("revisao_medica") ?? 0, "casos", "Casos enviados pelas escolas esperando a sua avaliação."),
      cartao("em_especialistas", "Com especialistas (delegados por você)", emEspecialistas, "casos", "Casos que você delegou e que ainda aguardam o retorno do núcleo."),
      cartao("para_consolidar", "Retornados para consolidar", porEstado.get("retornado") ?? 0, "casos", "Todas as seções foram concluídas e o caso espera a sua decisão final."),
      cartao("delegados_30d", "Delegados por você (30 dias)", delegados30, "casos", "Casos que você encaminhou aos especialistas nos últimos 30 dias."),
      cartao("devolvidos_30d", "Devolvidos ao RE (30 dias)", devolvidos30, "casos", "Casos que você devolveu à escola para completar."),
      cartao("encerrados_30d", "Encerrados por você (30 dias)", encerrados30, "casos", "Decisões finais registradas por você."),
      cartao("tempo_revisao", "Tempo mediano até sua decisão", medianaRevisaoDias, "dias", "Da chegada do caso até você delegar ou devolver. Disponível a partir de 3 decisões."),
    ],
    tabelas: [
      tabelaPorEstado(porEstado, false),
      {
        chave: "secoes_por_especialidade",
        titulo: "Seções dos casos que você delegou",
        colunas: ["Especialidade", "Em aberto", "Concluídas"],
        linhas: linhasEspecialidade,
      },
    ],
  };
}

async function metricasEspecialista(actor: MetricasActor): Promise<Pick<MetricasPerfil, "cartoes" | "tabelas" | "titulo" | "descricao">> {
  const desde30 = new Date(Date.now() - 30 * DIA_MS);
  const secoes = await db
    .select({ status: caseSummaries.status, criada: caseSummaries.createdAt, concluida: caseSummaries.completedAt, specialty: caseSummaries.specialty })
    .from(caseSummaries)
    .where(and(eq(caseSummaries.tenantId, actor.tenantId), eq(caseSummaries.assignedProfessionalId, actor.id)));

  const pendentes = secoes.filter((s) => s.status === "pendente").length;
  const emAndamento = secoes.filter((s) => s.status === "em_andamento").length;
  const concluidas = secoes.filter((s) => s.status === "concluido");
  const concluidas30 = concluidas.filter((s) => s.concluida && s.concluida >= desde30).length;
  const abertas = secoes.filter((s) => s.status !== "concluido");
  const maisAntigaDias = abertas.length ? Math.floor((Date.now() - Math.min(...abertas.map((s) => s.criada.getTime()))) / DIA_MS) : null;
  const medianaConclusao = medianaEmDias(concluidas.filter((s) => s.concluida).map((s) => s.concluida!.getTime() - s.criada.getTime()));

  const porEsp = new Map<string, { abertas: number; concluidas: number }>();
  for (const s of secoes) {
    const v = porEsp.get(s.specialty) ?? { abertas: 0, concluidas: 0 };
    if (s.status === "concluido") v.concluidas++;
    else v.abertas++;
    porEsp.set(s.specialty, v);
  }

  return {
    titulo: "Seu trabalho no núcleo assistencial",
    descricao: "As seções que o médico delegou a você e o tempo que levam para ser concluídas.",
    cartoes: [
      cartao("secoes_pendentes", "Aguardando início", pendentes, "seções", "Seções delegadas a você que ainda não foram abertas."),
      cartao("secoes_andamento", "Em andamento", emAndamento, "seções", "Rascunhos salvos que esperam conclusão."),
      cartao("concluidas_30d", "Concluídas (30 dias)", concluidas30, "seções", "Pareceres devolvidos ao médico nos últimos 30 dias."),
      cartao("mais_antiga", "Seção em aberto mais antiga", maisAntigaDias, "dias", "Há quantos dias a seção aberta mais antiga foi delegada a você."),
      cartao("tempo_conclusao", "Tempo mediano até concluir", medianaConclusao, "dias", "Da delegação até a conclusão. Disponível a partir de 3 seções concluídas."),
    ],
    tabelas: [
      {
        chave: "secoes_por_especialidade",
        titulo: "Suas seções por especialidade",
        colunas: ["Especialidade", "Em aberto", "Concluídas"],
        linhas: [...porEsp.entries()].map(([esp, v]) => [ROTULO_ESPECIALIDADE[esp] ?? esp, v.abertas, v.concluidas]),
      },
    ],
  };
}

async function metricasProfessor(actor: MetricasActor): Promise<Pick<MetricasPerfil, "cartoes" | "tabelas" | "titulo" | "descricao">> {
  const desde30 = new Date(Date.now() - 30 * DIA_MS);
  const obs = await db
    .select({ kind: teacherObservations.kind, domain: teacherObservations.domain, createdAt: teacherObservations.createdAt })
    .from(teacherObservations)
    .where(and(eq(teacherObservations.teacherId, actor.id), eq(teacherObservations.tenantId, actor.tenantId)));

  const porDominio = new Map<string, number>();
  for (const o of obs) {
    const d = o.domain ?? "sem_dominio";
    porDominio.set(d, (porDominio.get(d) ?? 0) + 1);
  }
  return {
    titulo: "Suas observações em sala",
    descricao: "Quantas observações você registrou, sem identificar nenhum aluno.",
    cartoes: [
      cartao("obs_total", "Observações registradas", obs.length, "observações", "Total desde que você começou a usar a plataforma."),
      cartao("obs_30d", "Últimos 30 dias", obs.filter((o) => o.createdAt >= desde30).length, "observações", "Registros feitos no último mês."),
      cartao("obs_rapidas", "Observações rápidas", obs.filter((o) => o.kind === "flash").length, "observações", "Registros curtos feitos na hora."),
      cartao("obs_completas", "Observações completas", obs.filter((o) => o.kind === "full").length, "observações", "Fichas completas de observação."),
    ],
    tabelas: [
      {
        chave: "obs_por_dominio",
        titulo: "Por área observada",
        colunas: ["Área", "Observações"],
        linhas: [...porDominio.entries()].map(([d, n]) => [ROTULO_DOMINIO[d] ?? "Sem área definida", n]),
      },
    ],
  };
}

async function metricasGestao(actor: MetricasActor, rede: boolean): Promise<Pick<MetricasPerfil, "cartoes" | "tabelas" | "titulo" | "descricao">> {
  const porEstado = await contagemPorEstado(actor.tenantId, actor.schoolId, rede);
  const encaminhados =
    (porEstado.get("enviado_re") ?? 0) + (porEstado.get("revisao_medica") ?? 0) + (porEstado.get("delegado") ?? 0) + (porEstado.get("retornado") ?? 0) + (porEstado.get("encerrado") ?? 0);
  return {
    titulo: rede ? "Panorama da rede" : "Panorama da sua escola",
    descricao: "Totais agregados. Grupos com menos de 5 casos aparecem como \"< 5\" para proteger os alunos.",
    cartoes: [
      cartaoAgregado("encaminhados", "Encaminhados ao núcleo", encaminhados, "Casos que já foram enviados pelo RE ao médico."),
      cartaoAgregado("em_preenchimento", "Em preenchimento nas escolas", porEstado.get("rascunho") ?? 0, "Casos ainda em rascunho."),
      cartaoAgregado("com_especialistas", "Com especialistas", porEstado.get("delegado") ?? 0, "Casos delegados pelo médico."),
      cartaoAgregado("encerrados", "Encerrados", porEstado.get("encerrado") ?? 0, "Casos concluídos pelo médico responsável."),
    ],
    tabelas: [tabelaPorEstado(porEstado, true)],
  };
}

async function metricasBoard(actor: MetricasActor): Promise<Pick<MetricasPerfil, "cartoes" | "tabelas" | "titulo" | "descricao">> {
  const desde30 = new Date(Date.now() - 30 * DIA_MS);
  const pedidos = await db
    .select({ status: expertMeetingRequests.status, criado: expertMeetingRequests.createdAt, decidido: expertMeetingRequests.decidedAt, por: expertMeetingRequests.decidedBy })
    .from(expertMeetingRequests)
    .where(eq(expertMeetingRequests.tenantId, actor.tenantId));
  const meus = pedidos.filter((p) => p.por === actor.id && p.decidido);
  return {
    titulo: "Pedidos de ajuda ao Board",
    descricao: "Fila de pedidos das escolas e o tempo que as respostas levam.",
    cartoes: [
      cartao("pedidos_pendentes", "Pedidos aguardando resposta", pedidos.filter((p) => p.status === "pending").length, "pedidos", "Pedidos de reunião ainda sem decisão."),
      cartao("confirmados_30d", "Confirmados por você (30 dias)", meus.filter((p) => p.status === "confirmed" && p.decidido! >= desde30).length, "pedidos", "Reuniões que você confirmou no último mês."),
      cartao("recusados_30d", "Recusados por você (30 dias)", meus.filter((p) => p.status === "declined" && p.decidido! >= desde30).length, "pedidos", "Pedidos que você recusou no último mês."),
      cartao("tempo_resposta", "Tempo mediano de resposta", medianaEmHoras(meus.map((p) => p.decidido!.getTime() - p.criado.getTime())), "h", "Do pedido até a sua decisão. Disponível a partir de 3 respostas."),
    ],
    tabelas: [],
  };
}

async function metricasAdmin(): Promise<Pick<MetricasPerfil, "cartoes" | "tabelas" | "titulo" | "descricao">> {
  const [u] = await db.select({ ativos: sql<number>`count(*) filter (where ${users.accessEnabled})::int`, pendentes: sql<number>`count(*) filter (where not ${users.accessEnabled})::int` }).from(users);
  const [t] = await db.select({ n: sql<number>`count(*)::int` }).from(supportTickets).where(inArray(supportTickets.status, ["aberto", "em_atendimento"]));
  const [l] = await db.select({ n: sql<number>`count(*)::int` }).from(lgpdRequests).where(eq(lgpdRequests.status, "pending"));
  return {
    titulo: "Saúde da plataforma",
    descricao: "Pendências que dependem de você como Administrador Master.",
    cartoes: [
      cartao("usuarios_ativos", "Usuários com acesso ativo", Number(u?.ativos ?? 0), "usuários", "Contas que já confirmaram o convite."),
      cartao("convites_pendentes", "Convites sem confirmação", Number(u?.pendentes ?? 0), "usuários", "Contas criadas que ainda não confirmaram o e-mail."),
      cartao("chamados_abertos", "Chamados abertos", Number(t?.n ?? 0), "chamados", "Chamados de suporte abertos ou em atendimento."),
      cartao("lgpd_pendentes", "Pedidos LGPD pendentes", Number(l?.n ?? 0), "pedidos", "Solicitações de titulares aguardando resposta do DPO."),
    ],
    tabelas: [],
  };
}

/** Monta as métricas do painel conforme o perfil. Nunca devolve conteúdo clínico nem identificação de aluno. */
export async function metricasDoUsuario(actor: MetricasActor): Promise<MetricasPerfil> {
  const papel = canonicalRole(actor.role);
  let bloco: Pick<MetricasPerfil, "cartoes" | "tabelas" | "titulo" | "descricao">;

  switch (papel) {
    case "ppi":
      bloco = await metricasRe(actor);
      break;
    case "md1":
      bloco = await metricasMedico(actor);
      break;
    case "specialist":
      bloco = await metricasEspecialista(actor);
      break;
    case "teacher":
      bloco = await metricasProfessor(actor);
      break;
    case "school_manager":
      bloco = await metricasGestao(actor, false);
      break;
    case "municipal_manager":
      bloco = await metricasGestao(actor, true);
      break;
    case "board":
      bloco = await metricasBoard(actor);
      break;
    case "admin_platform":
      bloco = await metricasAdmin();
      break;
    default:
      bloco = {
        titulo: "Seu acesso",
        descricao: "Seu perfil trabalha com indicadores agregados no BI e no mapa de prevalência.",
        cartoes: [],
        tabelas: [],
      };
  }

  const avisos = await notificacoesNaoLidas(actor);
  return {
    papel,
    ...bloco,
    cartoes: [avisos, ...bloco.cartoes],
    aviso: AVISO_PADRAO,
    geradoEm: new Date().toISOString(),
  };
}
