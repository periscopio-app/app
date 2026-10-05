import { test } from "node:test";
import assert from "node:assert";
import { validateInstitutionalCSVImport } from "./institutional-import.service";
import { calculateOperationalKPIs } from "./kpi-admin.service";

test("importação institucional (Task 11): dry-run valida formato sem inserir e rejeita planilhas contendo PII/prontuários", () => {
  // 1. Planilha válida de escolas e gestores
  const validRows = [
    {
      nomeEscola: "EMEF Castro Alves",
      cnpj: "12.345.678/0001-90",
      responsavelNome: "Diretora Maria",
      responsavelEmail: "maria@escola.gov.br",
      profissionalNome: "Dra. Ana",
      profissionalEmail: "ana@escola.gov.br",
    },
  ];

  const validResult = validateInstitutionalCSVImport(validRows, true);
  assert.strictEqual(validResult.valid, true);
  assert.strictEqual(validResult.dryRunSummary.schoolsToCreate, 1);
  assert.strictEqual(validResult.dryRunSummary.usersToInvite, 2);

  // 2. Planilha que tenta importar prontuário de aluno -> Rejeitado
  const invalidRows = [
    {
      nomeEscola: "EMEF Castro Alves",
      responsavelEmail: "maria@escola.gov.br",
      aluno: "Joãozinho da Silva",
      cid10: "F84.0",
    },
  ];

  const invalidResult = validateInstitutionalCSVImport(invalidRows, true);
  assert.strictEqual(invalidResult.valid, false);
  assert.match(invalidResult.errors[0].message || "", /não podem conter dados ou prontuários/);
});

test("kpis administrativos (Task 12): calcula agregados operacionais e taxa de SLA sem expor identificação do aluno", () => {
  const casesData = [
    { status: "triagem", slaMet: true },
    { status: "investigacao", slaMet: true },
    { status: "concluido", slaMet: false },
    { status: "triagem", slaMet: true },
  ];

  const kpis = calculateOperationalKPIs(casesData, 10, 8);

  assert.strictEqual(kpis.totalSchools, 10);
  assert.strictEqual(kpis.activeSchools, 8);
  assert.strictEqual(kpis.totalStudentsTriaged, 4);
  assert.strictEqual(kpis.casesInTriagem, 2);
  assert.strictEqual(kpis.casesInInvestigacao, 1);
  assert.strictEqual(kpis.casesCompleted, 1);
  assert.strictEqual(kpis.slaCompliancePercentage, 75); // 3 de 4 dentro do SLA = 75%
  assert.strictEqual((kpis as any).studentName, undefined); // Garantia sem PII
});
