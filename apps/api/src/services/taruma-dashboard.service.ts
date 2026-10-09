/**
 * Painel exclusivo da base de Tarumã (NEMT 2024), montado só com agregados já carregados no banco.
 * Aritmética de gestão (contagens, percentuais, demanda ÷ capacidade): não classifica criança,
 * não diagnostica e não indica risco individual. Células ocultadas (<5) continuam ocultas.
 */
import {
  SERVICES,
  SERVICE_LABELS,
  planSchool,
  type AggregatePayload,
  type ServiceKey,
} from "./population-planning.service";

export const TARUMA_SOURCE = "taruma-nemt-2024";
/** Faixa do piloto (6 a 9 anos e 11 meses). */
export const PILOT_BAND = "6-9";
export const AGE_ORDER = ["3-5", "6-9", "10-12", "13-17", "18+"] as const;
const AGE_LABELS: Record<string, string> = {
  "3-5": "3 a 5 anos",
  "6-9": "6 a 9 anos",
  "10-12": "10 a 12 anos",
  "13-17": "13 a 17 anos",
  "18+": "18 anos ou mais",
};

export interface TarumaSchoolInput {
  /** Rótulo na base (sigla). */
  label: string;
  code: string;
  payload: AggregatePayload;
}

export interface Datum {
  key: string;
  label: string;
  /** null = célula oculta (<5 casos). */
  value: number | null;
  /** Percentual sobre o total de casos do escopo (1 casa), quando calculável. */
  share?: number | null;
  highlight?: boolean;
}

export interface Kpi {
  id: string;
  label: string;
  value: string;
  detail: string;
}

export interface TarumaDashboard {
  scope: "municipio" | "escola";
  totalCases: number | null;
  kpis: Kpi[];
  casesBySchool: Datum[];
  pilotBySchool: Datum[];
  ageBands: Datum[];
  complaints: Datum[];
  services: { key: string; label: string; demand: number | null; capacity: number; professionals: number | null }[];
  heatmap: { services: { key: string; label: string }[]; rows: { school: string; cells: (number | null)[] }[] };
  notes: string[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (v: number | null, total: number | null) =>
  v == null || total == null || total <= 0 ? null : round1((v / total) * 100);
const br = (n: number) => String(n).replace(".", ",");

export function buildTarumaDashboard(
  base: AggregatePayload,
  schools: TarumaSchoolInput[],
  capacity: Record<ServiceKey, number>,
  scope: "municipio" | "escola",
): TarumaDashboard {
  const total = base.total;
  // "Não se aplica" (código 0) não é escola: fica de fora dos rankings por escola.
  const real = schools.filter((s) => s.code !== "0");

  const bySchool = (pick: (p: AggregatePayload) => number | null): Datum[] =>
    real
      .map((s) => ({ key: s.code, label: s.label, value: pick(s.payload), share: pct(pick(s.payload), total) }))
      .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));

  const casesBySchool = bySchool((p) => p.total);
  const pilotBySchool = bySchool((p) => p.ageBands?.[PILOT_BAND] ?? null);

  const ageBands: Datum[] = AGE_ORDER.map((k) => ({
    key: k,
    label: AGE_LABELS[k],
    value: base.ageBands?.[k] ?? null,
    share: pct(base.ageBands?.[k] ?? null, total),
    highlight: k === PILOT_BAND,
  }));

  const complaints: Datum[] = Object.entries(base.complaints ?? {})
    .filter(([, v]) => v != null && v > 0)
    .map(([k, v]) => ({ key: k, label: k, value: v as number, share: pct(v as number, total) }))
    .sort((a, b) => (b.value as number) - (a.value as number))
    .slice(0, 10);

  const planning = planSchool(base, null, capacity);
  const services = SERVICES.map((k) => ({
    key: k,
    label: SERVICE_LABELS[k],
    demand: base.services?.[k] ?? null,
    capacity: capacity[k],
    professionals: planning.professionals[k] ?? null,
  }));

  const heatServices = SERVICES.filter((k) => k !== "consulta_medica"); // consulta médica = 100% dos casos
  const heatmap = {
    services: heatServices.map((k) => ({ key: k, label: SERVICE_LABELS[k] })),
    rows: real
      .filter((s) => s.payload.total != null)
      .sort((a, b) => (b.payload.total ?? 0) - (a.payload.total ?? 0))
      .map((s) => ({ school: s.label, cells: heatServices.map((k) => s.payload.services?.[k] ?? null) })),
  };

  // ── KPIs pré-definidos ───────────────────────────────────────────────────
  const kpis: Kpi[] = [];
  kpis.push({
    id: "casos",
    label: "Casos registrados",
    value: total == null ? "<5" : String(total),
    detail: scope === "municipio" ? "Base NEMT 2024, município de Tarumã" : "Escola selecionada",
  });

  if (scope === "municipio") {
    const withData = real.filter((s) => s.payload.total != null).length;
    kpis.push({
      id: "escolas",
      label: "Escolas com casos",
      value: `${withData} de ${real.length}`,
      detail: "Escolas com 5 ou mais casos registrados",
    });
  }

  const pilot = base.ageBands?.[PILOT_BAND] ?? null;
  kpis.push({
    id: "piloto",
    label: "Faixa do piloto (6 a 9 anos)",
    value: pilot == null ? "<5" : String(pilot),
    detail: pilot == null || total == null ? "Casos na faixa do piloto" : `${br(round1((pilot / total) * 100))}% dos casos`,
  });

  const upTo17 = AGE_ORDER.filter((k) => k !== "18+").reduce<number | null>((acc, k) => {
    const v = base.ageBands?.[k];
    return acc == null || v == null ? null : acc + v;
  }, 0);
  kpis.push({
    id: "ate17",
    label: "Crianças e adolescentes (até 17 anos)",
    value: upTo17 == null ? "—" : String(upTo17),
    detail: upTo17 == null || total == null ? "" : `${br(round1((upTo17 / total) * 100))}% dos casos`,
  });

  if (complaints[0]) {
    kpis.push({
      id: "queixa",
      label: "Queixa mais registrada",
      value: complaints[0].label,
      detail: `${complaints[0].value} casos${complaints[0].share != null ? ` (${br(complaints[0].share)}%)` : ""}`,
    });
  }

  const topService = services
    .filter((s) => s.key !== "consulta_medica" && s.demand != null)
    .sort((a, b) => (b.demand as number) - (a.demand as number))[0];
  if (topService) {
    kpis.push({
      id: "especialidade",
      label: "Maior demanda por especialidade",
      value: topService.label,
      detail: `${topService.demand} casos com demanda registrada`,
    });
  }

  kpis.push({
    id: "profissionais",
    label: "Profissionais necessários (estimativa)",
    value: br(planning.professionalsTotal),
    detail: planning.lowerBound
      ? "Equivalentes de tempo integral; mínimo, há valores ocultos. Capacidade provisória."
      : "Equivalentes de tempo integral. Capacidade provisória, a validar com a equipe clínica.",
  });

  if (scope === "municipio") {
    const ranked = casesBySchool.filter((d) => d.value != null);
    const top3 = ranked.slice(0, 3);
    const top3Sum = top3.reduce((a, d) => a + (d.value as number), 0);
    if (top3.length === 3 && total) {
      kpis.push({
        id: "concentracao",
        label: "Concentração nas 3 maiores escolas",
        value: `${br(round1((top3Sum / total) * 100))}%`,
        detail: top3.map((d) => d.label).join(", "),
      });
    }
  }

  const notes = [
    "Números agregados de casos registrados na base NEMT 2024. Não são diagnósticos e não indicam risco individual.",
    "Células com menos de 5 casos são ocultadas e aparecem como “<5”.",
    "Uma criança pode ter mais de uma queixa registrada; por isso as queixas somam mais que o total de casos.",
    "Profissionais necessários = demanda registrada ÷ casos acompanhados por profissional (parâmetro provisório, editável).",
  ];
  if (scope === "municipio") {
    const noSchool = schools.find((s) => s.code === "0");
    if (noSchool?.payload.total != null) {
      notes.push(`${noSchool.payload.total} casos estão registrados como “Não se aplica” (sem escola) e não entram no ranking por escola.`);
    }
  }

  return {
    scope,
    totalCases: total,
    kpis,
    casesBySchool,
    pilotBySchool,
    ageBands,
    complaints,
    services,
    heatmap,
    notes,
  };
}
