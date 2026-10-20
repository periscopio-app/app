import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import {
  FOGAP_FORM_CODE,
  cases,
  students,
  makeFogapPayloadVazio,
  rotearPorIdade,
  sumarioComPadroes,
  type FogapPayload,
  FOGAP_VERSION,
  RE_FORMS,
  RE_JORNADA_FORM_CODE,
  RE_JORNADA_VERSION,
  RE_PASSOS,
  SNAP4_FORM_CODE,
  metaComPadroes,
  metaVazia,
  reAssessments,
  situacaoDaJornada,
  teaScreenings,
  type ReFormId,
  hojeBrasilia,
  type JornadaSituacao,
  type ReJornadaMeta,
  type RePassoId,
} from "@periscopio/shared";

export type ReRow = typeof reAssessments.$inferSelect;

/** Código do instrumento em `re_assessments.form_code` para cada passo da jornada. */
export function codigoDoPasso(id: RePassoId): string {
  if (id === "g") return SNAP4_FORM_CODE;
  if (id === "i") return FOGAP_FORM_CODE;
  if (id === "h") return "ata";
  return RE_FORMS[id].code;
}

export function versaoDoCodigo(code: string): string {
  return code === FOGAP_FORM_CODE ? FOGAP_VERSION : RE_JORNADA_VERSION;
}

export interface JornadaCarregada {
  meta: ReJornadaMeta;
  metaRow: ReRow | null;
  /** Linha de `re_assessments` de cada passo (h usa a ATA, em `tea_screenings`). */
  linhas: Partial<Record<RePassoId, ReRow>>;
  ata: { existe: boolean; enviada: boolean; status: string | null };
  situacao: JornadaSituacao;
}

export async function carregarJornada(tenantId: string, caseId: string): Promise<JornadaCarregada> {
  const codigos = [RE_JORNADA_FORM_CODE, FOGAP_FORM_CODE, SNAP4_FORM_CODE, ...Object.values(RE_FORMS).map((f) => f.code)];
  const rows = await db
    .select()
    .from(reAssessments)
    .where(and(eq(reAssessments.caseId, caseId), eq(reAssessments.tenantId, tenantId), inArray(reAssessments.formCode, codigos)));

  const porCodigo = new Map(rows.map((r) => [r.formCode, r]));
  const metaRow = porCodigo.get(RE_JORNADA_FORM_CODE) ?? null;
  const meta = metaRow ? metaComPadroes(metaRow.payload) : metaVazia();

  const linhas: Partial<Record<RePassoId, ReRow>> = {};
  for (const p of RE_PASSOS) {
    if (p.id === "h") continue;
    const r = porCodigo.get(codigoDoPasso(p.id));
    if (r) linhas[p.id] = r;
  }

  const [ata] = await db
    .select({ status: teaScreenings.status })
    .from(teaScreenings)
    .where(and(eq(teaScreenings.caseId, caseId), eq(teaScreenings.tenantId, tenantId), eq(teaScreenings.instrument, "ata")))
    .limit(1);
  const ataInfo = { existe: Boolean(ata), enviada: ata?.status === "enviado", status: ata?.status ?? null };

  const [aluno] = await db
    .select({ grade: students.grade })
    .from(cases)
    .innerJoin(students, eq(cases.studentId, students.id))
    .where(eq(cases.id, caseId))
    .limit(1);

  const payloads: Partial<Record<ReFormId, unknown>> = {};
  for (const id of Object.keys(RE_FORMS) as ReFormId[]) payloads[id] = linhas[id]?.payload;
  const fogap = linhas.i?.payload as Partial<FogapPayload> | undefined;

  return {
    meta,
    metaRow,
    linhas,
    ata: ataInfo,
    situacao: situacaoDaJornada({
      meta,
      payloads,
      snap4: linhas.g?.payload,
      sumario: fogap?.secao_sumario,
      ata: { existe: ataInfo.existe, enviada: ataInfo.enviada },
      serieDoAluno: aluno?.grade ?? null,
    }),
  };
}

/** Idade em anos e meses a partir do ano/mês de nascimento (o sistema não guarda a data completa). */
export function idadeAPartirDoNascimento(birthYear: number, birthMonth: number, hoje = hojeBrasilia()): { anos: number; meses: number } {
  const [y, m] = hoje.split("-").map(Number);
  const total = y * 12 + m - (birthYear * 12 + birthMonth);
  if (total < 0) return { anos: -1, meses: 0 };
  return { anos: Math.floor(total / 12), meses: total % 12 };
}

/**
 * Monta o registro do FOGAP (Formulário I) a partir do cadastro do aluno: idade, grupo e série vêm do cadastro,
 * nunca digitados. `secaoSumario`/`secaoEncaminhamento` entram quando o RE salvou alterações.
 */
export function montarPayloadFogap(params: {
  student: { birthYear: number | null; birthMonth: number | null; grade: string | null };
  atual?: unknown;
  secaoSumario?: object;
  secaoEncaminhamento?: unknown;
}): FogapPayload {
  const { student } = params;
  const base: FogapPayload = { ...makeFogapPayloadVazio(), ...((params.atual as Partial<FogapPayload>) ?? {}) };
  const idade = idadeAPartirDoNascimento(student.birthYear ?? 0, student.birthMonth ?? 1);
  const rota = rotearPorIdade(idade.anos, idade.meses);
  const sumario = sumarioComPadroes({ ...(params.secaoSumario ?? base.secao_sumario) });
  sumario.serie = student.grade ?? "";
  return {
    ...base,
    fogap_state: rota.estado,
    grupo: "grupo" in rota ? rota.grupo : null,
    idade_anos: idade.anos >= 0 ? idade.anos : null,
    idade_meses: idade.anos >= 0 ? idade.meses : null,
    total_meses: "total_meses" in rota ? rota.total_meses : null,
    secao_sumario: sumario,
    secao_encaminhamento: (params.secaoEncaminhamento as FogapPayload["secao_encaminhamento"] | undefined) ?? base.secao_encaminhamento,
  };
}

/** Grava o estado da jornada (somente a API chama isto). */
export async function salvarMeta(params: {
  tenantId: string;
  caseId: string;
  userId: string;
  atual: ReRow | null;
  meta: ReJornadaMeta;
}): Promise<void> {
  const { tenantId, caseId, userId, atual, meta } = params;
  if (atual) {
    await db.update(reAssessments).set({ payload: meta, updatedAt: new Date() }).where(eq(reAssessments.id, atual.id));
    return;
  }
  await db.insert(reAssessments).values({
    tenantId,
    caseId,
    formCode: RE_JORNADA_FORM_CODE,
    formVersion: RE_JORNADA_VERSION,
    status: "rascunho",
    payload: meta,
    createdBy: userId,
  });
}
