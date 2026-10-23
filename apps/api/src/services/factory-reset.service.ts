import { and, eq, getTableName, inArray, notInArray, sql } from "drizzle-orm";
import {
  boardSupervision,
  caseMedicalForms,
  caseSpecialtyForms,
  caseSummaries,
  caseTimeline,
  caseTransitions,
  cases,
  clinicalAttachments,
  consentAcceptances,
  evaluations,
  notifications,
  psychAssessments,
  reAssessments,
  reOptionalStepUsage,
  reStepTimings,
  students,
  studentIdentityVault,
  symptomMeasurements,
  teaScreenings,
  teacherObservations,
  tenants,
} from "@periscopio/shared";
import { db } from "../db/client";

/**
 * Reset de fábrica do piloto (Bloco 2, 23/out/2026).
 *
 * Zera os dados de caso/aluno dos municípios de DEMONSTRAÇÃO (tenants.demo = true),
 * para que o piloto comece limpo. NUNCA apaga municípios reais.
 *
 * Três travas independentes protegem o dado real:
 *  1. Só entra quem tem `demo = true` no banco.
 *  2. Uma lista fixa de IDs/nomes protegidos é sempre removida do alvo, mesmo se marcada por engano.
 *  3. Mantém tenants, escolas e usuários: apaga só o conteúdo de aluno/caso, nunca a estrutura.
 */

/** Municípios que nunca podem ser apagados, aconteça o que acontecer. */
export const PROTECTED_TENANT_IDS = [
  "00000000-0000-0000-0000-000000000001", // Plataforma Global
  "a6232550-b4f2-4a2f-9fbc-6f8eeb482d0b", // Município de Tarumã (dado real)
] as const;

/** Nomes protegidos por segurança extra (além dos IDs): Tarumã em qualquer grafia. */
const PROTECTED_NAME_LIKE = "%tarum%";

export interface DemoTenant {
  id: string;
  name: string;
  municipalityCode: string;
}

/** Lista os municípios que o reset pode zerar: demo = true, menos os protegidos. */
export async function listDemoTenants(): Promise<DemoTenant[]> {
  const rows = await db
    .select({ id: tenants.id, name: tenants.name, municipalityCode: tenants.municipalityCode })
    .from(tenants)
    .where(
      and(
        eq(tenants.demo, true),
        notInArray(tenants.id, [...PROTECTED_TENANT_IDS]),
        sql`lower(${tenants.name}) NOT LIKE ${PROTECTED_NAME_LIKE}`
      )
    );
  return rows;
}

/**
 * Tabelas de conteúdo de aluno/caso apagadas pelo reset, em ordem segura de chave estrangeira
 * (filhos antes dos pais). Estrutura (tenants, escolas, usuários) e dado real (legacy_*, Tarumã) ficam.
 */
const WIPE_ORDER = [
  caseSpecialtyForms,
  caseSummaries,
  caseMedicalForms,
  reAssessments,
  caseTransitions,
  caseTimeline,
  boardSupervision,
  notifications,
  clinicalAttachments,
  teaScreenings,
  symptomMeasurements,
  reStepTimings,
  reOptionalStepUsage,
  consentAcceptances,
  teacherObservations,
  psychAssessments,
  evaluations,
  studentIdentityVault,
  cases,
  students,
] as const;

/**
 * Tabelas de histórico com gatilho append-only (BEFORE DELETE que levanta exceção).
 * O reset precisa desligá-las só durante a limpeza e religar antes do commit. Tudo dentro da
 * transação: se algo falhar, o rollback também restaura os gatilhos.
 */
const APPEND_ONLY_TABLES = ["case_timeline", "case_transitions", "tea_screenings", "symptom_measurements", "re_optional_step_usage"] as const;

const NOMES: Record<string, string> = {
  case_specialty_forms: "Formulários das especialidades",
  case_summaries: "Seções/sumários dos especialistas",
  case_medical_forms: "Formulários do médico",
  re_assessments: "Avaliações do RE (FOGAP e jornada)",
  case_transitions: "Transições de estado do caso",
  case_timeline: "Trilha de eventos do caso",
  board_supervision: "Supervisões do Board",
  notifications: "Notificações",
  clinical_attachments: "Anexos clínicos (laudos)",
  tea_screenings: "Triagens TEA",
  symptom_measurements: "Medições de sintomas",
  re_step_timings: "Tempos de preenchimento do RE",
  re_optional_step_usage: "Uso do passo opcional do RE",
  consent_acceptances: "Aceites de consentimento",
  teacher_observations: "Observações do professor",
  psych_assessments: "Avaliações psicopedagógicas/psicológicas",
  evaluations: "Escalas (M-CHAT, FOGAP, SRQ-20)",
  student_identity_vault: "Cofre de identidade do aluno",
  cases: "Casos",
  students: "Alunos",
};

export interface ResetPreview {
  tenants: DemoTenant[];
  counts: { table: string; label: string; rows: number }[];
  total: number;
}

function tableName(t: (typeof WIPE_ORDER)[number]): string {
  return getTableName(t);
}

/** Conta, sem apagar, o que o reset removeria dos municípios de demonstração. */
export async function previewReset(): Promise<ResetPreview> {
  const demoTenants = await listDemoTenants();
  const ids = demoTenants.map((t) => t.id);
  if (ids.length === 0) return { tenants: [], counts: [], total: 0 };

  const counts: ResetPreview["counts"] = [];
  let total = 0;
  for (const t of WIPE_ORDER) {
    const name = tableName(t);
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(t)
      .where(inArray((t as any).tenantId, ids));
    const rows = row?.n ?? 0;
    total += rows;
    counts.push({ table: name, label: NOMES[name] ?? name, rows });
  }
  return { tenants: demoTenants, counts, total };
}

export interface ResetResult {
  tenants: DemoTenant[];
  deleted: { table: string; label: string; rows: number }[];
  total: number;
}

/**
 * Apaga, numa transação única, os dados de aluno/caso dos municípios de demonstração.
 * Se qualquer passo falhar, nada é apagado (rollback). Retorna o que foi removido por tabela.
 */
export async function executeReset(): Promise<ResetResult> {
  const demoTenants = await listDemoTenants();
  const ids = demoTenants.map((t) => t.id);
  if (ids.length === 0) return { tenants: [], deleted: [], total: 0 };

  const deleted: ResetResult["deleted"] = [];
  let total = 0;
  await db.transaction(async (tx) => {
    // Desliga os gatilhos append-only só para esta limpeza (religados no finally, antes do commit).
    for (const name of APPEND_ONLY_TABLES) {
      await tx.execute(sql.raw(`ALTER TABLE ${name} DISABLE TRIGGER USER`));
    }
    try {
      for (const t of WIPE_ORDER) {
        const name = tableName(t);
        const res: any = await tx.delete(t).where(inArray((t as any).tenantId, ids));
        const rows = typeof res?.rowCount === "number" ? res.rowCount : 0;
        total += rows;
        deleted.push({ table: name, label: NOMES[name] ?? name, rows });
      }
    } finally {
      for (const name of APPEND_ONLY_TABLES) {
        await tx.execute(sql.raw(`ALTER TABLE ${name} ENABLE TRIGGER USER`));
      }
    }
  });
  return { tenants: demoTenants, deleted, total };
}
