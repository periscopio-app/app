/**
 * Leitura dos fatos que alimentam os indicadores do piloto. Só lê; o cálculo está em pilot-indicators.service.ts.
 * Todas as consultas já nascem limitadas ao tenant e às escolas que o usuário pode ver.
 */
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import {
  caseTimeline,
  caseTransitions,
  cases,
  courses,
  enrollments,
  schools,
  students,
  symptomMeasurements,
  users,
} from "@periscopio/shared";
import { db } from "../db/client";
import type {
  CaseFact,
  ClosingDecision,
  EducatorFact,
  EnrollmentFact,
  MeasureFact,
  SchoolFact,
} from "./pilot-indicators.service";

/** Quem conta como educador no indicador 1 (proposta: professores e RE). */
export const EDUCATOR_ROLES = ["teacher", "ppi", "re", "responsavel_escolar"] as const;

const DECISIONS = new Set<string>(["encaminhamento", "acompanhamento", "alta", "abandono", "interrupcao_justificada"]);

export interface PilotScope {
  tenantId: string;
  schoolIds: string[];
  from?: Date;
  to?: Date;
}

export interface PilotData {
  schools: SchoolFact[];
  cases: CaseFact[];
  educators: EducatorFact[];
  enrollments: EnrollmentFact[];
  requiredCourseIds: string[];
}

export function requiredCourseIdsFromEnv(allCourseIds: string[]): string[] {
  const raw = process.env.PILOT_REQUIRED_COURSE_IDS?.trim();
  if (!raw) return allCourseIds;
  const wanted = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
  return allCourseIds.filter((id) => wanted.has(id));
}

/** Reduz as medidas de um caso à mais recente por (fase, origem). */
export function latestMeasures(rows: { phase: string; source: string; markedCount: number; itemsTotal: number; appliedOn: string; createdAt: Date }[]): MeasureFact[] {
  const best = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const k = `${r.phase}|${r.source}`;
    const cur = best.get(k);
    if (!cur || r.createdAt.getTime() >= cur.createdAt.getTime()) best.set(k, r);
  }
  return [...best.values()].map((r) => ({
    phase: r.phase as MeasureFact["phase"],
    source: r.source as MeasureFact["source"],
    markedCount: r.markedCount,
    itemsTotal: r.itemsTotal,
    appliedOn: r.appliedOn,
  }));
}

export async function loadPilotData(scope: PilotScope): Promise<PilotData> {
  const { tenantId, schoolIds } = scope;
  if (schoolIds.length === 0) {
    return { schools: [], cases: [], educators: [], enrollments: [], requiredCourseIds: [] };
  }

  const schoolRows = await db
    .select({ id: schools.id, name: schools.name, enrollment: schools.enrollment, isControlGroup: schools.isControlGroup })
    .from(schools)
    .where(and(eq(schools.tenantId, tenantId), inArray(schools.id, schoolIds)));

  const caseFilters = [eq(cases.tenantId, tenantId), inArray(students.schoolId, schoolIds)];
  if (scope.from) caseFilters.push(gte(cases.createdAt, scope.from));
  if (scope.to) caseFilters.push(lte(cases.createdAt, scope.to));

  const caseRows = await db
    .select({
      caseId: cases.id,
      studentId: students.id,
      studentCode: students.studentCode,
      schoolId: students.schoolId,
      ageBracket: students.ageBracket,
      journeyState: cases.journeyState,
      createdAt: cases.createdAt,
    })
    .from(cases)
    .innerJoin(students, eq(cases.studentId, students.id))
    .where(and(...caseFilters));

  const caseIds = new Set(caseRows.map((c) => c.caseId));

  const transitionRows = await db
    .select({ caseId: caseTransitions.caseId, toState: caseTransitions.toState, createdAt: caseTransitions.createdAt })
    .from(caseTransitions)
    .innerJoin(cases, eq(caseTransitions.caseId, cases.id))
    .innerJoin(students, eq(cases.studentId, students.id))
    .where(and(eq(caseTransitions.tenantId, tenantId), inArray(students.schoolId, schoolIds)));

  const closedRows = await db
    .select({ caseId: caseTimeline.caseId, payload: caseTimeline.payload, createdAt: caseTimeline.createdAt })
    .from(caseTimeline)
    .innerJoin(cases, eq(caseTimeline.caseId, cases.id))
    .innerJoin(students, eq(cases.studentId, students.id))
    .where(and(eq(caseTimeline.tenantId, tenantId), eq(caseTimeline.event, "case:closed"), inArray(students.schoolId, schoolIds)));

  const measureRows = await db
    .select({
      caseId: symptomMeasurements.caseId,
      phase: symptomMeasurements.phase,
      source: symptomMeasurements.source,
      markedCount: symptomMeasurements.markedCount,
      itemsTotal: symptomMeasurements.itemsTotal,
      appliedOn: symptomMeasurements.appliedOn,
      createdAt: symptomMeasurements.createdAt,
    })
    .from(symptomMeasurements)
    .where(and(eq(symptomMeasurements.tenantId, tenantId), inArray(symptomMeasurements.schoolId, schoolIds)));

  const firstTransition = new Map<string, Date>();
  for (const t of transitionRows) {
    if (t.toState !== "enviado_re" && t.toState !== "delegado") continue;
    const key = `${t.caseId}|${t.toState}`;
    const cur = firstTransition.get(key);
    if (!cur || t.createdAt < cur) firstTransition.set(key, t.createdAt);
  }

  const closedByCase = new Map<string, { at: Date; decision: ClosingDecision | null; followUp: "semestral" | "anual" | null }>();
  for (const r of closedRows) {
    const p = (r.payload ?? {}) as { decision?: string; followUp?: string };
    const prev = closedByCase.get(r.caseId);
    if (prev && prev.at >= r.createdAt) continue;
    closedByCase.set(r.caseId, {
      at: r.createdAt,
      decision: p.decision && DECISIONS.has(p.decision) ? (p.decision as ClosingDecision) : null,
      followUp: p.followUp === "semestral" || p.followUp === "anual" ? p.followUp : null,
    });
  }

  const measuresByCase = new Map<string, typeof measureRows>();
  for (const m of measureRows) {
    if (!caseIds.has(m.caseId)) continue;
    const list = measuresByCase.get(m.caseId) ?? [];
    list.push(m);
    measuresByCase.set(m.caseId, list);
  }

  const caseFacts: CaseFact[] = caseRows.map((c) => {
    const closed = closedByCase.get(c.caseId);
    return {
      caseId: c.caseId,
      studentId: c.studentId,
      studentCode: c.studentCode,
      schoolId: c.schoolId,
      ageBracket: c.ageBracket,
      journeyState: c.journeyState,
      createdAt: c.createdAt,
      sentAt: firstTransition.get(`${c.caseId}|enviado_re`) ?? null,
      firstEvaluationAt: firstTransition.get(`${c.caseId}|delegado`) ?? null,
      closedAt: c.journeyState === "encerrado" ? (closed?.at ?? null) : null,
      decision: c.journeyState === "encerrado" ? (closed?.decision ?? null) : null,
      followUp: c.journeyState === "encerrado" ? (closed?.followUp ?? null) : null,
      measures: latestMeasures(measuresByCase.get(c.caseId) ?? []),
    };
  });

  const educatorRows = await db
    .select({ userId: users.id, schoolId: users.schoolId })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), inArray(users.schoolId, schoolIds), inArray(users.role, [...EDUCATOR_ROLES])));
  const educators: EducatorFact[] = educatorRows.filter((e) => e.schoolId).map((e) => ({ userId: e.userId, schoolId: e.schoolId! }));

  const allCourses = await db.select({ id: courses.id }).from(courses);
  const requiredCourseIds = requiredCourseIdsFromEnv(allCourses.map((c) => c.id));

  const enrollmentRows =
    educators.length > 0
      ? await db
          .select({ userId: enrollments.userId, courseId: enrollments.courseId, progress: enrollments.progress, completedAt: enrollments.completedAt })
          .from(enrollments)
          .where(and(eq(enrollments.tenantId, tenantId), inArray(enrollments.userId, educators.map((e) => e.userId))))
      : [];

  return {
    schools: schoolRows,
    cases: caseFacts,
    educators,
    enrollments: enrollmentRows,
    requiredCourseIds,
  };
}
