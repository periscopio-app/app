import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { auditLogs, biQuestions, caseSummaries, cases, populationAggregates, schools, students } from "@periscopio/shared";
import { requireActor, type Actor } from "../security/actor";
import { canAccessSchool } from "../security/tenancy";
import {
  AGE_BRACKETS,
  DIMENSIONS,
  GLOSSARY,
  JOURNEY_LABELS,
  JOURNEY_STATES,
  METRICS,
  SPECIALTIES,
  checkPlan,
  planSchema,
  runPlan,
  scrubQuestion,
  type Fact,
  type MetricId,
  type QueryPlan,
  type QueryResult,
} from "../services/bi-semantic.service";
import { SERVICES, parseCapacity, type AggregatePayload } from "../services/population-planning.service";
import { norm } from "./population.routes";

const READ_ROLES = ["admin_platform", "municipal_manager", "school_manager", "ppi", "board", "researcher", "md1"] as const;
const APPROVER_ROLES = ["admin_platform", "municipal_manager", "board"] as const;

const ym = (d: Date) => d.toISOString().slice(0, 7);
const round1 = (n: number) => Math.round(n * 10) / 10;

// Limite simples por usuário para o assistente (evita custo e abuso). Em memória: reinicia com o processo.
const askLog = new Map<string, number[]>();
function allowAsk(userId: string, max = 30, windowMs = 3_600_000) {
  const now = Date.now();
  const list = (askLog.get(userId) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) return false;
  list.push(now);
  askLog.set(userId, list);
  return true;
}

function tenantOf(actor: Actor, query: Record<string, string | undefined>) {
  return actor.role === "admin_platform" && query.tenantId ? query.tenantId : actor.tenantId;
}

interface SchoolRow {
  id: string;
  name: string;
  externalCode: string | null;
  tenantId: string;
}

async function visibleSchools(actor: Actor, tenantId: string): Promise<SchoolRow[]> {
  const all = await db
    .select({ id: schools.id, name: schools.name, externalCode: schools.externalCode, tenantId: schools.tenantId })
    .from(schools)
    .where(eq(schools.tenantId, tenantId));
  return all.filter((s) => canAccessSchool(actor, s.tenantId, s.id));
}

/** Monta fatos sem identificador de pessoa para a métrica pedida, já limitados ao escopo do usuário. */
export async function loadFacts(
  actor: Actor,
  tenantId: string,
  metric: MetricId,
  capacity: ReturnType<typeof parseCapacity>,
): Promise<Fact[]> {
  const sch = await visibleSchools(actor, tenantId);
  const name = new Map(sch.map((s) => [s.id, s.name]));
  const wholeNetwork = actor.role === "admin_platform" || !actor.schoolId;

  if (metric === "students") {
    const rows = await db
      .select({ schoolId: students.schoolId, ageBracket: students.ageBracket, createdAt: students.createdAt })
      .from(students)
      .where(eq(students.tenantId, tenantId));
    return rows
      .filter((r) => name.has(r.schoolId))
      .map((r) => ({
        schoolId: r.schoolId,
        dims: { school: name.get(r.schoolId)!, age_bracket: r.ageBracket ?? "Sem informação", month: ym(r.createdAt) },
        value: 1,
      }));
  }

  if (metric === "cases" || metric === "case_cycle_days") {
    const rows = await db
      .select({
        schoolId: students.schoolId,
        ageBracket: students.ageBracket,
        journeyState: cases.journeyState,
        createdAt: cases.createdAt,
        updatedAt: cases.updatedAt,
      })
      .from(cases)
      .innerJoin(students, eq(cases.studentId, students.id))
      .where(eq(cases.tenantId, tenantId));
    const mine = rows.filter((r) => name.has(r.schoolId));
    if (metric === "cases") {
      return mine.map((r) => ({
        schoolId: r.schoolId,
        dims: {
          school: name.get(r.schoolId)!,
          age_bracket: r.ageBracket ?? "Sem informação",
          journey_state: r.journeyState,
          month: ym(r.createdAt),
        },
        value: 1,
      }));
    }
    return mine
      .filter((r) => r.journeyState === "encerrado")
      .map((r) => ({
        schoolId: r.schoolId,
        dims: { school: name.get(r.schoolId)!, age_bracket: r.ageBracket ?? "Sem informação", month: ym(r.updatedAt) },
        value: Math.max(0, (r.updatedAt.getTime() - r.createdAt.getTime()) / 86_400_000),
      }));
  }

  if (metric === "delegations") {
    const rows = await db
      .select({
        schoolId: students.schoolId,
        specialty: caseSummaries.specialty,
        status: caseSummaries.status,
        createdAt: caseSummaries.createdAt,
      })
      .from(caseSummaries)
      .innerJoin(cases, eq(caseSummaries.caseId, cases.id))
      .innerJoin(students, eq(cases.studentId, students.id))
      .where(eq(caseSummaries.tenantId, tenantId));
    return rows
      .filter((r) => name.has(r.schoolId))
      .map((r) => ({
        schoolId: r.schoolId,
        dims: {
          school: name.get(r.schoolId)!,
          specialty: r.specialty,
          delegation_status: r.status,
          month: ym(r.createdAt),
        },
        value: 1,
      }));
  }

  // Base populacional (agregados). Nunca há linha de pessoa.
  const aggs = (await db.select().from(populationAggregates).where(eq(populationAggregates.tenantId, tenantId))).filter(
    (a) => a.schoolCode !== "TOTAL",
  );
  const link = (a: (typeof aggs)[number]) =>
    sch.find(
      (s) =>
        (s.externalCode && norm(s.externalCode) === norm(a.schoolCode)) ||
        norm(s.name) === norm(a.schoolLabel ?? "") ||
        norm(s.name) === norm(`escola ${a.schoolLabel ?? ""}`),
    );
  const facts: Fact[] = [];
  for (const a of aggs) {
    const s = link(a);
    if (!s && !wholeNetwork) continue; // dado ainda não vinculado só aparece para quem vê a rede inteira
    const schoolId = s?.id ?? null;
    const school = s?.name ?? `${a.schoolLabel ?? a.schoolCode} (escola ainda não cadastrada)`;
    const p = a.payload as AggregatePayload;
    if (metric === "population_total") facts.push({ schoolId, dims: { school }, value: p.total });
    if (metric === "population_by_age")
      for (const [k, v] of Object.entries(p.ageBands ?? {})) facts.push({ schoolId, dims: { school, age_band: k }, value: v });
    if (metric === "population_by_complaint")
      for (const [k, v] of Object.entries(p.complaints ?? {})) facts.push({ schoolId, dims: { school, complaint: k }, value: v });
    if (metric === "population_by_service")
      for (const k of SERVICES) facts.push({ schoolId, dims: { school, service: k }, value: p.services?.[k] ?? null });
    if (metric === "professionals_needed")
      for (const k of SERVICES) {
        const d = p.services?.[k];
        facts.push({ schoolId, dims: { school, service: k }, value: d == null ? null : round1(d / capacity[k]) });
      }
  }
  return facts;
}

async function execute(actor: Actor, tenantId: string, plan: QueryPlan): Promise<QueryResult> {
  const p = { ...plan, filters: { ...plan.filters } };
  // Quem está preso a uma escola nunca consulta outra, mesmo que o plano peça.
  if (actor.role !== "admin_platform" && actor.schoolId) p.filters.schoolId = actor.schoolId;
  else if (p.filters.schoolId) {
    const ok = (await visibleSchools(actor, tenantId)).some((s) => s.id === p.filters.schoolId);
    if (!ok) throw Object.assign(new Error("Escola fora do seu escopo"), { statusCode: 403 });
  }
  const facts = await loadFacts(actor, tenantId, p.metric, parseCapacity(p.capacity));
  return runPlan(facts, p);
}

export function summarize(r: QueryResult): string {
  if (r.rows.length === 0) return "Não há dados para esse recorte.";
  const visible = r.rows.filter((x) => x.value != null);
  const parts: string[] = [];
  const fmt = (v: number) => `${String(v).replace(".", ",")} ${r.unit}`;
  const label = (x: (typeof r.rows)[number]) => Object.values(x.dims).join(" / ") || r.label;
  if (r.groupBy.length === 0) {
    const row = r.rows[0];
    return row.suppressed ? `${r.label}: menos de 5 casos (valor ocultado).` : `${r.label}: ${fmt(row.value!)}.`;
  }
  if (r.total != null) parts.push(`Total de ${fmt(r.total)} em ${r.rows.length} grupo(s).`);
  if (visible.length > 0 && !r.groupBy.includes("month")) {
    const top = visible[0];
    parts.push(`Maior valor: ${label(top)} (${fmt(top.value!)}).`);
  }
  if (r.groupBy.includes("month") && visible.length >= 2) {
    const a = visible[0].value!;
    const b = visible[visible.length - 1].value!;
    parts.push(`De ${visible[0].dims.month} a ${visible[visible.length - 1].dims.month}: ${fmt(a)} → ${fmt(b)}.`);
  }
  if (r.suppressedCount > 0) parts.push(`${r.suppressedCount} grupo(s) ocultado(s) por terem menos de 5 casos.`);
  return parts.join(" ");
}

interface RagReply {
  plan: unknown;
  confidence?: number;
  explanation?: string;
  source?: "example" | "llm" | "rules";
  clarification?: string | null;
}

async function callRag(body: unknown): Promise<RagReply | null> {
  const base = process.env.BI_RAG_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/plan`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-service-token": process.env.BI_RAG_TOKEN ?? "" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000), // serviço gratuito pode estar "dormindo"
    });
    if (!res.ok) return null;
    return (await res.json()) as RagReply;
  } catch {
    return null;
  }
}

export async function biRoutes(app: FastifyInstance) {
  // ── Catálogo: o que dá para perguntar ────────────────────────────────────
  app.get("/api/bi/catalog", async (request, reply) => {
    const actor = await requireActor(request, reply, READ_ROLES);
    if (!actor) return;
    const tenantId = tenantOf(actor, request.query as Record<string, string | undefined>);
    const sch = await visibleSchools(actor, tenantId);
    return {
      metrics: METRICS.map(({ id, label, description, unit, additive, dims, filters }) => ({ id, label, description, unit, additive, dims, filters })),
      dimensions: DIMENSIONS,
      schools: sch.map((s) => ({ id: s.id, name: s.name })),
      ageBrackets: AGE_BRACKETS,
      journeyStates: JOURNEY_STATES.map((id) => ({ id, label: JOURNEY_LABELS[id] })),
      specialties: SPECIALTIES,
      services: SERVICES,
      glossary: GLOSSARY,
      assistantEnabled: !!process.env.BI_RAG_URL,
      canApprove: (APPROVER_ROLES as readonly string[]).includes(actor.role),
      privacy:
        "Alunos aparecem só como contagem. Grupos com menos de 5 casos são ocultados. O assistente nunca vê nome, código ou data de nascimento.",
    };
  });

  // ── Consulta estruturada (usada pelos filtros da tela) ───────────────────
  app.post("/api/bi/query", async (request, reply) => {
    const actor = await requireActor(request, reply, READ_ROLES);
    if (!actor) return;
    const parsed = z.object({ plan: planSchema }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Consulta inválida", issues: parsed.error.issues.slice(0, 3) });
    const bad = checkPlan(parsed.data.plan);
    if (bad) return reply.status(400).send({ error: bad });
    const tenantId = tenantOf(actor, request.query as Record<string, string | undefined>);
    try {
      const result = await execute(actor, tenantId, parsed.data.plan);
      await db.insert(auditLogs).values({
        tenantId, actorId: actor.id, action: "bi:query", entity: "bi",
        metadata: { metric: parsed.data.plan.metric, groupBy: parsed.data.plan.groupBy, via: "builder" },
      });
      return { plan: parsed.data.plan, result, summary: summarize(result) };
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode ?? 500;
      return reply.status(code).send({ error: code === 403 ? "Escola fora do seu escopo" : "Falha ao consultar" });
    }
  });

  // ── Painel inicial ───────────────────────────────────────────────────────
  app.get("/api/bi/overview", async (request, reply) => {
    const actor = await requireActor(request, reply, READ_ROLES);
    if (!actor) return;
    const tenantId = tenantOf(actor, request.query as Record<string, string | undefined>);
    const presets: Record<string, QueryPlan> = {
      students: planSchema.parse({ metric: "students" }),
      cases: planSchema.parse({ metric: "cases" }),
      casesByState: planSchema.parse({ metric: "cases", groupBy: ["journey_state"] }),
      casesByMonth: planSchema.parse({ metric: "cases", groupBy: ["month"] }),
      casesBySchool: planSchema.parse({ metric: "cases", groupBy: ["school"] }),
      cycle: planSchema.parse({ metric: "case_cycle_days" }),
      delegations: planSchema.parse({ metric: "delegations", groupBy: ["specialty"] }),
      populationBySchool: planSchema.parse({ metric: "population_total", groupBy: ["school"] }),
      populationByService: planSchema.parse({ metric: "population_by_service", groupBy: ["service"] }),
      professionals: planSchema.parse({ metric: "professionals_needed", groupBy: ["service"] }),
    };
    const out: Record<string, QueryResult & { summary: string }> = {};
    for (const [k, plan] of Object.entries(presets)) {
      const r = await execute(actor, tenantId, plan);
      out[k] = { ...r, summary: summarize(r) };
    }
    await db.insert(auditLogs).values({ tenantId, actorId: actor.id, action: "bi:overview", entity: "bi" });
    return out;
  });

  // ── Pergunta em linguagem natural (assistente RAG em Python) ─────────────
  app.post("/api/bi/ask", async (request, reply) => {
    const actor = await requireActor(request, reply, READ_ROLES);
    if (!actor) return;
    const parsed = z.object({ question: z.string().min(3).max(500) }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Escreva uma pergunta de 3 a 500 caracteres" });
    if (!allowAsk(actor.id)) return reply.status(429).send({ error: "Muitas perguntas seguidas. Tente de novo em alguns minutos." });

    const tenantId = tenantOf(actor, request.query as Record<string, string | undefined>);
    const { text: question, scrubbed } = scrubQuestion(parsed.data.question);
    const sch = await visibleSchools(actor, tenantId);
    const examples = await db
      .select({ question: biQuestions.question, plan: biQuestions.plan, corrected: biQuestions.correctedPlan })
      .from(biQuestions)
      .where(and(eq(biQuestions.tenantId, tenantId), eq(biQuestions.approved, true)))
      .orderBy(desc(biQuestions.createdAt))
      .limit(200);

    const rag = await callRag({
      question,
      role: actor.role,
      catalog: {
        metrics: METRICS.map(({ id, label, description, dims, filters, synonyms }) => ({ id, label, description, dims, filters, synonyms })),
        dimensions: DIMENSIONS,
        schools: sch.map((s) => ({ id: s.id, name: s.name })),
        ageBrackets: AGE_BRACKETS,
        journeyStates: JOURNEY_STATES,
        specialties: SPECIALTIES,
      },
      examples: examples.map((e) => ({ question: e.question, plan: e.corrected ?? e.plan })),
    });
    if (!rag) {
      return reply.status(503).send({
        error: "O assistente está indisponível agora. Use os filtros abaixo para montar a consulta.",
        fallback: true,
      });
    }

    const planParse = planSchema.safeParse(rag.plan);
    const bad = planParse.success ? checkPlan(planParse.data) : "plano inválido";
    const [saved] = await db
      .insert(biQuestions)
      .values({
        tenantId, userId: actor.id, role: actor.role, question,
        plan: planParse.success && !bad ? planParse.data : null,
        source: rag.source ?? "rules", confidence: rag.confidence ?? null,
      })
      .returning({ id: biQuestions.id });

    if (!planParse.success || bad) {
      return {
        questionId: saved.id, scrubbed, understood: false,
        message: rag.clarification ?? "Não consegui transformar isso em uma consulta. Tente citar o que medir (alunos, casos, tempo médio, profissionais) e como agrupar (por escola, mês, etapa).",
      };
    }
    try {
      const result = await execute(actor, tenantId, planParse.data);
      await db.insert(auditLogs).values({
        tenantId, actorId: actor.id, action: "bi:query", entity: "bi", entityId: saved.id,
        metadata: { metric: planParse.data.metric, groupBy: planParse.data.groupBy, via: "assistant", source: rag.source },
      });
      return {
        questionId: saved.id, scrubbed, understood: true, plan: planParse.data, result,
        summary: summarize(result), explanation: rag.explanation ?? null,
        confidence: rag.confidence ?? null, source: rag.source ?? "rules", clarification: rag.clarification ?? null,
      };
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode ?? 500;
      return reply.status(code).send({ error: code === 403 ? "Essa consulta pede uma escola fora do seu escopo" : "Falha ao consultar" });
    }
  });

  // ── Feedback: é assim que o assistente melhora ───────────────────────────
  app.post("/api/bi/feedback", async (request, reply) => {
    const actor = await requireActor(request, reply, READ_ROLES);
    if (!actor) return;
    const parsed = z
      .object({ questionId: z.string().uuid(), rating: z.union([z.literal(1), z.literal(-1)]), correctedPlan: planSchema.optional() })
      .safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Feedback inválido" });
    const { questionId, rating, correctedPlan } = parsed.data;
    if (correctedPlan) {
      const bad = checkPlan(correctedPlan);
      if (bad) return reply.status(400).send({ error: bad });
    }
    const [q] = await db.select().from(biQuestions).where(eq(biQuestions.id, questionId)).limit(1);
    if (!q || q.tenantId !== actor.tenantId || (q.userId !== actor.id && actor.role !== "admin_platform")) {
      return reply.status(404).send({ error: "Pergunta não encontrada" });
    }
    const approver = (APPROVER_ROLES as readonly string[]).includes(actor.role);
    // Só gestão aprova direto; os demais viram candidatos para revisão (evita contaminar o aprendizado).
    const approved = approver && rating === 1 && !!(q.plan || correctedPlan);
    await db
      .update(biQuestions)
      .set({ rating, correctedPlan: correctedPlan ?? q.correctedPlan, approved, approvedBy: approved ? actor.id : null })
      .where(eq(biQuestions.id, q.id));
    return { success: true, approved, pendingReview: !approved && (rating === 1 || !!correctedPlan) };
  });

  // ── Fila de revisão (gestão) ─────────────────────────────────────────────
  app.get("/api/bi/questions", async (request, reply) => {
    const actor = await requireActor(request, reply, APPROVER_ROLES);
    if (!actor) return;
    const tenantId = tenantOf(actor, request.query as Record<string, string | undefined>);
    const rows = await db
      .select({
        id: biQuestions.id, question: biQuestions.question, plan: biQuestions.plan, correctedPlan: biQuestions.correctedPlan,
        rating: biQuestions.rating, approved: biQuestions.approved, source: biQuestions.source, createdAt: biQuestions.createdAt,
      })
      .from(biQuestions)
      .where(eq(biQuestions.tenantId, tenantId))
      .orderBy(desc(biQuestions.createdAt))
      .limit(100);
    const pending = rows.filter((r) => !r.approved && (r.rating === 1 || r.correctedPlan));
    return { approved: rows.filter((r) => r.approved), pending, recent: rows.slice(0, 30) };
  });

  app.post("/api/bi/questions/:id/approve", async (request, reply) => {
    const actor = await requireActor(request, reply, APPROVER_ROLES);
    if (!actor) return;
    const { id } = request.params as { id: string };
    const approve = (request.body as { approve?: boolean } | null)?.approve !== false;
    const [q] = await db.select().from(biQuestions).where(eq(biQuestions.id, id)).limit(1);
    if (!q || q.tenantId !== actor.tenantId) return reply.status(404).send({ error: "Pergunta não encontrada" });
    if (approve && !(q.correctedPlan ?? q.plan)) return reply.status(400).send({ error: "Pergunta sem plano para aprovar" });
    await db.update(biQuestions).set({ approved: approve, approvedBy: approve ? actor.id : null }).where(eq(biQuestions.id, id));
    return { success: true, approved: approve };
  });
}
