/**
 * Termo de Responsabilidade Clínica e LGPD (aceite do profissional) — [REG-003].
 *
 * Bug de 05/nov/2026: o Admin Master aceitava o termo e a API devolvia erro, porque o aceite gravava o id do Master
 * (ator virtual, sem linha em `users`) numa chave estrangeira. Também não havia trava no servidor: a janela era só visual.
 *
 * Garante: aceite grava prova + estado `true` + auditoria; sem a caixa nada é gravado; `false` bloqueia perfil clínico no
 * servidor; um aceite por conta; Admin Master aceita; auditoria do Master não se perde.
 * Roda só com TEST_DATABASE_URL (banco local de teste). Dados sintéticos.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente (E2E precisa de Postgres local de teste)" : false;

describe("[REG-003] termo profissional (E2E)", { skip }, () => {
  let app: FastifyInstance;
  let H: any;
  let eq: any;
  const MASTER = "master@teste.local";

  async function call(method: string, path: string, email?: string, body?: unknown) {
    const headers: Record<string, string> = { origin: "http://localhost:3000", "user-agent": "teste-e2e/1.0" };
    if (email) headers["x-test-email"] = email;
    if (body !== undefined) headers["content-type"] = "application/json";
    const r = await app.inject({ method: method as any, url: path, headers, payload: body === undefined ? undefined : JSON.stringify(body) });
    let parsed: any = null;
    try { parsed = r.json(); } catch { parsed = r.body; }
    return { status: r.statusCode, body: parsed };
  }

  before(async () => {
    const { assertSafeTestDatabase, resetTestDatabase } = await import("../testing/test-db");
    assertSafeTestDatabase(url);
    await resetTestDatabase(url!);

    process.env.DATABASE_URL = url!;
    process.env.NODE_ENV = "test";
    process.env.REQUIRE_PROFESSIONAL_TERM = "true"; // a trava só liga nos testes que pedem
    process.env.SUPERADMIN_EMAILS = MASTER;
    process.env.BETTER_AUTH_SECRET = "segredo-de-teste-com-mais-de-32-caracteres!!";
    process.env.BETTER_AUTH_URL = "http://localhost:3001";
    process.env.CORS_ORIGINS = "http://localhost:3000";

    const shared = await import("@periscopio/shared");
    ({ eq } = await import("drizzle-orm"));
    const { db } = await import("../db/client");
    const { VIRTUAL_ADMIN_ID } = await import("../security/roles");
    const { buildApp } = await import("../app");
    H = { ...shared, db, VIRTUAL_ADMIN_ID };

    const [tA] = await db.insert(shared.tenants).values({ name: "Município A (teste)", municipalityCode: "A" }).returning();
    // O Master atua no município "Plataforma Global" (id fixo), sem linha em users.
    await db.insert(shared.tenants).values({ id: VIRTUAL_ADMIN_ID, name: "Plataforma Global (teste)", municipalityCode: "GLOBAL" });
    const [sA] = await db.insert(shared.schools).values({ tenantId: tA.id, name: "Escola A1", slug: "escola-a1", status: "active" }).returning();
    for (const [email, name, role] of [
      ["re@teste.local", "RE Teste", "ppi"],
      ["re2@teste.local", "RE Dois", "ppi"],
      ["medico@teste.local", "Médico Teste", "md1"],
    ] as const) {
      await db.insert(shared.users).values({ tenantId: tA.id, schoolId: sA.id, email, name, role, accessEnabled: true });
    }
    app = await buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    await app?.close();
    const { db } = await import("../db/client");
    await (db as any).$client.end();
  });

  const evidencias = async (email: string) =>
    H.db.select().from(H.consentAcceptances).where(eq(H.consentAcceptances.signerEmail, email));
  const statusDe = async (email: string) => {
    const [u] = await H.db.select().from(H.users).where(eq(H.users.email, email));
    const [s] = await H.db.select().from(H.professionalTermStatus).where(eq(H.professionalTermStatus.userId, u.id));
    return { user: u, status: s };
  };
  const auditorias = async (email: string) =>
    H.db.select().from(H.auditLogs).where(eq(H.auditLogs.userEmail, email));

  test("[REG-003a] sem aceite (false) o perfil clínico é barrado no servidor, mas pode ler e aceitar o termo", async () => {
    const barrado = await call("GET", "/api/cases", "re@teste.local");
    assert.equal(barrado.status, 403);
    assert.equal(barrado.body.code, "TERMO_PENDENTE");
    assert.equal((await call("GET", "/api/cases", "medico@teste.local")).body.code, "TERMO_PENDENTE");

    const s = await call("GET", "/api/me/professional-consent", "re@teste.local");
    assert.equal(s.status, 200);
    assert.equal(s.body.hasAccepted, false);
    assert.match(s.body.term.content, /Sigilo e Reserva Profissional/, "a tela exibe o texto que o servidor guarda e usa no hash");
  });

  test("[REG-003b] aceitar sem marcar a caixa é recusado e não grava nada", async () => {
    for (const corpo of [{}, { accepted: false }, { accepted: "true" }]) {
      const r = await call("POST", "/api/me/professional-consent/accept", "re@teste.local", corpo);
      assert.equal(r.status, 400, JSON.stringify(corpo));
    }
    assert.equal((await evidencias("re@teste.local")).length, 0);
    assert.equal((await statusDe("re@teste.local")).status, undefined);
  });

  test("[REG-003c] com a caixa marcada grava prova, estado true e auditoria, e libera o uso", async () => {
    const termo = (await call("GET", "/api/me/professional-consent", "re@teste.local")).body.term;
    const r = await call("POST", "/api/me/professional-consent/accept", "re@teste.local", { accepted: true, termId: termo.id, termVersion: termo.version });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.alreadyAccepted, false);

    const { user, status } = await statusDe("re@teste.local");
    assert.equal(status.accepted, true);
    assert.equal(status.termVersion, termo.version);

    const [prova] = await evidencias("re@teste.local");
    assert.equal(prova.userId, user.id);
    assert.equal(prova.status, "accepted");
    assert.equal(prova.userAgent, "teste-e2e/1.0");
    assert.ok(prova.ipAddress);
    assert.equal(status.acceptanceId, prova.id, "o estado aponta para a prova");
    const recalculado = crypto
      .createHash("sha256")
      .update([termo.content, termo.version, "re@teste.local", "ppi", prova.ipAddress, prova.acceptedAt.toISOString()].join("|"))
      .digest("hex");
    assert.equal(prova.evidenceSha256, recalculado, "o hash prova o texto exato que foi exibido");

    const trilha = (await auditorias("re@teste.local")).filter((a: any) => a.action === "consent.professional_accepted");
    assert.equal(trilha.length, 1);
    assert.equal(trilha[0].actorId, user.id);
    assert.equal(trilha[0].entityId, prova.id);

    assert.equal((await call("GET", "/api/me/professional-consent", "re@teste.local")).body.hasAccepted, true);
    assert.equal((await call("GET", "/api/cases", "re@teste.local")).status, 200, "aceito = liberado");
    assert.equal((await call("GET", "/api/cases", "re2@teste.local")).body.code, "TERMO_PENDENTE", "o aceite vale só para a própria conta");
  });

  test("[REG-003d] um aceite por conta: repetir não duplica prova nem auditoria", async () => {
    const r = await call("POST", "/api/me/professional-consent/accept", "re@teste.local", { accepted: true });
    assert.equal(r.status, 200);
    assert.equal(r.body.alreadyAccepted, true);
    assert.equal((await evidencias("re@teste.local")).length, 1);
    assert.equal((await auditorias("re@teste.local")).filter((a: any) => a.action === "consent.professional_accepted").length, 1);
  });

  test("[REG-003e] Admin Master (ator virtual, sem linha em users) consegue aceitar e não vê mais a janela", async () => {
    const r = await call("POST", "/api/me/professional-consent/accept", MASTER, { accepted: true });
    assert.equal(r.status, 200, JSON.stringify(r.body));

    const [prova] = await evidencias(MASTER);
    assert.equal(prova.userId, null, "o vínculo com users fica nulo para o ator virtual");
    assert.equal(prova.signerEmail, MASTER);
    assert.equal(prova.signerRole, "admin_platform");

    const trilha = (await auditorias(MASTER)).filter((a: any) => a.action === "consent.professional_accepted");
    assert.equal(trilha.length, 1);
    assert.equal(trilha[0].actorId, null);
    assert.equal((trilha[0].metadata as any)?.actor, "admin_master_virtual");

    assert.equal((await call("GET", "/api/me/professional-consent", MASTER)).body.hasAccepted, true);
    assert.equal((await call("POST", "/api/me/professional-consent/accept", MASTER, { accepted: true })).body.alreadyAccepted, true);
    assert.equal((await evidencias(MASTER)).length, 1);
  });

  test("[REG-003f] a auditoria de qualquer ação do Admin Master é gravada (antes a chave estrangeira derrubava o registro)", async () => {
    const { recordAudit } = await import("../services/audit.service");
    await recordAudit({ tenantId: H.VIRTUAL_ADMIN_ID, userId: H.VIRTUAL_ADMIN_ID, userEmail: MASTER, action: "teste.acao_do_master", entityType: "teste" });
    const linhas = (await auditorias(MASTER)).filter((a: any) => a.action === "teste.acao_do_master");
    assert.equal(linhas.length, 1);
    assert.equal(linhas[0].actorId, null);
  });

  test("[REG-003g] termo desatualizado na tela é recusado (409) e nada é gravado", async () => {
    const antes = (await evidencias("medico@teste.local")).length;
    const r = await call("POST", "/api/me/professional-consent/accept", "medico@teste.local", { accepted: true, termId: "00000000-0000-4000-8000-0000000000aa" });
    assert.equal(r.status, 409);
    assert.equal((await evidencias("medico@teste.local")).length, antes);
    assert.equal((await statusDe("medico@teste.local")).status, undefined);
  });

  test("[REG-006] com a migração 0029 pendente (tabela ausente) não há 500 nem bloqueio: avisa e libera; aceitar responde 503 claro", async () => {
    const { sql } = await import("drizzle-orm");
    await H.db.execute(sql`DROP TABLE professional_term_status`);

    const s = await call("GET", "/api/me/professional-consent", "re2@teste.local");
    assert.equal(s.status, 200, JSON.stringify(s.body));
    assert.equal(s.body.migrationPending, true);
    assert.equal(s.body.hasAccepted, true, "sem a tabela não dá para gravar o aceite: a janela não aparece");

    assert.equal((await call("GET", "/api/cases", "re2@teste.local")).status, 200, "a trava do servidor também fica desligada");

    const r = await call("POST", "/api/me/professional-consent/accept", "re2@teste.local", { accepted: true });
    assert.equal(r.status, 503);
    assert.match(r.body.error, /migração/i);
    assert.equal((await evidencias("re2@teste.local")).length, 0, "nada foi gravado");
  });
});
