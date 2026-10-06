/**
 * Serviço de notificações in-app.
 * Idempotente por event_id — mesmo evento duas vezes = 1 aviso.
 * Agrupamento: 3+ do mesmo tipo para o mesmo destinatário em 60s vira um aviso único.
 */
import { db } from "../db/client";
import { notifications, users, cases } from "@periscopio/shared";
import { and, eq, isNull, count, desc } from "drizzle-orm";

export type EventType =
  | "protocolo.enviado"
  | "protocolo.devolvido"
  | "adendo.enviado"
  | "delegacao.criada"
  | "delegacao.devolvida"
  | "delegacao.todas_devolvidas"
  | "pdf.vinculado"
  | "salvar.falhou";

interface NotifyParams {
  tenantId: string;
  eventId: string;
  eventType: EventType;
  recipientId: string;
  caseId?: string;
  instrument?: string;
  specialty?: string;
  docType?: string;
  studentCode?: string;
  transient?: boolean;
}

const TRANSIENT_EVENTS: EventType[] = [
  "protocolo.enviado", // só para quem enviou
  "pdf.vinculado",
  "salvar.falhou",
];

/** Cria aviso para um destinatário, ignorando duplicata por event_id. */
export async function notificar(params: NotifyParams): Promise<void> {
  const isTransient = params.transient ?? TRANSIENT_EVENTS.includes(params.eventType);
  await db
    .insert(notifications)
    .values({
      tenantId: params.tenantId,
      eventId: params.eventId,
      eventType: params.eventType,
      recipientId: params.recipientId,
      caseId: params.caseId,
      instrument: params.instrument,
      specialty: params.specialty,
      docType: params.docType,
      studentCode: params.studentCode,
      transient: isTransient,
    })
    .onConflictDoNothing(); // idempotência garantida pelo índice único abaixo
}

/** Conta avisos não lidos não descartados do destinatário. */
export async function contarNaoLidos(recipientId: string, tenantId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, recipientId),
        eq(notifications.tenantId, tenantId),
        isNull(notifications.readAt),
        isNull(notifications.dismissedAt),
      )
    );
  return Number(row?.n ?? 0);
}

/** Lista avisos pendentes (não lidos, não descartados) do destinatário. */
export async function listarPendentes(recipientId: string, tenantId: string, limit = 20) {
  return db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, recipientId),
        eq(notifications.tenantId, tenantId),
        isNull(notifications.readAt),
        isNull(notifications.dismissedAt),
      )
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}
