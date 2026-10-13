import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { requireCapability } from "../security/actor";
import { snapshot, toPrometheus } from "../observability/metrics";
import { timingSafeEqual } from "node:crypto";

/** Só booleanos: nunca o valor de segredos. */
function configChecks() {
  const has = (k: string) => !!process.env[k]?.trim();
  const secretOk = (process.env.BETTER_AUTH_SECRET ?? "").length >= 32;
  return [
    { key: "BETTER_AUTH_SECRET", ok: secretOk, hint: "Segredo de sessão e dos links de acesso (mínimo 32 caracteres)." },
    { key: "DATABASE_URL", ok: has("DATABASE_URL"), hint: "Conexão com o banco." },
    { key: "RESEND_API_KEY", ok: has("RESEND_API_KEY"), hint: "Envio de e-mail (convites e recuperação de senha)." },
    { key: "RESEND_FROM_EMAIL", ok: has("RESEND_FROM_EMAIL"), hint: "Remetente verificado no Resend." },
    { key: "APP_URL", ok: has("APP_URL") && !/localhost/.test(process.env.APP_URL ?? ""), hint: "Endereço público do site (usado nos links dos e-mails)." },
    { key: "CORS_ORIGINS", ok: has("CORS_ORIGINS") && !/^\*$/.test(process.env.CORS_ORIGINS ?? ""), hint: "Origens permitidas para chamar a API." },
    { key: "BI_RAG_URL", ok: has("BI_RAG_URL"), hint: "Assistente de IA (sem ele, os resumos usam só regras)." },
    { key: "SUPABASE_URL", ok: has("SUPABASE_URL"), hint: "Armazenamento de anexos." },
    { key: "METRICS_TOKEN", ok: has("METRICS_TOKEN"), hint: "Libera /metrics para um coletor externo." },
  ];
}

export async function observabilityRoutes(app: FastifyInstance) {
  // Painel do Administrador Master.
  app.get("/api/admin/observability", async (request, reply) => {
    const actor = await requireCapability(request, reply, "system.observability.view");
    if (!actor) return;

    const t0 = performance.now();
    let dbOk = true;
    let dbError: string | null = null;
    try {
      await db.execute(sql`SELECT 1`);
    } catch (e) {
      dbOk = false;
      dbError = e instanceof Error ? e.constructor.name : "erro";
    }
    const dbLatencyMs = Math.round(performance.now() - t0);

    const m = snapshot();
    const alerts: { level: "alto" | "medio"; text: string }[] = [];
    if (!dbOk) alerts.push({ level: "alto", text: "O banco não respondeu." });
    else if (dbLatencyMs > 800) alerts.push({ level: "medio", text: `O banco está lento (${dbLatencyMs} ms).` });
    if (m.http.total >= 20 && m.http.errorRate5xx > 0.02) {
      alerts.push({ level: "alto", text: `${(m.http.errorRate5xx * 100).toFixed(1)}% das requisições falharam com erro do servidor.` });
    }
    if ((m.counters.email_send_failures ?? 0) > 0) {
      alerts.push({ level: "alto", text: `${m.counters.email_send_failures} e-mail(s) não saíram (convite ou recuperação de senha). Confira RESEND_API_KEY e o domínio do remetente.` });
    }
    if (m.http.total >= 20 && (m.http.p95Ms ?? 0) > 2500) {
      alerts.push({ level: "medio", text: `Lentidão: 95% das requisições levam até ${m.http.p95Ms} ms ou mais.` });
    }
    const missing = configChecks().filter((c) => !c.ok && c.key !== "METRICS_TOKEN" && c.key !== "BI_RAG_URL" && c.key !== "SUPABASE_URL");
    if (missing.length) alerts.push({ level: "alto", text: `Configuração faltando: ${missing.map((c) => c.key).join(", ")}.` });

    return {
      generatedAt: new Date().toISOString(),
      instance: {
        node: process.version,
        commit: (process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT ?? "").slice(0, 7) || null,
        environment: process.env.NODE_ENV ?? "development",
        memoryMb: Math.round(process.memoryUsage().rss / 1048576),
      },
      db: { ok: dbOk, latencyMs: dbLatencyMs, error: dbError },
      alerts,
      config: configChecks(),
      ...m,
      note: "Números desta instância desde o último reinício. Com mais de uma instância, cada uma mostra os seus.",
    };
  });

  // Coletor externo (Prometheus/Grafana). Desligado enquanto METRICS_TOKEN não existir.
  app.get("/metrics", { logLevel: "warn" }, async (request, reply) => {
    const token = process.env.METRICS_TOKEN;
    if (!token) return reply.status(404).send({ error: "Não encontrado" });
    const given = (request.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    const a = Buffer.from(given);
    const b = Buffer.from(token);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return reply.status(401).send({ error: "Não autorizado" });
    reply.header("content-type", "text/plain; version=0.0.4; charset=utf-8");
    return toPrometheus();
  });
}
