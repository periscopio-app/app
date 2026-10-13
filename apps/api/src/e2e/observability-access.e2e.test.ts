/**
 * Recuperação de senha (link por e-mail) e observabilidade da API.
 * Requer TEST_DATABASE_URL (Postgres local de teste).
 */
import { test, before, describe } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;
const SECRET = "segredo-de-teste-com-mais-de-32-caracteres!!";

describe("Recuperação de senha e saúde do sistema (E2E)", { skip }, () => {
  let app: FastifyInstance;
  let metrics: typeof import("../observability/metrics");
  let limits: typeof import("../security/rate-limit");
  let sql: typeof import("drizzle-orm").sql;
  let dbx: typeof import("../db/client").db;
  let link: typeof import("../auth/access-link");
  let cred: typeof import("../auth/credentials");
  const ids: Record<string, string> = {};

  const inject = async (method: string, path: string, opts: { email?: string; body?: unknown; headers?: Record<string, string> } = {}) => {
    const headers: Record<string, string> = { origin: "http://localhost:3000", ...(opts.headers ?? {}) };
    if (opts.email) headers["x-test-email"] = opts.email;
    if (opts.body !== undefined) headers["content-type"] = "application/json";
    const r = await app.inject({ method: method as never, url: path, headers, payload: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
    let body: any = null;
    try { body = r.json(); } catch { body = r.body; }
    return { status: r.statusCode, body, headers: r.headers };
  };
  const tokenFor = async (email: string) => link.createAccessToken(email, await cred.credentialFingerprint(email));

  before(async () => {
    const { assertSafeTestDatabase, resetTestDatabase } = await import("../testing/test-db");
    assertSafeTestDatabase(url);
    await resetTestDatabase(url!);
    process.env.DATABASE_URL = url!;
    process.env.NODE_ENV = "test";
    process.env.BETTER_AUTH_SECRET = SECRET;
    process.env.BETTER_AUTH_URL = "http://localhost:3001";
    process.env.CORS_ORIGINS = "http://localhost:3000";
    delete process.env.RESEND_API_KEY; // o envio falha na hora, sem rede
    delete process.env.METRICS_TOKEN;

    const shared = await import("@periscopio/shared");
    ({ db: dbx } = await import("../db/client"));
    ({ sql } = await import("drizzle-orm"));
    metrics = await import("../observability/metrics");
    limits = await import("../security/rate-limit");
    link = await import("../auth/access-link");
    cred = await import("../auth/credentials");
    const { buildApp } = await import("../app");

    const [t] = await dbx.insert(shared.tenants).values({ name: "Município T", municipalityCode: "T" }).returning();
    for (const [key, role] of [["admin", "admin_platform"], ["md", "md1"], ["ana", "ppi"]] as const) {
      const email = `${key}@teste.local`;
      const [u] = await dbx.insert(shared.users).values({ tenantId: t.id, email, name: key, role, accessEnabled: true }).returning();
      ids[key] = u.id;
      await cred.upsertCredential({ email, name: key, password: "Senha-antiga-123!", isAdmin: role === "admin_platform" });
    }

    app = await buildApp({ logger: false });
    app.get("/__boom", async () => {
      throw new Error("falha simulada com detalhe interno");
    });
    await app.ready();
  });

  test("toda resposta leva x-request-id; id válido de entrada é mantido, inválido é trocado", async () => {
    const a = await inject("GET", "/health");
    assert.match(String(a.headers["x-request-id"]), /^[0-9a-f-]{36}$/);
    const b = await inject("GET", "/health", { headers: { "x-request-id": "meu-id-1234567" } });
    assert.equal(b.headers["x-request-id"], "meu-id-1234567");
    const c = await inject("GET", "/health", { headers: { "x-request-id": "<x>" } });
    assert.notEqual(c.headers["x-request-id"], "<x>");
  });

  test("/health/ready e /health/db só dizem se o banco responde, sem versão nem nome do banco", async () => {
    for (const p of ["/health/ready", "/health/db"]) {
      const r = await inject("GET", p);
      assert.equal(r.status, 200);
      assert.equal(r.body.status, "ready");
      assert.equal(r.body.db.ok, true);
      assert.ok(!JSON.stringify(r.body).match(/postgres|PostgreSQL|neondb/i));
    }
  });

  test("erro 5xx: resposta traz requestId, o erro entra no painel e o contador sobe", async () => {
    metrics.resetMetrics();
    const r = await inject("GET", "/__boom");
    assert.equal(r.status, 500);
    assert.equal(r.body.requestId, r.headers["x-request-id"]);
    const s = metrics.snapshot();
    assert.equal(s.http.errors5xx, 1);
    assert.equal(s.recentErrors[0].route, "/__boom");
    assert.equal(s.recentErrors[0].errorClass, "Error");
    assert.equal(s.recentErrors[0].requestId, r.body.requestId);
  });

  test("erro 4xx continua com a mensagem original", async () => {
    const r = await inject("POST", "/api/access/set-password", { body: { token: "x" } });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /nova senha/);
  });

  test("painel de saúde: só o Master, com alertas, config sem valores e sem segredo", async () => {
    assert.equal((await inject("GET", "/api/admin/observability", { email: "md@teste.local" })).status, 403);
    assert.equal((await inject("GET", "/api/admin/observability")).status, 401);
    const r = await inject("GET", "/api/admin/observability", { email: "admin@teste.local" });
    assert.equal(r.status, 200);
    assert.equal(r.body.db.ok, true);
    assert.ok(Array.isArray(r.body.alerts));
    assert.ok(r.body.config.every((c: any) => typeof c.ok === "boolean" && !("value" in c)));
    assert.ok(!JSON.stringify(r.body).includes(SECRET));
    // RESEND_API_KEY não está configurada neste teste → aparece como configuração faltando.
    assert.ok(r.body.alerts.some((a: any) => /RESEND_API_KEY/.test(a.text)));
  });

  test("/metrics: desligado sem token; com token exige Bearer correto", async () => {
    assert.equal((await inject("GET", "/metrics")).status, 404);
    process.env.METRICS_TOKEN = "token-de-metricas-123";
    try {
      assert.equal((await inject("GET", "/metrics")).status, 401);
      assert.equal((await inject("GET", "/metrics", { headers: { authorization: "Bearer errado-errado-errado" } })).status, 401);
      const ok = await inject("GET", "/metrics", { headers: { authorization: "Bearer token-de-metricas-123" } });
      assert.equal(ok.status, 200);
      assert.match(String(ok.body), /periscopio_http_requests_total/);
    } finally {
      delete process.env.METRICS_TOKEN;
    }
  });

  test("pedir link: resposta igual para e-mail existente e inexistente; falha de envio é contada", async () => {
    limits.resetRateLimits();
    metrics.resetMetrics();
    const known = await inject("POST", "/api/access/request", { body: { email: "ana@teste.local" } });
    const unknown = await inject("POST", "/api/access/request", { body: { email: "ninguem@teste.local" } });
    assert.deepEqual(known.body, { success: true });
    assert.deepEqual(unknown.body, { success: true });
    assert.equal(metrics.snapshot().counters.email_send_failures, 1); // só o existente tentou enviar
    assert.equal((await inject("POST", "/api/access/request", { body: { email: "invalido" } })).status, 400);
  });

  test("pedir link: o 11º pedido do mesmo IP na hora leva 429", async () => {
    limits.resetRateLimits();
    for (let i = 0; i < 10; i++) {
      assert.equal((await inject("POST", "/api/access/request", { body: { email: `x${i}@teste.local` } })).status, 200);
    }
    const r = await inject("POST", "/api/access/request", { body: { email: "x11@teste.local" } });
    assert.equal(r.status, 429);
    assert.ok(r.headers["retry-after"]);
    assert.ok(metrics.snapshot().counters.rate_limited_access_request >= 1);
  });

  test("redefinir: valida o link, troca a senha, derruba sessões, audita e o link não vale de novo", async () => {
    limits.resetRateLimits();
    metrics.resetMetrics();
    const email = "ana@teste.local";
    await dbx.execute(sql`INSERT INTO neon_auth.session (id, "expiresAt", token, "createdAt", "updatedAt", "userId")
      SELECT gen_random_uuid(), NOW() + interval '1 day', 'tok-teste-1', NOW(), NOW(), id FROM neon_auth."user" WHERE email = ${email}`);

    const token = await tokenFor(email);
    const v = await inject("GET", `/api/access/validate?token=${encodeURIComponent(token)}`);
    assert.equal(v.status, 200);
    assert.equal(v.body.valid, true);

    assert.equal((await inject("POST", "/api/access/set-password", { body: { token, password: "curta" } })).status, 400);

    const ok = await inject("POST", "/api/access/set-password", { body: { token, password: "Senha-nova-456!" } });
    assert.equal(ok.status, 200);

    const sess = await dbx.execute(sql`SELECT count(*)::int AS n FROM neon_auth.session WHERE token = 'tok-teste-1'`);
    assert.equal(sess.rows[0].n, 0);

    const audit = await dbx.execute(sql`SELECT count(*)::int AS n FROM audit_logs WHERE action = 'access:password_reset' AND actor_id = ${ids.ana}`);
    assert.equal(audit.rows[0].n, 1);
    assert.equal(metrics.snapshot().counters.password_resets, 1);

    const again = await inject("POST", "/api/access/set-password", { body: { token, password: "Outra-senha-789!" } });
    assert.equal(again.status, 400);
    assert.match(again.body.error, /já foi utilizado/);
    assert.equal((await inject("GET", `/api/access/validate?token=${encodeURIComponent(token)}`)).status, 400);
  });

  test("link forjado, adulterado ou de e-mail sem cadastro é recusado", async () => {
    limits.resetRateLimits();
    const forged = link.createAccessToken("ana@teste.local", "impressao-errada");
    assert.equal((await inject("POST", "/api/access/set-password", { body: { token: forged, password: "Senha-nova-456!" } })).status, 400);
    const ghost = link.createAccessToken("ninguem@teste.local", "sem-credencial");
    assert.equal((await inject("POST", "/api/access/set-password", { body: { token: ghost, password: "Senha-nova-456!" } })).status, 400);
    assert.equal((await inject("POST", "/api/access/set-password", { body: { token: "lixo.lixo", password: "Senha-nova-456!" } })).status, 400);
  });

  test("redefinir: o 21º envio do mesmo IP na hora leva 429", async () => {
    limits.resetRateLimits();
    let last = 0;
    for (let i = 0; i < 21; i++) last = (await inject("POST", "/api/access/set-password", { body: { token: "lixo.lixo", password: "Senha-nova-456!" } })).status;
    assert.equal(last, 429);
  });
});
