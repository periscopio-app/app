import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray } from "drizzle-orm";
import { auditLogs, cases, reAssessments, schools, students } from "@periscopio/shared";
import { db } from "../db/client";
import { requireActor, type Actor } from "../security/actor";
import { MANAGEMENT_VIEW_ROLES } from "../security/permissions";
import { JOURNEY_LABELS } from "../services/bi-semantic.service";

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
  if (actor.role === "school_manager") {
    // Diretor: sempre a própria escola, ignorando qualquer filtro enviado.
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
    const actor = await requireActor(request, reply, MANAGEMENT_VIEW_ROLES);
    if (!actor) return;
    const scope = await resolveScope(actor, (request.query as { schoolId?: string }).schoolId);
    if (!scope.ok) return reply.status(scope.status).send({ error: scope.error });

    const conditions = [eq(reAssessments.tenantId, actor.tenantId), eq(reAssessments.status, "enviado")];
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
    const actor = await requireActor(request, reply, MANAGEMENT_VIEW_ROLES);
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
}
