import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import { db } from "../db/client";
import { expertBoardSettings, expertMeetingRequests, expertSlots, schools, users } from "@periscopio/shared";
import { requireActor } from "../security/actor";
import { BOARD_MANAGER_ROLES as MANAGER_ROLES, BOARD_REQUESTER_ROLES as REQUESTER_ROLES } from "../security/permissions";
import { sendTemplatedEmail } from "../email/templated";
import {
  MEETING_NOTICE,
  validateMeetingRequest,
  validateMeetUrl,
  validateSlotRange,
} from "../services/expert-meeting-guard";

const DEFAULT_NOTIFY = "equipe@projetoperiscopio.com.br";
const TZ = "America/Sao_Paulo";

const fmtDate = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, dateStyle: "full" }).format(d);
const fmtTime = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);
const appUrl = () => (process.env.APP_URL ?? "https://www.projetoperiscopio.com.br").replace(/\/$/, "");

async function getSettings(tenantId: string) {
  const [row] = await db.select().from(expertBoardSettings).where(eq(expertBoardSettings.tenantId, tenantId)).limit(1);
  return {
    meetUrl: row?.meetUrl ?? process.env.EXPERT_MEET_URL ?? null,
    notifyEmail: row?.notifyEmail ?? process.env.EXPERT_BOARD_EMAIL ?? DEFAULT_NOTIFY,
  };
}

export async function expertMeetingsRoutes(app: FastifyInstance) {
  // Horários futuros livres (qualquer papel que pode pedir ou gerir)
  app.get("/api/expert-meetings/slots", async (request, reply) => {
    const actor = await requireActor(request, reply, [...REQUESTER_ROLES, ...MANAGER_ROLES]);
    if (!actor) return;
    const isManager = (MANAGER_ROLES as readonly string[]).includes(actor.role);
    const rows = await db
      .select()
      .from(expertSlots)
      .where(
        and(
          eq(expertSlots.tenantId, actor.tenantId),
          gt(expertSlots.startsAt, new Date()),
          isManager ? undefined : eq(expertSlots.status, "available"),
        ),
      )
      .orderBy(asc(expertSlots.startsAt))
      .limit(200);
    return { slots: isManager ? rows : rows.map(({ id, startsAt, endsAt }) => ({ id, startsAt, endsAt })), notice: MEETING_NOTICE };
  });

  // Dra. cria horários
  app.post("/api/expert-meetings/slots", async (request, reply) => {
    const actor = await requireActor(request, reply, MANAGER_ROLES);
    if (!actor) return;
    const body = (request.body ?? {}) as { startsAt?: unknown; endsAt?: unknown };
    const range = validateSlotRange(body.startsAt, body.endsAt);
    if (!range.ok) return reply.status(400).send({ error: range.error });
    const [slot] = await db
      .insert(expertSlots)
      .values({ tenantId: actor.tenantId, startsAt: range.start, endsAt: range.end, createdBy: actor.id })
      .onConflictDoNothing()
      .returning();
    if (!slot) return reply.status(409).send({ error: "Já existe um horário neste início." });
    return reply.status(201).send({ slot });
  });

  // Dra. cancela horário livre
  app.delete("/api/expert-meetings/slots/:id", async (request, reply) => {
    const actor = await requireActor(request, reply, MANAGER_ROLES);
    if (!actor) return;
    const { id } = request.params as { id: string };
    const [slot] = await db
      .update(expertSlots)
      .set({ status: "cancelled" })
      .where(and(eq(expertSlots.id, id), eq(expertSlots.tenantId, actor.tenantId), eq(expertSlots.status, "available")))
      .returning();
    if (!slot) return reply.status(409).send({ error: "Só é possível cancelar horários livres." });
    return { slot };
  });

  // Sala fixa
  app.get("/api/expert-meetings/settings", async (request, reply) => {
    const actor = await requireActor(request, reply, MANAGER_ROLES);
    if (!actor) return;
    return getSettings(actor.tenantId);
  });

  app.put("/api/expert-meetings/settings", async (request, reply) => {
    const actor = await requireActor(request, reply, MANAGER_ROLES);
    if (!actor) return;
    const body = (request.body ?? {}) as { meetUrl?: unknown };
    const v = validateMeetUrl(body.meetUrl);
    if (!v.ok) return reply.status(400).send({ error: v.error });
    await db
      .insert(expertBoardSettings)
      .values({ tenantId: actor.tenantId, meetUrl: v.value, updatedBy: actor.id })
      .onConflictDoUpdate({
        target: expertBoardSettings.tenantId,
        set: { meetUrl: v.value, updatedBy: actor.id, updatedAt: new Date() },
      });
    return getSettings(actor.tenantId);
  });

  // Escola pede reunião
  app.post("/api/expert-meetings", async (request, reply) => {
    const actor = await requireActor(request, reply, REQUESTER_ROLES);
    if (!actor) return;
    const parsed = validateMeetingRequest(request.body);
    if (!parsed.ok) return reply.status(400).send({ error: parsed.error });
    const input = parsed.value;

    // Reserva atômica do horário
    const [slot] = await db
      .update(expertSlots)
      .set({ status: "booked" })
      .where(
        and(
          eq(expertSlots.id, input.slotId),
          eq(expertSlots.tenantId, actor.tenantId),
          eq(expertSlots.status, "available"),
          gt(expertSlots.startsAt, new Date()),
        ),
      )
      .returning();
    if (!slot) return reply.status(409).send({ error: "Este horário não está mais disponível. Escolha outro." });

    let meeting;
    try {
      [meeting] = await db
        .insert(expertMeetingRequests)
        .values({
          tenantId: actor.tenantId,
          schoolId: actor.schoolId,
          slotId: slot.id,
          requesterId: actor.id,
          professionalName: input.professionalName,
          topic: input.topic,
          studentCode: input.studentCode,
        })
        .returning();
    } catch (err) {
      await db.update(expertSlots).set({ status: "available" }).where(eq(expertSlots.id, slot.id));
      throw err;
    }

    const [school] = actor.schoolId
      ? await db.select({ name: schools.name }).from(schools).where(eq(schools.id, actor.schoolId)).limit(1)
      : [];
    const settings = await getSettings(actor.tenantId);
    const email = await sendTemplatedEmail({
      to: settings.notifyEmail,
      alias: "expert-meeting-request",
      variables: {
        SCHOOL_NAME: school?.name ?? "Escola",
        PROFESSIONAL_NAME: input.professionalName,
        SLOT_DATE: fmtDate(slot.startsAt),
        SLOT_TIME: `${fmtTime(slot.startsAt)}–${fmtTime(slot.endsAt)}`,
        TOPIC: input.topic,
        ACTION_URL: `${appUrl()}/login`,
      },
    });
    if (!email.ok) request.log.warn({ err: email.error }, "e-mail de pedido de reunião não enviado");

    return reply.status(201).send({ meeting, emailSent: email.ok });
  });

  // Lista: board vê todos; solicitante vê os seus
  app.get("/api/expert-meetings", async (request, reply) => {
    const actor = await requireActor(request, reply, [...REQUESTER_ROLES, ...MANAGER_ROLES]);
    if (!actor) return;
    const isManager = (MANAGER_ROLES as readonly string[]).includes(actor.role);
    const rows = await db
      .select({
        id: expertMeetingRequests.id,
        status: expertMeetingRequests.status,
        professionalName: expertMeetingRequests.professionalName,
        topic: expertMeetingRequests.topic,
        studentCode: expertMeetingRequests.studentCode,
        meetUrl: expertMeetingRequests.meetUrl,
        decisionNote: expertMeetingRequests.decisionNote,
        createdAt: expertMeetingRequests.createdAt,
        startsAt: expertSlots.startsAt,
        endsAt: expertSlots.endsAt,
        schoolName: schools.name,
      })
      .from(expertMeetingRequests)
      .innerJoin(expertSlots, eq(expertSlots.id, expertMeetingRequests.slotId))
      .leftJoin(schools, eq(schools.id, expertMeetingRequests.schoolId))
      .where(
        and(
          eq(expertMeetingRequests.tenantId, actor.tenantId),
          isManager ? undefined : eq(expertMeetingRequests.requesterId, actor.id),
        ),
      )
      .orderBy(desc(expertSlots.startsAt))
      .limit(100);
    return { meetings: rows };
  });

  // Dra. confirma ou recusa
  for (const action of ["confirm", "decline"] as const) {
    app.patch(`/api/expert-meetings/:id/${action}`, async (request, reply) => {
      const actor = await requireActor(request, reply, MANAGER_ROLES);
      if (!actor) return;
      const { id } = request.params as { id: string };
      const note = typeof (request.body as any)?.note === "string" ? String((request.body as any).note).trim().slice(0, 300) : null;
      const settings = await getSettings(actor.tenantId);
      if (action === "confirm" && !settings.meetUrl) {
        return reply.status(409).send({ error: "Configure o link fixo do Google Meet antes de confirmar." });
      }

      const [meeting] = await db
        .update(expertMeetingRequests)
        .set({
          status: action === "confirm" ? "confirmed" : "declined",
          meetUrl: action === "confirm" ? settings.meetUrl : null,
          decisionNote: note,
          decidedBy: actor.id,
          decidedAt: new Date(),
        })
        .where(
          and(
            eq(expertMeetingRequests.id, id),
            eq(expertMeetingRequests.tenantId, actor.tenantId),
            eq(expertMeetingRequests.status, "pending"),
          ),
        )
        .returning();
      if (!meeting) return reply.status(409).send({ error: "Pedido não encontrado ou já decidido." });

      if (action === "decline") {
        await db.update(expertSlots).set({ status: "available" }).where(eq(expertSlots.id, meeting.slotId));
      }

      const [slot] = await db.select().from(expertSlots).where(eq(expertSlots.id, meeting.slotId)).limit(1);
      const [requester] = await db.select({ email: users.email }).from(users).where(eq(users.id, meeting.requesterId)).limit(1);
      const [school] = meeting.schoolId
        ? await db.select({ name: schools.name }).from(schools).where(eq(schools.id, meeting.schoolId)).limit(1)
        : [];

      const common = {
        PROFESSIONAL_NAME: meeting.professionalName,
        SLOT_DATE: fmtDate(slot.startsAt),
        SLOT_TIME: `${fmtTime(slot.startsAt)}–${fmtTime(slot.endsAt)}`,
      };
      const results = [];
      if (requester) {
        results.push(
          await sendTemplatedEmail(
            action === "confirm"
              ? {
                  to: requester.email,
                  alias: "expert-meeting-confirmed",
                  variables: { ...common, SCHOOL_NAME: school?.name ?? "sua escola", TOPIC: meeting.topic, MEET_URL: settings.meetUrl! },
                }
              : {
                  to: requester.email,
                  alias: "expert-meeting-declined",
                  variables: { ...common, NOTE: note || "Sem observações.", ACTION_URL: `${appUrl()}/login` },
                },
          ),
        );
      }
      if (action === "confirm") {
        // cópia para a equipe
        results.push(
          await sendTemplatedEmail({
            to: settings.notifyEmail,
            alias: "expert-meeting-confirmed",
            variables: { ...common, SCHOOL_NAME: school?.name ?? "escola", TOPIC: meeting.topic, MEET_URL: settings.meetUrl! },
          }),
        );
      }
      for (const r of results) if (!r.ok) request.log.warn({ err: r.error }, "e-mail de decisão não enviado");

      return { meeting, emailSent: results.length > 0 && results.every((r) => r.ok) };
    });
  }
}
