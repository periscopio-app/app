import { SMALL_CELL } from "./bi-semantic.service";

/**
 * Observabilidade do fluxo do RE (gestão): tempo ativo de preenchimento por parte (A–I), tempo ganho em relação
 * ao processo em papel, uso do passo opcional G e andamento da triagem TEA. Tudo agregado: nenhuma célula com
 * menos de 5 casos é exibida e nenhum aluno é identificável. Aqui não há leitura de respostas clínicas.
 */

export const PASSOS = ["a", "b", "c", "d", "e", "f", "g", "h", "i"] as const;
export type Passo = (typeof PASSOS)[number];

export function mediana(valores: number[]): number | null {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m]! : Math.round((v[m - 1]! + v[m]!) / 2);
}

export interface TimingRow {
  caseId: string;
  step: string;
  activeSeconds: number;
}

export interface Cell<T> {
  value: T | null;
  suppressed: boolean;
}

function celula<T>(n: number, valor: T | null): Cell<T> {
  return n < SMALL_CELL ? { value: null, suppressed: n > 0 } : { value: valor, suppressed: false };
}

export interface PassoTempo {
  step: Passo;
  casos: number;
  medianaSegundos: Cell<number>;
  baselineMinutos: number | null;
  /** baseline − mediana (minutos). Só quando há baseline e a célula não está oculta. */
  ganhoMedianoMinutos: number | null;
}

export interface TempoResumo {
  passos: PassoTempo[];
  casosComTempo: number;
  medianaTotalSegundos: Cell<number>;
  /** Soma dos ganhos medianos por parte × casos (estimativa; depende dos tempos de referência informados). */
  horasGanhasEstimadas: Cell<number>;
}

export function resumirTempos(rows: TimingRow[], baselines: Partial<Record<string, number>>): TempoResumo {
  const porPasso = new Map<Passo, Map<string, number>>();
  const porCaso = new Map<string, number>();
  for (const r of rows) {
    if (!(PASSOS as readonly string[]).includes(r.step)) continue;
    const step = r.step as Passo;
    const m = porPasso.get(step) ?? new Map<string, number>();
    m.set(r.caseId, (m.get(r.caseId) ?? 0) + r.activeSeconds);
    porPasso.set(step, m);
    porCaso.set(r.caseId, (porCaso.get(r.caseId) ?? 0) + r.activeSeconds);
  }

  const passos: PassoTempo[] = PASSOS.map((step) => {
    const m = porPasso.get(step);
    const n = m?.size ?? 0;
    const mediaSeg = m ? mediana([...m.values()]) : null;
    const cel = celula<number>(n, mediaSeg);
    const base = baselines[step];
    const baselineMinutos = typeof base === "number" ? base : null;
    const ganho =
      baselineMinutos != null && cel.value != null ? Math.round((baselineMinutos - cel.value / 60) * 10) / 10 : null;
    return { step, casos: n, medianaSegundos: cel, baselineMinutos, ganhoMedianoMinutos: ganho };
  });

  const casosComTempo = porCaso.size;
  const medianaTotal = celula<number>(casosComTempo, mediana([...porCaso.values()]));

  // Horas ganhas: para cada parte com baseline e mediana visível, (baseline − mediana) × nº de casos daquela parte.
  let minutos = 0;
  let algum = false;
  for (const p of passos) {
    if (p.ganhoMedianoMinutos != null) {
      minutos += p.ganhoMedianoMinutos * p.casos;
      algum = true;
    }
  }
  const horas = celula<number>(casosComTempo, algum ? Math.round((minutos / 60) * 10) / 10 : null);
  return { passos, casosComTempo, medianaTotalSegundos: medianaTotal, horasGanhasEstimadas: horas };
}

export interface UsoOpcionalRow {
  caseId: string;
  action: string; // pulado | retomado
  createdAt: Date;
}

export interface UsoOpcionalResumo {
  casosComJornada: number;
  /** Casos cujo último registro de G é "pulado". */
  casosComGPulado: Cell<number>;
  percentual: Cell<number>;
  retomadas: Cell<number>;
}

export function resumirUsoOpcional(rows: UsoOpcionalRow[], casosComJornada: number): UsoOpcionalResumo {
  const ultimo = new Map<string, UsoOpcionalRow>();
  for (const r of [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) ultimo.set(r.caseId, r);
  const pulados = [...ultimo.values()].filter((r) => r.action === "pulado").length;
  const retomadas = new Set(rows.filter((r) => r.action === "retomado").map((r) => r.caseId)).size;
  const base = casosComJornada;
  return {
    casosComJornada: base,
    casosComGPulado: celula(pulados, pulados),
    percentual: base < SMALL_CELL || pulados < SMALL_CELL ? { value: null, suppressed: pulados > 0 } : { value: Math.round((pulados / base) * 100), suppressed: false },
    retomadas: celula(retomadas, retomadas),
  };
}

export interface TeaRow {
  caseId: string;
  instrument: string;
  status: string; // rascunho | enviado
  respondent: string | null;
  createdAt: Date;
  submittedAt: Date | null;
}

export interface TeaInstrumentoResumo {
  instrument: string;
  iniciados: Cell<number>;
  enviados: Cell<number>;
  rascunhos: Cell<number>;
  /** Mediana de dias entre iniciar e enviar. */
  medianaDiasAteEnvio: Cell<number>;
}

export interface TeaResumo {
  casosComTriagem: number;
  instrumentos: TeaInstrumentoResumo[];
  ataAguardandoResponsavel: Cell<number>;
  porRespondente: { respondent: string; enviados: Cell<number> }[];
}

const DIA = 86_400_000;

/**
 * Indicadores de andamento da triagem TEA. Propositalmente NÃO inclui pontuação nem faixa de resultado:
 * o sistema organiza o fluxo e não classifica nem diagnostica.
 */
export function resumirTea(rows: TeaRow[], ataAguardando: number): TeaResumo {
  const porInstr = new Map<string, TeaRow[]>();
  for (const r of rows) porInstr.set(r.instrument, [...(porInstr.get(r.instrument) ?? []), r]);
  const instrumentos: TeaInstrumentoResumo[] = [...porInstr.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([instrument, rs]) => {
      const enviados = rs.filter((r) => r.status === "enviado");
      const dias = enviados.filter((r) => r.submittedAt).map((r) => Math.max(0, Math.round((r.submittedAt!.getTime() - r.createdAt.getTime()) / DIA)));
      return {
        instrument,
        iniciados: celula(rs.length, rs.length),
        enviados: celula(enviados.length, enviados.length),
        rascunhos: celula(rs.length - enviados.length, rs.length - enviados.length),
        medianaDiasAteEnvio: celula(dias.length, mediana(dias)),
      };
    });
  const resp = new Map<string, number>();
  for (const r of rows) if (r.status === "enviado" && r.respondent) resp.set(r.respondent, (resp.get(r.respondent) ?? 0) + 1);
  return {
    casosComTriagem: new Set(rows.map((r) => r.caseId)).size,
    instrumentos,
    ataAguardandoResponsavel: celula(ataAguardando, ataAguardando),
    porRespondente: [...resp.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([respondent, n]) => ({ respondent, enviados: celula(n, n) })),
  };
}
