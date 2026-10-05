import { isRole, type Role } from "../security/roles";

export interface CSVImportRow {
  nomeEscola: string;
  cnpj: string;
  responsavelNome: string;
  responsavelEmail: string;
  profissionalNome?: string;
  profissionalEmail?: string;
  profissionalCargo?: string;
  especialidade?: string;
}

export interface CSVImportResult {
  valid: boolean;
  totalRows: number;
  validRows: number;
  errors: { row: number; field: string; message: string }[];
  dryRunSummary: {
    schoolsToCreate: number;
    usersToInvite: number;
  };
}

/**
 * Valida a importação em lote institucional via CSV/TSV em modo a seco (Dry-run) (Task 11).
 * NENHUM dado de criança/aluno é permitido na planilha institucional.
 */
export function validateInstitutionalCSVImport(
  rows: Record<string, string>[],
  isDryRun = true
): CSVImportResult {
  const errors: { row: number; field: string; message: string }[] = [];
  const schoolsSet = new Set<string>();
  const usersSet = new Set<string>();

  rows.forEach((row, index) => {
    const rowNum = index + 1;

    // 1. Sanitização e checagem contra PII infantil involuntário nas colunas
    const rawContent = JSON.stringify(row).toLowerCase();
    if (rawContent.includes("aluno") || rawContent.includes("laudo") || rawContent.includes("cid10")) {
      errors.push({
        row: rowNum,
        field: "header",
        message: "Planilhas de importação institucional não podem conter dados ou prontuários de alunos.",
      });
    }

    // 2. Validação do nome da escola
    const nomeEscola = row.nomeEscola?.trim();
    if (!nomeEscola || nomeEscola.length < 3) {
      errors.push({ row: rowNum, field: "nomeEscola", message: "Nome da escola é obrigatório (mínimo 3 caracteres)." });
    } else {
      schoolsSet.add(nomeEscola);
    }

    // 3. Validação do e-mail do responsável
    const emailResp = row.responsavelEmail?.trim().toLowerCase();
    if (!emailResp || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailResp)) {
      errors.push({ row: rowNum, field: "responsavelEmail", message: "E-mail do responsável escolar inválido." });
    } else {
      usersSet.add(emailResp);
    }

    // 4. Validação opcional de profissional
    const emailProf = row.profissionalEmail?.trim().toLowerCase();
    if (emailProf) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailProf)) {
        errors.push({ row: rowNum, field: "profissionalEmail", message: "E-mail de profissional de equipe inválido." });
      } else {
        usersSet.add(emailProf);
      }
    }
  });

  return {
    valid: errors.length === 0,
    totalRows: rows.length,
    validRows: rows.length - errors.length,
    errors,
    dryRunSummary: {
      schoolsToCreate: schoolsSet.size,
      usersToInvite: usersSet.size,
    },
  };
}
