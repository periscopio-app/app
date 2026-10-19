import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import {
  FOGAP_FORM_CODE,
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
  const comRascunho: Partial<Record<RePassoId, boolean>> = {};
  for (const p of RE_PASSOS) {
    if (p.id === "h") continue;
    const r = porCodigo.get(codigoDoPasso(p.id));
    if (r) {
      linhas[p.id] = r;
      comRascunho[p.id] = true;
    }
  }

  const [ata] = await db
    .select({ status: teaScreenings.status })
    .from(teaScreenings)
    .where(and(eq(teaScreenings.caseId, caseId), eq(teaScreenings.tenantId, tenantId), eq(teaScreenings.instrument, "ata")))
    .limit(1);
  const ataInfo = { existe: Boolean(ata), enviada: ata?.status === "enviado", status: ata?.status ?? null };
  if (ataInfo.existe) comRascunho.h = true;

  return {
    meta,
    metaRow,
    linhas,
    ata: ataInfo,
    situacao: situacaoDaJornada({ meta, comRascunho, ataEnviada: ataInfo.enviada }),
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
