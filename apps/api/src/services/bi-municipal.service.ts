export interface CohortAggregatedMetric {
  groupName: string;
  totalStudentsTriaged: number;
  casesWithHighRisk: number | "<5";
  prevalencePercentage: number | null;
  suppressed: boolean;
}

const SMALL_CELL_THRESHOLD = 5;

/**
 * Calcula métricas epidemiológicas e agregadas para o BI Municipal (Task 13).
 * Aplica regra de supressão de células pequenas (< 5 ocorrências) para impedir reidentificação por inferência.
 */
export function calculateMunicipalBIMetrics(
  cohorts: { groupName: string; total: number; highRiskCount: number }[]
): CohortAggregatedMetric[] {
  return cohorts.map((c) => {
    const isSuppressed = c.highRiskCount > 0 && c.highRiskCount < SMALL_CELL_THRESHOLD;

    const prevalencePercentage =
      c.total > 0 && !isSuppressed
        ? Math.round((c.highRiskCount / c.total) * 1000) / 10
        : null;

    return {
      groupName: c.groupName,
      totalStudentsTriaged: c.total,
      casesWithHighRisk: isSuppressed ? "<5" : c.highRiskCount,
      prevalencePercentage,
      suppressed: isSuppressed,
    };
  });
}
