import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@periscopio/shared";
import { cases, caseSummaries, caseTimeline, caseTransitions } from "@periscopio/shared";
import type { Actor } from "../security/actor";
import { db } from "../db/client";

export type JourneyState =
  | "rascunho"
  | "enviado_re"
  | "revisao_medica"
  | "delegado"
  | "retornado"
  | "encerrado";

// Compatível com db e com o objeto tx de db.transaction()
// PgTransaction estende PgDatabase estruturalmente em drizzle-orm 0.36.x
type AnyDb = NodePgDatabase<typeof schema>;

const JOURNEY_STATES = new Set<string>([
  "rascunho",
  "enviado_re",
  "revisao_medica",
  "delegado",
  "retornado",
  "encerrado",
]);

export function isJourneyState(v: unknown): v is JourneyState {
  return typeof v === "string" && JOURNEY_STATES.has(v);
}

type AllowedTransition = {
  from: JourneyState;
  to: JourneyState;
  roles: readonly string[];
};

// Neuro→psico NÃO é ordem fixa (Dra., 07/out/2026): o médico decide por caso (evento case:neuropsych_decision).
const ALLOWED_TRANSITIONS: AllowedTransition[] = [
  { from: "rascunho", to: "enviado_re", roles: ["ppi"] },
  { from: "enviado_re", to: "revisao_medica", roles: ["ppi", "md1"] }, // automática após envio
  { from: "revisao_medica", to: "delegado", roles: ["md1"] },
  { from: "delegado", to: "retornado", roles: ["md1", "specialist"] }, // automática (disparada pelo especialista que conclui a última seção) quando todas as seções concluídas
  { from: "retornado", to: "encerrado", roles: ["md1"] },
  { from: "enviado_re", to: "rascunho", roles: ["md1"] }, // devolução formal
  { from: "revisao_medica", to: "rascunho", roles: ["md1"] }, // devolução após revisão médica
];

function findAllowedTransition(
  from: JourneyState,
  to: JourneyState,
  actorRole: string
): AllowedTransition | undefined {
  return ALLOWED_TRANSITIONS.find(
    (t) => t.from === from && t.to === to && t.roles.includes(actorRole)
  );
}

/**
 * Aplica uma transição de estado dentro de uma transação externa.
 * Grava case_transitions + case_timeline atomicamente.
 * Quem chama é responsável pelo db.transaction().
 */
export async function applyTransitionInTx(
  tx: AnyDb,
  caseId: string,
  toState: JourneyState,
  actor: Actor,
  reason: string
): Promise<void> {
  if (!reason.trim()) {
    throw new Error("Motivo é obrigatório para registrar transição");
  }

  const [caseItem] = await tx
    .select({ id: cases.id, tenantId: cases.tenantId, journeyState: cases.journeyState })
    .from(cases)
    .where(and(eq(cases.id, caseId), eq(cases.tenantId, actor.tenantId)))
    .limit(1);

  if (!caseItem) throw new Error("Caso não encontrado");

  const current = (caseItem.journeyState ?? "rascunho") as JourneyState;
  const allowed = findAllowedTransition(current, toState, actor.role);

  if (!allowed) {
    throw new Error(
      `Transição de '${current}' para '${toState}' não permitida para o papel '${actor.role}'`
    );
  }

  await tx
    .update(cases)
    .set({ journeyState: toState, updatedAt: new Date() })
    .where(eq(cases.id, caseId));

  await tx.insert(caseTransitions).values({
    tenantId: actor.tenantId,
    caseId,
    fromState: current,
    toState,
    actorId: actor.id,
    actorRole: actor.role,
    reason: reason.trim(),
  });

  await tx.insert(caseTimeline).values({
    tenantId: actor.tenantId,
    caseId,
    actorId: actor.id,
    event: `journey:${current}→${toState}`,
    payload: { reason: reason.trim(), actorRole: actor.role },
  });
}

/**
 * Conveniência: transição em transação própria (para rotas sem outras operações atômicas).
 */
export async function transitionCase(
  caseId: string,
  toState: JourneyState,
  actor: Actor,
  reason: string
): Promise<void> {
  await db.transaction(async (tx) => {
    await applyTransitionInTx(tx as unknown as AnyDb, caseId, toState, actor, reason);
  });
}

/**
 * Verifica se todas as seções delegadas do caso estão concluídas.
 * Retorna false se não houver seções delegadas.
 */
export async function allSectionsDone(
  tx: AnyDb,
  caseId: string,
  tenantId: string
): Promise<boolean> {
  const sections = await tx
    .select({ status: caseSummaries.status })
    .from(caseSummaries)
    .where(and(eq(caseSummaries.caseId, caseId), eq(caseSummaries.tenantId, tenantId)));

  if (sections.length === 0) return false;
  return sections.every((s) => s.status === "concluido");
}
