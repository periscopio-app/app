import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "../db/client";

async function pingDb(): Promise<{ ok: boolean; latencyMs: number }> {
  const t0 = performance.now();
  try {
    await Promise.race([
      db.execute(sql`SELECT 1`),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
    ]);
    return { ok: true, latencyMs: Math.round(performance.now() - t0) };
  } catch {
    return { ok: false, latencyMs: Math.round(performance.now() - t0) };
  }
}

export async function healthRoutes(app: FastifyInstance) {
  // Vivacidade: usado pelo Render a cada poucos segundos, por isso fica fora do log de acesso.
  app.get("/health", { logLevel: "warn" }, async () => ({ status: "ok" }));

  // Prontidão: a instância só está pronta se o banco responde. Não expõe versão, nome do banco nem mensagem de erro.
  const ready = async (_req: unknown, reply: { status: (n: number) => unknown }) => {
    const d = await pingDb();
    if (!d.ok) reply.status(503);
    return { status: d.ok ? "ready" : "not_ready", db: d };
  };
  app.get("/health/ready", { logLevel: "warn" }, ready as never);
  app.get("/health/db", { logLevel: "warn" }, ready as never);
}
