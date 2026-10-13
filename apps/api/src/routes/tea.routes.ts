import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import {
  ABC_DOMAINS,
  ABC_TEA_ITEMS,
  ASQ_ITEMS,
  ASQ_SKIPPED_WHEN_NONVERBAL,
  ATA_GROUPS,
  ATA_ONSET_LABEL,
  MCHAT_ITEMS,
  SRS2_ITEMS,
  SRS2_SCALE,
  TEA_CATALOG_VERSION,
  TEA_INSTRUMENTS,
  TEA_INSTRUMENT_CODES,
  TEA_RESPONDENTS,
  caseSummaries,
  caseTimeline,
  cases,
  scoreTea,
  students,
  teaScreenings,
  validateAnswers,
  withoutReference,
  type TeaInstrumentCode,
} from "@periscopio/shared";
import { requireActor, type Actor } from "../security/actor";
import { canAccessSchool } from "../security/tenancy";
import { canonicalRole } from "../security/capabilities";
import { decideCapability } from "../services/privilege.service";
import { recordAudit } from "../services/audit.service";
import { summarizeTea, type SubmittedScreening } from "../services/tea-summary.service";

const FILL_CAPS = TEA_INSTRUMENT_CODES.map((c) => TEA_INSTRUMENTS[c].fillCapability);

const putSchema = z.object({
  answers: z.unknown(),
  respondent: z.enum(TEA_RESPONDENTS.map((r) => r.value) as [string, ...string[]]).nullable().optional(),
  appliedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

interface Access {
  caseRow: { id: string; tenantId: string; journeyState: string };
  perInstrument: Record<TeaInstrumentCode, { canFill: boolean; canRead: boolean }>;
  scoreView: boolean;
  referenceView: boolean;
  aiSummary: boolean;
}

type Denied = { status: number; error: string };

/** Quem pode o quê neste caso: privilégios (caixinhas) + escopo da rede/escola + delegação para especialistas. */
async function resolveAccess(actor: Actor, caseId: string): Promise<Access | Denied> {
  const [row] = await db
    .select({ id: cases.id, tenantId: cases.tenantId, journeyState: cases.journeyState, schoolId: students.schoolId })
    .from(cases)
    .innerJoin(students, eq(cases.studentId, students.id))
    .where(eq(cases.id, caseId))
    .limit(1);
  if (!row || !canAccessSchool(actor, row.tenantId, row.schoolId)) return { status: 404, error: "Caso não encontrado" };

  const isSpecialist = canonicalRole(actor.role) === "specialist";
  if (isSpecialist) {
    const [assigned] = await db
      .select({ id: caseSummaries.id })
      .from(caseSummaries)
      .where(and(eq(caseSummaries.caseId, caseId), eq(caseSummaries.assignedProfessionalId, actor.id)))
      .limit(1);
    if (!assigned) return { status: 403, error: "Sem seção atribuída neste caso" };
  }

  const open = row.journeyState !== "encerrado";
  const readAll = (await decideCapability(actor, "tea.read_all")).allowed;
  const perInstrument = {} as Access["perInstrument"];
  for (const code of TEA_INSTRUMENT_CODES) {
    const fill = (await decideCapability(actor, TEA_INSTRUMENTS[code].fillCapability)).allowed;
    perInstrument[code] = { canFill: fill && open, canRead: fill || readAll };
  }
  return {
    caseRow: { id: row.id, tenantId: row.tenantId, journeyState: row.journeyState },
    perInstrument,
    scoreView: (await decideCapability(actor, "tea.score.view")).allowed,
    referenceView: (await decideCapability(actor, "tea.reference.view")).allowed,
    aiSummary: (await decideCapability(actor, "tea.ai_summary")).allowed,
  };
}

const denied = (a: Access | Denied): a is Denied => "status" in a;

function shape(row: typeof teaScreenings.$inferSelect, access: Access) {
  const code = row.instrument as TeaInstrumentCode;
  const perm = access.perInstrument[code];
  let score: ReturnType<typeof scoreTea> | undefined;
  if (perm.canFill || access.scoreView) {
    try {
      score = scoreTea(code, row.answers);
      if (!access.referenceView) score = withoutReference(score);
    } catch {
      score = undefined;
    }
  }
  return {
    id: row.id,
    instrument: code,
    version: row.instrumentVersion,
    status: row.status,
    respondent: row.respondent,
    appliedOn: row.appliedOn,
    answers: row.answers,
    score,
    submittedAt: row.submittedAt,
    updatedAt: row.updatedAt,
  };
}

function instrumentFromParam(v: string): TeaInstrumentCode | null {
  return (TEA_INSTRUMENT_CODES as readonly string[]).includes(v) ? (v as TeaInstrumentCode) : null;
}

export async function teaRoutes(app: FastifyInstance) {
  /** Textos dos 5 instrumentos (formulário-fonte). Só para quem preenche ou lê algum deles. */
  app.get("/api/tea/catalog", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;
    const allowed = (await Promise.all([...FILL_CAPS, "tea.read_all"].map((c) => decideCapability(actor, c)))).some((d) => d.allowed);
    if (!allowed) return reply.status(403).send({ error: "Seu perfil não possui permissão para esta ação", capability: "tea.read_all" });
    return {
      version: TEA_CATALOG_VERSION,
      instruments: TEA_INSTRUMENT_CODES.map((c) => TEA_INSTRUMENTS[c]),
      content: {
        ata: { groups: ATA_GROUPS, onsetLabel: ATA_ONSET_LABEL },
        asq: { items: ASQ_ITEMS.map(({ n, text }) => ({ n, text })), skippedWhenNonverbal: ASQ_SKIPPED_WHEN_NONVERBAL },
        mchat: { items: MCHAT_ITEMS },
        srs2: { items: SRS2_ITEMS, scale: SRS2_SCALE },
        abc: { items: ABC_TEA_ITEMS.map(({ n, text, domain }) => ({ n, text, domain })), domains: ABC_DOMAINS },
      },
      respondents: TEA_RESPONDENTS,
    };
  });

  /** Situação da triagem de um caso: só aparecem os instrumentos que a pessoa preenche ou pode ler. */
  app.get("/api/cases/:caseId/tea", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;
    const { caseId } = request.params as { caseId: string };
    const access = await resolveAccess(actor, caseId);
    if (denied(access)) return reply.status(access.status).send({ error: access.error });

    const visible = TEA_INSTRUMENT_CODES.filter((c) => access.perInstrument[c].canFill || access.perInstrument[c].canRead);
    if (visible.length === 0) {
      return reply.status(403).send({ error: "Seu perfil não possui permissão para esta ação", capability: "tea.read_all" });
    }
    const rows = await db.select().from(teaScreenings).where(and(eq(teaScreenings.caseId, caseId), eq(teaScreenings.tenantId, access.caseRow.tenantId)));

    await recordAudit(
      {
        tenantId: actor.tenantId,
        userId: actor.id,
        userEmail: actor.email,
        action: "tea.read",
        entityType: "case",
        entityId: caseId,
        payload: { instruments: visible.filter((c) => rows.some((r) => r.instrument === c)) },
      },
      request
    );

    return {
      caseId,
      journeyState: access.caseRow.journeyState,
      canSummarize: access.aiSummary,
      instruments: visible.map((code) => {
        const row = rows.find((r) => r.instrument === code);
        return {
          code,
          canFill: access.perInstrument[code].canFill,
          canRead: access.perInstrument[code].canRead,
          screening: row ? shape(row, access) : null,
        };
      }),
    };
  });

  /** Salvar rascunho (cria ou atualiza). Depois de enviado, não muda mais. */
  app.put("/api/cases/:caseId/tea/:instrument", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;
    const { caseId, instrument } = request.params as { caseId: string; instrument: string };
    const code = instrumentFromParam(instrument);
    if (!code) return reply.status(404).send({ error: "Instrumento desconhecido" });

    const access = await resolveAccess(actor, caseId);
    if (denied(access)) return reply.status(access.status).send({ error: access.error });
    if (!access.perInstrument[code].canFill) {
      const closed = access.caseRow.journeyState === "encerrado";
      return reply.status(403).send({
        error: closed ? "Caso encerrado: a triagem não pode mais ser alterada" : "Seu perfil não possui permissão para esta ação",
        capability: TEA_INSTRUMENTS[code].fillCapability,
      });
    }

    const body = putSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "Dados inválidos" });
    const bad = validateAnswers(code, body.data.answers);
    if (bad) return reply.status(400).send({ error: bad });
    if (body.data.appliedOn && body.data.appliedOn > new Date().toISOString().slice(0, 10)) {
      return reply.status(400).send({ error: "A data de aplicação não pode ser futura" });
    }

    const [existing] = await db
      .select()
      .from(teaScreenings)
      .where(and(eq(teaScreenings.caseId, caseId), eq(teaScreenings.instrument, code)))
      .limit(1);
    if (existing?.status === "enviado") {
      return reply.status(409).send({ error: "Esta triagem já foi enviada e não pode mais ser alterada" });
    }

    const values = {
      answers: body.data.answers as object,
      respondent: body.data.respondent ?? existing?.respondent ?? null,
      appliedOn: body.data.appliedOn ?? existing?.appliedOn ?? null,
      updatedAt: new Date(),
    };
    let row;
    if (existing) {
      [row] = await db.update(teaScreenings).set(values).where(eq(teaScreenings.id, existing.id)).returning();
    } else {
      [row] = await db
        .insert(teaScreenings)
        .values({
          tenantId: access.caseRow.tenantId,
          caseId,
          instrument: code,
          instrumentVersion: TEA_CATALOG_VERSION,
          status: "rascunho",
          createdBy: actor.id,
          ...values,
        })
        .returning();
    }
    return { success: true, screening: shape(row, access) };
  });

  /** Enviar: confere o que falta, guarda a pontuação do momento e trava as respostas. */
  app.post("/api/cases/:caseId/tea/:instrument/submit", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;
    const { caseId, instrument } = request.params as { caseId: string; instrument: string };
    const code = instrumentFromParam(instrument);
    if (!code) return reply.status(404).send({ error: "Instrumento desconhecido" });

    const access = await resolveAccess(actor, caseId);
    if (denied(access)) return reply.status(access.status).send({ error: access.error });
    if (!access.perInstrument[code].canFill) {
      return reply.status(403).send({ error: "Seu perfil não possui permissão para esta ação", capability: TEA_INSTRUMENTS[code].fillCapability });
    }

    const [row] = await db
      .select()
      .from(teaScreenings)
      .where(and(eq(teaScreenings.caseId, caseId), eq(teaScreenings.instrument, code)))
      .limit(1);
    if (!row) return reply.status(422).send({ error: "Salve as respostas antes de enviar" });
    if (row.status === "enviado") return reply.status(409).send({ error: "Esta triagem já foi enviada" });

    const score = scoreTea(code, row.answers);
    const missing: string[] = [];
    if (!score.complete) missing.push(`${score.required - score.answered} resposta(s) obrigatória(s)`);
    if (TEA_INSTRUMENTS[code].respondentRequired && !row.respondent) missing.push("quem respondeu");
    if (!row.appliedOn) missing.push("data da aplicação");
    if (missing.length) return reply.status(422).send({ error: "Faltam: " + missing.join(", "), missing });

    const now = new Date();
    const [updated] = await db
      .update(teaScreenings)
      .set({ status: "enviado", submittedBy: actor.id, submittedAt: now, updatedAt: now, scoring: withoutReference(score) })
      .where(and(eq(teaScreenings.id, row.id), eq(teaScreenings.status, "rascunho")))
      .returning();
    if (!updated) return reply.status(409).send({ error: "Esta triagem já foi enviada" });

    await db.insert(caseTimeline).values({
      tenantId: access.caseRow.tenantId,
      caseId,
      actorId: actor.id,
      event: "tea:submitted",
      payload: { instrument: code, version: TEA_CATALOG_VERSION, actorRole: actor.role },
    });
    await recordAudit(
      {
        tenantId: actor.tenantId,
        userId: actor.id,
        userEmail: actor.email,
        action: "tea.submit",
        entityType: "case",
        entityId: caseId,
        payload: { instrument: code },
      },
      request
    );
    return { success: true, screening: shape(updated, access) };
  });

  /** Sumário organizado (IA com trava; cai para regras). Usa só o que a pessoa pode ler e que já foi enviado. */
  app.post("/api/cases/:caseId/tea/summary", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;
    const { caseId } = request.params as { caseId: string };
    const access = await resolveAccess(actor, caseId);
    if (denied(access)) return reply.status(access.status).send({ error: access.error });
    if (!access.aiSummary) {
      return reply.status(403).send({ error: "Seu perfil não possui permissão para esta ação", capability: "tea.ai_summary" });
    }

    const rows = await db
      .select()
      .from(teaScreenings)
      .where(and(eq(teaScreenings.caseId, caseId), eq(teaScreenings.tenantId, access.caseRow.tenantId), eq(teaScreenings.status, "enviado")));
    const usable: SubmittedScreening[] = rows
      .filter((r) => access.perInstrument[r.instrument as TeaInstrumentCode]?.canRead)
      .map((r) => ({ instrument: r.instrument as TeaInstrumentCode, answers: r.answers }));
    if (usable.length === 0) {
      return reply.status(422).send({ error: "Nenhum instrumento enviado que você possa ver. Envie ao menos um formulário." });
    }

    const out = await summarizeTea(usable);
    await recordAudit(
      {
        tenantId: actor.tenantId,
        userId: actor.id,
        userEmail: actor.email,
        action: "tea.ai_summary",
        entityType: "case",
        entityId: caseId,
        payload: { instruments: usable.map((u) => u.instrument), source: out.source },
      },
      request
    );
    return { caseId, ...out, instruments: usable.map((u) => u.instrument) };
  });
}
