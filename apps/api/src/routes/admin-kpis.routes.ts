import type { FastifyInstance } from "fastify";
import { and, eq, gte, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { cases, justificationMetrics, reStepTimings } from "@periscopio/shared";
import { db } from "../db/client";
import { requireCapability } from "../security/actor";
import { resumirTempoFogap } from "../services/re-observability.service";

/**
 * KPIs internos do Administrador Master (mesma capacidade da aba Saúde): só agregados, nunca aluno, escola ou pessoa.
 */
export async function adminKpisRoutes(app: FastifyInstance) {
  const filtro = z.object({ tenantId: z.string().uuid().optional(), dias: z.coerce.number().int().min(1).max(365).default(90) });

  /** Tempo de preenchimento do FOGAP pelo RE: mediana (destaque), média e quartis por caso enviado. */
  app.get("/api/admin/kpis/fogap-fill-time", async (request, reply) => {
    const actor = await requireCapability(request, reply, "system.observability.view");
    if (!actor) return;
    const q = filtro.safeParse(request.query);
    if (!q.success) return reply.status(400).send({ error: "Filtro inválido." });
    const desde = new Date(Date.now() - q.data.dias * 86_400_000);

    // Só casos que já saíram do rascunho: o tempo de um caso ainda em preenchimento é parcial e distorceria a mediana.
    const rows = await db
      .select({ caseId: reStepTimings.caseId, step: reStepTimings.step, activeSeconds: reStepTimings.activeSeconds })
      .from(reStepTimings)
      .innerJoin(cases, eq(reStepTimings.caseId, cases.id))
      .where(
        and(
          ne(cases.journeyState, "rascunho"),
          gte(reStepTimings.lastAt, desde),
          q.data.tenantId ? eq(reStepTimings.tenantId, q.data.tenantId) : undefined
        )
      );
    reply.header("Cache-Control", "no-store");
    return { periodoDias: q.data.dias, tenantId: q.data.tenantId ?? null, ...resumirTempoFogap(rows) };
  });

  /** Volumetria das justificativas (caracteres, palavras e tokens estimados), por formulário. Sem texto. */
  app.get("/api/admin/kpis/justification-volume", async (request, reply) => {
    const actor = await requireCapability(request, reply, "system.observability.view");
    if (!actor) return;
    const q = filtro.safeParse(request.query);
    if (!q.success) return reply.status(400).send({ error: "Filtro inválido." });
    const desde = new Date(Date.now() - q.data.dias * 86_400_000).toISOString().slice(0, 10);

    const linhas = await db
      .select({
        form: justificationMetrics.form,
        kind: justificationMetrics.kind,
        n: sql<number>`sum(${justificationMetrics.n})::int`,
        chars: sql<number>`sum(${justificationMetrics.chars})::int`,
        words: sql<number>`sum(${justificationMetrics.words})::int`,
        estTokens: sql<number>`sum(${justificationMetrics.estTokens})::int`,
      })
      .from(justificationMetrics)
      .where(and(gte(justificationMetrics.day, desde), q.data.tenantId ? eq(justificationMetrics.tenantId, q.data.tenantId) : undefined))
      .groupBy(justificationMetrics.form, justificationMetrics.kind)
      .orderBy(justificationMetrics.form, justificationMetrics.kind);

    const total = linhas.reduce(
      (t, l) => ({ n: t.n + l.n, chars: t.chars + l.chars, words: t.words + l.words, estTokens: t.estTokens + l.estTokens }),
      { n: 0, chars: 0, words: 0, estTokens: 0 }
    );
    reply.header("Cache-Control", "no-store");
    return {
      periodoDias: q.data.dias,
      tenantId: q.data.tenantId ?? null,
      total,
      porFormulario: linhas,
      observacao: "Tokens estimados = caracteres ÷ 4 (volume de texto). Não é o consumo de IA, que aparece à parte. O texto das justificativas não é guardado aqui.",
    };
  });
}
