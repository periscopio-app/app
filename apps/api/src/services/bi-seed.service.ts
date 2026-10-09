/**
 * Conjunto inicial de aprendizado do assistente do BI.
 *
 * O assistente não é "treinado" com dados de aluno: ele aprende com pares pergunta → plano de consulta aprovados.
 * Este arquivo carrega um conjunto inicial (apps/bi-rag/seed/bi_examples_taruma.json), escrito com o vocabulário da base
 * de Tarumã, valida cada plano contra a camada semântica e grava como exemplo já aprovado (source = "seed").
 * Não contém linha de paciente, id de escola, nem número da base: só perguntas e a forma da consulta.
 */
import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { biQuestions } from "@periscopio/shared";
import { checkPlan, planSchema, scrubQuestion, type QueryPlan } from "./bi-semantic.service";

export const SEED_SOURCE = "seed";

const fileSchema = z
  .object({
    version: z.literal(1),
    source: z.string(),
    note: z.string().optional(),
    examples: z.array(z.object({ question: z.string().min(3).max(500), plan: z.unknown() }).strict()).min(1),
  })
  .strict();

export interface SeedExample {
  question: string;
  plan: QueryPlan;
}

/** Lê e valida o arquivo. Lança erro com a pergunta problemática; nada chega ao banco se uma só estiver inválida. */
export function loadSeedExamples(path: string): SeedExample[] {
  const file = fileSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  const seen = new Set<string>();
  return file.examples.map((e) => {
    const parsed = planSchema.safeParse(e.plan);
    if (!parsed.success) throw new Error(`Plano inválido em "${e.question}": ${parsed.error.issues[0]?.message}`);
    const bad = checkPlan(parsed.data);
    if (bad) throw new Error(`Plano incoerente em "${e.question}": ${bad}`);
    if (parsed.data.filters.schoolId) throw new Error(`Seed não pode carregar id de escola: "${e.question}"`);
    if (scrubQuestion(e.question).scrubbed) throw new Error(`Pergunta com dado pessoal: "${e.question}"`);
    if (seen.has(e.question)) throw new Error(`Pergunta repetida: "${e.question}"`);
    seen.add(e.question);
    return { question: e.question, plan: parsed.data };
  });
}

type Db = typeof import("../db/client").db;

/** Grava os exemplos que ainda não existem para o tenant. Idempotente: rodar de novo não duplica. */
export async function applySeed(db: Db, tenantId: string, examples: SeedExample[]): Promise<{ inserted: number; skipped: number }> {
  const existing = await db
    .select({ question: biQuestions.question })
    .from(biQuestions)
    .where(and(eq(biQuestions.tenantId, tenantId), eq(biQuestions.source, SEED_SOURCE)));
  const have = new Set(existing.map((r) => r.question));
  const todo = examples.filter((e) => !have.has(e.question));
  if (todo.length) {
    await db.insert(biQuestions).values(
      todo.map((e) => ({
        tenantId,
        role: "sistema",
        question: e.question,
        plan: e.plan,
        source: SEED_SOURCE,
        confidence: 1,
        rating: 1,
        approved: true,
      })),
    );
  }
  return { inserted: todo.length, skipped: examples.length - todo.length };
}
