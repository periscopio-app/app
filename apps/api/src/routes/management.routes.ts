import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  RE_JORNADA_FORM_CODE,
  RE_PASSOS,
  auditLogs,
  cases,
  FOGAP_FORM_CODE,
  reAssessments,
  reOptionalStepUsage,
  reStepTimings,
  reTimeBaselines,
  schools,
  students,
  teaScreenings,
} from "@periscopio/shared";
import { db } from "../db/client";
import { requireCapability, type Actor } from "../security/actor";
import { decideCapability } from "../services/privilege.service";
import { canonicalRole } from "../security/capabilities";
import { MANAGEMENT_VIEW_ROLES } from "../security/permissions";
import { JOURNEY_LABELS } from "../services/bi-semantic.service";
import { resumirTea, resumirTempos, resumirUsoOpcional } from "../services/re-observability.service";

/**
 * Visões da gestão (gestor municipal e diretor/gestor escolar).
 * Regra do PM: só podem ver (1) o sumário do RE e (2) a lista final de alunos encaminhados ao núcleo
 * assistencial. Nada de respostas item a item, parecer de especialista, decisão médica ou dado do responsável.
 * O aluno aparece só pelo código pseudonimizado.
 */

/** Etapas em que o aluno já foi encaminhado ao núcleo (a partir do envio do RE ao médico). */
const REFERRED_STATES = ["revisao_medica", "delegado", "retornado", "encerrado"] as const;

type Scope = { ok: true; schoolId: string | null } | { ok: false; status: number; error: string };

async function resolveScope(actor: Actor, requestedSchoolId?: string): Promise<Scope> {
  const level = canonicalRole(actor.role);
  if (level === "school_manager" || (actor.schoolId && (level === "ppi" || level === "teacher"))) {
    // Diretor (e perfis da escola liberados pelo Admin Master): sempre a própria escola, ignorando qualquer filtro enviado.
    if (!actor.schoolId) return { ok: false, status: 403, error: "Seu perfil não está vinculado a uma escola" };
    return { ok: true, schoolId: actor.schoolId };
  }
  if (!requestedSchoolId) return { ok: true, schoolId: null };
  const [school] = await db
    .select({ id: schools.id })
    .from(schools)
    .where(and(eq(schools.id, requestedSchoolId), eq(schools.tenantId, actor.tenantId)))
    .limit(1);
  if (!school) return { ok: false, status: 404, error: "Escola não encontrada" };
  return { ok: true, schoolId: school.id };
}

function sumarioDe(payload: unknown) {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, any>;
  const s = (p.secao_sumario && typeof p.secao_sumario === "object" ? p.secao_sumario : {}) as Record<string, any>;
  return {
    grupo: typeof p.grupo === "string" ? p.grupo : null,
    dificuldadesPersistentes: Array.isArray(s.dificuldades_persistentes)
      ? s.dificuldades_persistentes.filter((x: unknown) => typeof x === "string")
      : [],
    conduta: s.conduta === "sim" || s.conduta === "nao" ? s.conduta : null,
    qual: typeof s.qual === "string" ? s.qual : "",
    tempo: typeof s.tempo === "string" ? s.tempo : "",
    resultado: typeof s.resultado === "string" ? s.resultado : "",
  };
}

export async function managementRoutes(app: FastifyInstance) {
  // Sumário do RE (somente avaliações já enviadas ao médico)
  app.get("/api/management/re-summaries", async (request, reply) => {
    const actor = await requireCapability(request, reply, "management.view");
    if (!actor) return;
    const scope = await resolveScope(actor, (request.query as { schoolId?: string }).schoolId);
    if (!scope.ok) return reply.status(scope.status).send({ error: scope.error });

    const conditions = [eq(reAssessments.tenantId, actor.tenantId), eq(reAssessments.status, "enviado"), eq(reAssessments.formCode, FOGAP_FORM_CODE)];
    if (scope.schoolId) conditions.push(eq(students.schoolId, scope.schoolId));

    const rows = await db
      .select({
        studentCode: students.studentCode,
        ageBracket: students.ageBracket,
        schoolId: schools.id,
        schoolName: schools.name,
        journeyState: cases.journeyState,
        submittedAt: reAssessments.submittedAt,
        payload: reAssessments.payload,
      })
      .from(reAssessments)
      .innerJoin(cases, eq(reAssessments.caseId, cases.id))
      .innerJoin(students, eq(cases.studentId, students.id))
      .innerJoin(schools, eq(students.schoolId, schools.id))
      .where(and(...conditions))
      .orderBy(desc(reAssessments.submittedAt))
      .limit(500);

    await db.insert(auditLogs).values({
      tenantId: actor.tenantId,
      actorId: actor.id,
      action: "management:re-summaries",
      entity: "re_assessment",
      metadata: { role: actor.role, count: rows.length, schoolScoped: Boolean(scope.schoolId) },
    });

    return {
      summaries: rows.map((r) => ({
        studentCode: r.studentCode,
        ageBracket: r.ageBracket,
        school: { id: r.schoolId, name: r.schoolName },
        submittedAt: r.submittedAt,
        stage: JOURNEY_LABELS[r.journeyState] ?? r.journeyState,
        ...sumarioDe(r.payload),
      })),
    };
  });

  // Lista final de alunos encaminhados ao núcleo assistencial
  app.get("/api/management/nucleo-referrals", async (request, reply) => {
    const actor = await requireCapability(request, reply, "management.view");
    if (!actor) return;
    const scope = await resolveScope(actor, (request.query as { schoolId?: string }).schoolId);
    if (!scope.ok) return reply.status(scope.status).send({ error: scope.error });

    const conditions = [eq(cases.tenantId, actor.tenantId), inArray(cases.journeyState, [...REFERRED_STATES])];
    if (scope.schoolId) conditions.push(eq(students.schoolId, scope.schoolId));

    const rows = await db
      .select({
        studentCode: students.studentCode,
        ageBracket: students.ageBracket,
        schoolId: schools.id,
        schoolName: schools.name,
        journeyState: cases.journeyState,
        updatedAt: cases.updatedAt,
      })
      .from(cases)
      .innerJoin(students, eq(cases.studentId, students.id))
      .innerJoin(schools, eq(students.schoolId, schools.id))
      .where(and(...conditions))
      .orderBy(desc(cases.updatedAt))
      .limit(1000);

    await db.insert(auditLogs).values({
      tenantId: actor.tenantId,
      actorId: actor.id,
      action: "management:nucleo-referrals",
      entity: "case",
      metadata: { role: actor.role, count: rows.length, schoolScoped: Boolean(scope.schoolId) },
    });

    return {
      referrals: rows.map((r) => ({
        studentCode: r.studentCode,
        ageBracket: r.ageBracket,
        school: { id: r.schoolId, name: r.schoolName },
        stage: JOURNEY_LABELS[r.journeyState] ?? r.journeyState,
        updatedAt: r.updatedAt,
      })),
    };
  });

  /**
   * Observabilidade do fluxo do RE. Só agregados: tempo ativo mediano por parte (A–I), tempo ganho contra o tempo de
   * referência em papel, uso do passo opcional G e andamento da triagem TEA. Células com menos de 5 casos ficam ocultas.
   */
  app.get("/api/management/re-observability", async (request, reply) => {
    const actor = await requireCapability(request, reply, "management.observability.view");
    if (!actor) return;
    const scope = await resolveScope(actor, (request.query as { schoolId?: string }).schoolId);
    if (!scope.ok) return reply.status(scope.status).send({ error: scope.error });

    const escolaTimings = scope.schoolId ? eq(reStepTimings.schoolId, scope.schoolId) : undefined;
    const timings = await db
      .select({ caseId: reStepTimings.caseId, step: reStepTimings.step, activeSeconds: reStepTimings.activeSeconds })
      .from(reStepTimings)
      .where(and(eq(reStepTimings.tenantId, actor.tenantId), escolaTimings));

    const baselinesRows = await db
      .select({ step: reTimeBaselines.step, baselineMinutes: reTimeBaselines.baselineMinutes, note: reTimeBaselines.note })
      .from(reTimeBaselines)
      .where(eq(reTimeBaselines.tenantId, actor.tenantId));
    const baselines: Record<string, number> = {};
    for (const b of baselinesRows) baselines[b.step] = b.baselineMinutes;

    const escolaUso = scope.schoolId ? eq(reOptionalStepUsage.schoolId, scope.schoolId) : undefined;
    const usos = await db
      .select({ caseId: reOptionalStepUsage.caseId, action: reOptionalStepUsage.action, createdAt: reOptionalStepUsage.createdAt })
      .from(reOptionalStepUsage)
      .where(and(eq(reOptionalStepUsage.tenantId, actor.tenantId), escolaUso));

    const escolaCaso = scope.schoolId ? eq(students.schoolId, scope.schoolId) : undefined;
    const [{ n: casosComJornada } = { n: 0 }] = await db
      .select({ n: sql<number>`count(distinct ${reAssessments.caseId})::int` })
      .from(reAssessments)
      .innerJoin(cases, eq(reAssessments.caseId, cases.id))
      .innerJoin(students, eq(cases.studentId, students.id))
      .where(and(eq(reAssessments.tenantId, actor.tenantId), eq(reAssessments.formCode, RE_JORNADA_FORM_CODE), escolaCaso));

    const [{ n: ataAguardando } = { n: 0 }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(reAssessments)
      .innerJoin(cases, eq(reAssessments.caseId, cases.id))
      .innerJoin(students, eq(cases.studentId, students.id))
      .where(
        and(
          eq(reAssessments.tenantId, actor.tenantId),
          eq(reAssessments.formCode, RE_JORNADA_FORM_CODE),
          sql`(${reAssessments.payload} ->> 'h_aguardando') = 'true'`,
          escolaCaso,
        ),
      );

    const tea = await db
      .select({
        caseId: teaScreenings.caseId,
        instrument: teaScreenings.instrument,
        status: teaScreenings.status,
        respondent: teaScreenings.respondent,
        createdAt: teaScreenings.createdAt,
        submittedAt: teaScreenings.submittedAt,
      })
      .from(teaScreenings)
      .innerJoin(cases, eq(teaScreenings.caseId, cases.id))
      .innerJoin(students, eq(cases.studentId, students.id))
      .where(and(eq(teaScreenings.tenantId, actor.tenantId), escolaCaso));

    await db.insert(auditLogs).values({
      tenantId: actor.tenantId,
      actorId: actor.id,
      action: "management:re-observability",
      entity: "case",
      metadata: { role: actor.role, schoolScoped: Boolean(scope.schoolId) },
    });

    return {
      generatedAt: new Date().toISOString(),
      smallCell: 5,
      passos: RE_PASSOS.map((p) => ({ id: p.id, letra: p.letra, titulo: p.tituloCurto })),
      tempo: resumirTempos(timings, baselines),
      baselines: baselinesRows,
      podeEditarBaselines: (await decideCapability(actor, "management.baselines.edit")).allowed,
      usoOpcional: resumirUsoOpcional(usos, casosComJornada),
      tea: resumirTea(tea, ataAguardando),
      notas: [
        "Tempo ativo = tempo com a página aberta e em uso; pausas longas não contam.",
        "Tempo ganho = tempo de referência no papel menos a mediana no sistema. Depende do tempo de referência que a gestão informar.",
        "A triagem TEA aparece só como andamento (iniciada, enviada, aguardando responsável). O sistema não mostra pontuação nem classifica.",
      ],
    };
  });

  const baselineBody = z
    .object({
      baselines: z
        .array(
          z.object({
            step: z.enum(["a", "b", "c", "d", "e", "f", "g", "h", "i"]),
            baselineMinutes: z.number().int().min(0).max(600),
            note: z.string().max(300).optional(),
          }),
        )
        .min(1)
        .max(9),
    })
    .strict();

  app.put("/api/management/re-time-baselines", async (request, reply) => {
    const actor = await requireCapability(request, reply, "management.baselines.edit");
    if (!actor) return;
    const body = baselineBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "Informe a parte (A–I) e os minutos (0 a 600)." });
    const agora = new Date();
    for (const b of body.data.baselines) {
      await db
        .insert(reTimeBaselines)
        .values({ tenantId: actor.tenantId, step: b.step, baselineMinutes: b.baselineMinutes, note: b.note ?? null, updatedBy: actor.id, updatedAt: agora })
        .onConflictDoUpdate({
          target: [reTimeBaselines.tenantId, reTimeBaselines.step],
          set: { baselineMinutes: b.baselineMinutes, note: b.note ?? null, updatedBy: actor.id, updatedAt: agora },
        });
    }
    await db.insert(auditLogs).values({
      tenantId: actor.tenantId,
      actorId: actor.id,
      action: "management:re-time-baselines",
      entity: "tenant",
      metadata: { role: actor.role, steps: body.data.baselines.map((b) => ({ step: b.step, minutes: b.baselineMinutes })) },
    });
    return { success: true };
  });
}
