/**
 * Planejamento de rede a partir de agregados populacionais.
 * Isto é aritmética de gestão (demanda registrada ÷ capacidade), NÃO critério clínico:
 * não classifica criança, não diagnostica e não sugere conduta.
 */
export const SERVICES = [
  "fonoaudiologia",
  "psicopedagogia",
  "psicoterapia",
  "psicomotricidade",
  "neuropsicologia",
  "assistencia_social",
  "consulta_medica",
] as const;
export type ServiceKey = (typeof SERVICES)[number];

export const SERVICE_LABELS: Record<ServiceKey, string> = {
  fonoaudiologia: "Fonoaudiologia",
  psicopedagogia: "Psicopedagogia",
  psicoterapia: "Psicoterapia",
  psicomotricidade: "Psicomotricidade",
  neuropsicologia: "Neuropsicologia",
  assistencia_social: "Assistência social",
  consulta_medica: "Consulta médica",
};

/**
 * Casos acompanhados por profissional (capacidade). VALORES PROVISÓRIOS de planejamento:
 * precisam ser validados pela equipe clínica e podem ser editados na tela do gestor.
 */
export const CAPACITY_DEFAULTS: Record<ServiceKey, number> = {
  fonoaudiologia: 40,
  psicopedagogia: 40,
  psicoterapia: 30,
  psicomotricidade: 30,
  neuropsicologia: 25,
  assistencia_social: 60,
  consulta_medica: 120,
};

export const SMALL_CELL = 5;

export interface AggregatePayload {
  total: number | null;
  ageBands: Record<string, number | null>;
  complaints: Record<string, number | null>;
  services: Record<string, number | null>;
}

export function parseCapacity(raw: unknown): Record<ServiceKey, number> {
  const out = { ...CAPACITY_DEFAULTS };
  if (raw && typeof raw === "object") {
    for (const k of SERVICES) {
      const v = Number((raw as Record<string, unknown>)[k]);
      if (Number.isFinite(v) && v >= 1 && v <= 1000) out[k] = v;
    }
  }
  return out;
}

export interface SchoolPlanning {
  casesRegistered: number | null;
  suppressed: boolean;
  ratePer1000: number | null;
  professionals: Partial<Record<ServiceKey, number>>;
  professionalsTotal: number;
  lowerBound: boolean; // true quando houve célula suprimida (o número é um mínimo)
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function planSchool(
  payload: AggregatePayload,
  enrollment: number | null,
  capacity: Record<ServiceKey, number>,
): SchoolPlanning {
  const professionals: Partial<Record<ServiceKey, number>> = {};
  let total = 0;
  let lowerBound = false;
  for (const k of SERVICES) {
    const demand = payload.services?.[k];
    if (demand == null) {
      lowerBound = true;
      continue;
    }
    const fte = round1(demand / capacity[k]);
    professionals[k] = fte;
    total += fte;
  }
  const cases = payload.total;
  const rate =
    cases != null && enrollment != null && enrollment > 0 ? round1((cases / enrollment) * 1000) : null;
  return {
    casesRegistered: cases,
    suppressed: cases == null,
    ratePer1000: rate,
    professionals,
    professionalsTotal: round1(total),
    lowerBound,
  };
}

/** Pontos do mapa sem informação, para o gestor completar o cadastro. */
export function missingInfo(s: {
  latitude: number | null;
  longitude: number | null;
  enrollment: number | null;
  hasAggregate: boolean;
}): string[] {
  const m: string[] = [];
  if (s.latitude == null || s.longitude == null) m.push("localização");
  if (s.enrollment == null) m.push("matrícula");
  if (!s.hasAggregate) m.push("dados da base populacional");
  return m;
}
