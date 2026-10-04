export interface SchoolKPIAggregate {
  tenantId: string;
  totalSchools: number;
  activeSchools: number;
  totalStudentsTriaged: number;
  casesInTriagem: number;
  casesInInvestigacao: number;
  casesCompleted: number;
  slaCompliancePercentage: number;
}

/**
 * Calcula os KPIs Administrativos operacionais agregados para o gestor municipal/platform admin (Task 12).
 * NUNCA retorna prontuários, nomes de alunos, diagnósticos ou dados individuais.
 */
export function calculateOperationalKPIs(
  cases: { status: string; slaMet: boolean }[],
  totalSchoolsCount: number,
  activeSchoolsCount: number
): SchoolKPIAggregate {
  const casesInTriagem = cases.filter((c) => c.status === "triagem").length;
  const casesInInvestigacao = cases.filter((c) => c.status === "investigacao" || c.status === "sisreg").length;
  const casesCompleted = cases.filter((c) => c.status === "reabilitacao" || c.status === "concluido").length;

  const totalCases = cases.length;
  const slaMetCount = cases.filter((c) => c.slaMet).length;
  const slaCompliancePercentage = totalCases > 0 ? Math.round((slaMetCount / totalCases) * 100) : 100;

  return {
    tenantId: "tenant-aggregated",
    totalSchools: totalSchoolsCount,
    activeSchools: activeSchoolsCount,
    totalStudentsTriaged: totalCases,
    casesInTriagem,
    casesInInvestigacao,
    casesCompleted,
    slaCompliancePercentage,
  };
}
