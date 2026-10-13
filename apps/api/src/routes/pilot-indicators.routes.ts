import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { caseSummaries, cases, schools, students, symptomMeasurements } from "@periscopio/shared";
import { SNAP4_ITENS, SNAP4_VERSION, type OpcaoSnap4 } from "@periscopio/shared";
import { db } from "../db/client";
import { requireCapability, type Actor } from "../security/actor";
import { canAccessSchool } from "../security/tenancy";
import { hasRole } from "../security/roles";
import { recordAudit } from "../services/audit.service";
import { loadPilotData } from "../services/pilot-indicators.data";
import {
  HISTORICAL_REFERENCE,
  INDICATOR_DEFS,
  SMALL_CELL,
  computeGroup,
  computeRastreio,
  studentCaseView,
  type SchoolFact,
} from "../services/pilot-indicators.service";

const RE_ROLES = ["ppi", "re", "responsavel_escolar"] as const;
const MD_ROLES = ["md1", "medico", "md"] as const;
const NETWORK_ROLES = ["admin_platform", "adm_master"] as const;

/** Medida do indicador 5: itens 1 a 9 do SNAP-IV, a única contagem que a fonte permite calcular. */
const MEASURE_ITEMS = SNAP4_ITENS.filter((i) => i.bloco === "itens_1_a_9").map((i) => i.id);
const MEASURE_ID = "snap4_itens_1a9";
const MARKED: ReadonlySet<OpcaoSnap4> = new Set(["bastante", "demais"]);
const OPTIONS = ["nem_um_pouco", "so_um_pouco", "bastante", "demais"] as const;

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD");

const measurementSchema = z
  .object({
    phase: z.enum(["inicial", "reavaliacao"]),
    source: z.enum(["escola", "nucleo"]),
    appliedOn: dateOnly,
    answers: z.record(z.string(), z.enum(OPTIONS)),
  })
  .strict();

const querySchema = z.object({
  schoolId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  group: z.enum(["pilot", "control", "all"]).default("pilot"),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

async function visibleSchools(actor: Actor, tenantId: string, group: "pilot" | "control" | "all", only?: string) {
  const rows = await db
    .select({ id: schools.id, name: schools.name, enrollment: schools.enrollment, isControlGroup: schools.isControlGroup })
    .from(schools)
    .where(eq(schools.tenantId, tenantId));
  return rows
    .filter((s) => canAccessSchool(actor, tenantId, s.id))
    .filter((s) => (group === "all" ? true : group === "control" ? s.isControlGroup : !s.isControlGroup))
    .filter((s) => (only ? s.id === only : true));
}

function resolveTenant(actor: Actor, requested?: string): string {
  if (requested && requested !== actor.tenantId && hasRole(actor.role, NETWORK_ROLES)) return requested;
  return actor.tenantId;
}

async function visibleCase(actor: Actor, caseId: string) {
  const [row] = await db
    .select({
      id: cases.id,
      tenantId: cases.tenantId,
      journeyState: cases.journeyState,
      studentId: cases.studentId,
      schoolId: students.schoolId,
    })
    .from(cases)
    .innerJoin(students, eq(cases.studentId, students.id))
    .where(eq(cases.id, caseId))
    .limit(1);
  if (!row || !canAccessSchool(actor, row.tenantId, row.schoolId)) return null;
  return row;
}

export async function pilotIndicatorsRoutes(app: FastifyInstance) {
  // ── Grupo: escola e rede ────────────────────────────────────────────────────
  app.get("/api/pilot/indicators", async (request, reply) => {
    const actor = await requireCapability(request, reply, "pilot.indicators.view");
    if (!actor) return;

    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: "Filtro inválido", issues: parsed.error.issues });
    const q = parsed.data;

    const tenantId = resolveTenant(actor, q.tenantId);
    const visible = await visibleSchools(actor, tenantId, q.group, q.schoolId);
    if (q.schoolId && visible.length === 0) return reply.status(404).send({ error: "Escola não encontrada" });

    const data = await loadPilotData({
      tenantId,
      schoolIds: visible.map((s) => s.id),
      from: q.from ? new Date(`${q.from}T00:00:00.000Z`) : undefined,
      to: q.to ? new Date(`${q.to}T23:59:59.999Z`) : undefined,
    });

    const bySchool = visible
      .map((s: SchoolFact) => ({
        schoolId: s.id,
        schoolName: s.name,
        isControlGroup: s.isControlGroup,
        ...computeGroup({
          cases: data.cases.filter((c) => c.schoolId === s.id),
          educators: data.educators.filter((e) => e.schoolId === s.id),
          enrollments: data.enrollments,
          requiredCourseIds: data.requiredCourseIds,
          matricula: s.enrollment,
        }),
      }))
      .sort((a, b) => a.schoolName.localeCompare(b.schoolName, "pt-BR"));

    // Rede: o denominador do rastreio só soma escolas com matrícula informada, e o numerador acompanha.
    const withEnrollment = new Set(visible.filter((s) => s.enrollment != null && s.enrollment > 0).map((s) => s.id));
    const totalMatricula = visible.reduce((sum, s) => sum + (s.enrollment ?? 0), 0);
    const overall = computeGroup({
      cases: data.cases,
      educators: data.educators,
      enrollments: data.enrollments,
      requiredCourseIds: data.requiredCourseIds,
      matricula: withEnrollment.size > 0 ? totalMatricula : null,
    });
    overall.rastreio = computeRastreio(
      data.cases.filter((c) => withEnrollment.has(c.schoolId)),
      withEnrollment.size > 0 ? totalMatricula : null,
    );

    const notes: string[] = [
      `Grupos com 1 a ${SMALL_CELL - 1} alunos aparecem como "<5" e o valor complementar também é ocultado, para não identificar crianças.`,
      "Definições em proposta: o texto institucional pede que os critérios de cálculo sejam fechados no planejamento da implantação. As pendências estão em cada indicador.",
      "Nenhum indicador classifica aluno nem sugere diagnóstico, melhora ou alta. A decisão clínica é do médico responsável.",
    ];
    const semMatricula = visible.length - withEnrollment.size;
    if (semMatricula > 0) {
      notes.push(`${semMatricula} escola(s) sem matrícula informada ficaram fora do percentual de rastreio da rede.`);
    }
    if (data.requiredCourseIds.length === 0) {
      notes.push("Nenhum curso cadastrado no LMS: a capacitação aparece como 0% até haver cursos obrigatórios.");
    }

    return {
      generatedAt: new Date().toISOString(),
      scope: { tenantId, schoolId: q.schoolId ?? null, group: q.group, from: q.from ?? null, to: q.to ?? null, schools: visible.length },
      definitions: INDICATOR_DEFS,
      historicalReference: HISTORICAL_REFERENCE,
      overall,
      bySchool,
      notes,
    };
  });

  // ── Individual: um aluno, pelo código ───────────────────────────────────────
  app.get<{ Params: { studentCode: string } }>("/api/pilot/students/:studentCode/indicators", async (request, reply) => {
    const actor = await requireCapability(request, reply, "pilot.indicators.case.view");
    if (!actor) return;

    const [student] = await db
      .select({ id: students.id, studentCode: students.studentCode, tenantId: students.tenantId, schoolId: students.schoolId, ageBracket: students.ageBracket })
      .from(students)
      .where(eq(students.studentCode, request.params.studentCode))
      .limit(1);
    if (!student || !canAccessSchool(actor, student.tenantId, student.schoolId)) {
      return reply.status(404).send({ error: "Aluno não encontrado" });
    }

    const data = await loadPilotData({ tenantId: student.tenantId, schoolIds: [student.schoolId] });
    const mine = data.cases.filter((c) => c.studentId === student.id);
    const school = data.schools.find((s) => s.id === student.schoolId);

    await recordAudit(
      {
        tenantId: actor.tenantId,
        userId: actor.id,
        userEmail: actor.email,
        action: "pilot.student_indicators.view",
        entityType: "student",
        entityId: student.id,
        payload: { cases: mine.length },
      },
      request,
    );

    return {
      student: { studentCode: student.studentCode, ageBracket: student.ageBracket, schoolName: school?.name ?? null },
      cases: mine.map(studentCaseView),
      definitions: INDICATOR_DEFS.filter((d) => d.id !== "capacitacao"),
      note: "A capacitação é um indicador de educadores; está no painel de grupo. Nenhum valor aqui é diagnóstico ou classificação.",
    };
  });

  // ── Medidas de sintomas (indicador 5) ───────────────────────────────────────
  app.get("/api/pilot/measure-items", async (request, reply) => {
    const actor = await requireCapability(request, reply, "pilot.symptoms.record");
    if (!actor) return;
    return {
      measure: MEASURE_ID,
      version: SNAP4_VERSION,
      aviso: "Contagem de itens marcados Bastante ou Demais (itens 1 a 9). Não é diagnóstico nem classificação.",
      options: OPTIONS,
      items: SNAP4_ITENS.filter((i) => i.bloco === "itens_1_a_9").map((i) => ({ id: i.id, n: i.n, texto: i.texto })),
    };
  });

  app.get<{ Params: { caseId: string } }>("/api/cases/:caseId/symptom-measurements", async (request, reply) => {
    const actor = await requireCapability(request, reply, "pilot.indicators.case.view");
    if (!actor) return;
    const visible = await visibleCase(actor, request.params.caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });

    const rows = await db
      .select({
        id: symptomMeasurements.id,
        phase: symptomMeasurements.phase,
        source: symptomMeasurements.source,
        appliedOn: symptomMeasurements.appliedOn,
        markedCount: symptomMeasurements.markedCount,
        itemsTotal: symptomMeasurements.itemsTotal,
        recordedRole: symptomMeasurements.recordedRole,
        createdAt: symptomMeasurements.createdAt,
      })
      .from(symptomMeasurements)
      .where(eq(symptomMeasurements.caseId, visible.id))
      .orderBy(desc(symptomMeasurements.createdAt));
    return { measurements: rows, measure: MEASURE_ID };
  });

  app.post<{ Params: { caseId: string } }>("/api/cases/:caseId/symptom-measurements", async (request, reply) => {
    const actor = await requireCapability(request, reply, "pilot.symptoms.record");
    if (!actor) return;

    const visible = await visibleCase(actor, request.params.caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });

    const parsed = measurementSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Dados inválidos", issues: parsed.error.issues });
    const body = parsed.data;

    // Cada origem registra a sua: a escola (RE) a da escola; o núcleo (médico ou especialista designado) a do núcleo.
    const isRe = hasRole(actor.role, RE_ROLES);
    const isMd = hasRole(actor.role, MD_ROLES);
    if (body.source === "escola" && !isRe && !hasRole(actor.role, NETWORK_ROLES)) {
      return reply.status(403).send({ error: "A medida da escola é registrada pelo RE da escola." });
    }
    if (body.source === "nucleo") {
      if (isRe) return reply.status(403).send({ error: "A medida do núcleo é registrada pelo médico ou pelo especialista designado." });
      if (!isMd && !hasRole(actor.role, NETWORK_ROLES)) {
        const [assigned] = await db
          .select({ id: caseSummaries.id })
          .from(caseSummaries)
          .where(and(eq(caseSummaries.caseId, visible.id), eq(caseSummaries.assignedProfessionalId, actor.id)))
          .limit(1);
        if (!assigned) return reply.status(403).send({ error: "Você não está designado(a) para este caso." });
      }
      if (visible.journeyState === "rascunho" || visible.journeyState === "enviado_re") {
        return reply.status(409).send({ error: "O caso ainda não chegou ao núcleo; a medida do núcleo só pode ser registrada depois." });
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    if (body.appliedOn > today) return reply.status(400).send({ error: "A data de aplicação não pode ser futura." });

    const unknown = Object.keys(body.answers).filter((k) => !MEASURE_ITEMS.includes(k));
    if (unknown.length > 0) return reply.status(400).send({ error: `Item fora da medida: ${unknown.join(", ")}` });
    const missing = MEASURE_ITEMS.filter((id) => !(id in body.answers));
    if (missing.length > 0) return reply.status(400).send({ error: `Responda todos os ${MEASURE_ITEMS.length} itens (faltam: ${missing.join(", ")}).` });

    if (body.phase === "reavaliacao") {
      const [initial] = await db
        .select({ appliedOn: symptomMeasurements.appliedOn })
        .from(symptomMeasurements)
        .where(and(eq(symptomMeasurements.caseId, visible.id), eq(symptomMeasurements.source, body.source), eq(symptomMeasurements.phase, "inicial")))
        .orderBy(desc(symptomMeasurements.createdAt))
        .limit(1);
      if (!initial) return reply.status(409).send({ error: "Registre primeiro a medida inicial desta origem." });
      if (body.appliedOn < initial.appliedOn) return reply.status(400).send({ error: "A reavaliação não pode ser anterior à medida inicial." });
    }

    const markedCount = MEASURE_ITEMS.filter((id) => MARKED.has(body.answers[id] as OpcaoSnap4)).length;

    const [row] = await db
      .insert(symptomMeasurements)
      .values({
        tenantId: visible.tenantId,
        schoolId: visible.schoolId,
        caseId: visible.id,
        phase: body.phase,
        source: body.source,
        measure: MEASURE_ID,
        measureVersion: SNAP4_VERSION,
        appliedOn: body.appliedOn,
        answers: body.answers,
        markedCount,
        itemsTotal: MEASURE_ITEMS.length,
        recordedBy: actor.id,
        recordedRole: actor.role,
      })
      .returning({ id: symptomMeasurements.id });

    await recordAudit(
      {
        tenantId: actor.tenantId,
        userId: actor.id,
        userEmail: actor.email,
        action: "pilot.symptom_measure.recorded",
        entityType: "symptom_measurement",
        entityId: row.id,
        payload: { caseId: visible.id, phase: body.phase, source: body.source },
      },
      request,
    );

    return reply.status(201).send({ id: row.id, phase: body.phase, source: body.source, markedCount, itemsTotal: MEASURE_ITEMS.length });
  });
}
