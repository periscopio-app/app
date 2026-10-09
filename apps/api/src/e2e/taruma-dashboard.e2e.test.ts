/**
 * E2E do painel exclusivo de Tarumã. Requer TEST_DATABASE_URL (Postgres local de teste).
 * Garante: a administração da plataforma enxerga a base de Tarumã mesmo estando em outro município;
 * gestão de outro município não; escola isolada vê só o próprio agregado; nada individual na resposta.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;
const PASS = "Senha-de-teste-123!";

describe("painel de Tarumã (E2E)", { skip }, () => {
  let app: FastifyInstance;
  const cookies = {} as Record<string, string>;

  async function call(method: string, path: string, who: string) {
    const r = await app.inject({ method: method as any, url: path, headers: { origin: "http://localhost:3000", cookie: cookies[who] } });
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
    process.env.BETTER_AUTH_SECRET = "segredo-de-teste-com-mais-de-32-caracteres!!";
    process.env.BETTER_AUTH_URL = "http://localhost:3001";
    process.env.CORS_ORIGINS = "http://localhost:3000";

    const shared = await import("@periscopio/shared");
    const { db } = await import("../db/client");
    const { upsertCredential } = await import("../auth/credentials");
    const { buildApp } = await import("../app");

    const [plat] = await db.insert(shared.tenants).values({ name: "Plataforma", municipalityCode: "0000000" }).returning();
    const [tar] = await db.insert(shared.tenants).values({ name: "Município de Tarumã", municipalityCode: "3553955" }).returning();
    const [outro] = await db.insert(shared.tenants).values({ name: "Outro município", municipalityCode: "9999999" }).returning();
    const [gl] = await db.insert(shared.schools).values({ tenantId: tar.id, name: "Escola GL", slug: "t-gl", status: "active", externalCode: "2" }).returning();
    await db.insert(shared.schools).values({ tenantId: tar.id, name: "Escola JR", slug: "t-jr", status: "active", externalCode: "4" });

    const cells = (t: number | null, pilot: number | null) => ({
      total: t,
      ageBands: { "3-5": null, "6-9": pilot, "10-12": 20, "13-17": 40, "18+": 30 },
      complaints: { "Escrita + leitura": 60, "Falta de atenção": 25 },
      services: { fonoaudiologia: 50, psicopedagogia: 40, psicoterapia: 20, psicomotricidade: 10, neuropsicologia: 45, assistencia_social: null, consulta_medica: t },
    });
    const src = "taruma-nemt-2024";
    const rows = [
      { schoolCode: "TOTAL", schoolLabel: "Município", payload: cells(500, 71) },
      { schoolCode: "2", schoolLabel: "GL", payload: cells(117, 16) },
      { schoolCode: "4", schoolLabel: "JR", payload: cells(107, 15) },
      { schoolCode: "0", schoolLabel: "Não se aplica", payload: cells(15, null) },
    ];
    for (const r of rows) {
      await db.insert(shared.populationAggregates).values({ tenantId: tar.id, source: src, referenceYear: 2024, ...r });
    }
    // Outra base (não é Tarumã) no outro município: nunca pode aparecer no painel.
    await db.insert(shared.populationAggregates).values({ tenantId: outro.id, source: "outra-base", referenceYear: 2024, schoolCode: "TOTAL", schoolLabel: "X", payload: cells(9999, 9999) });

    const people = [
      { key: "admin", email: "admin@teste.local", role: "admin_platform", tenant: plat.id, school: null },
      { key: "municipal", email: "municipal@teste.local", role: "municipal_manager", tenant: tar.id, school: null },
      { key: "gestorGL", email: "gestorgl@teste.local", role: "school_manager", tenant: tar.id, school: gl.id },
      { key: "outroGestor", email: "outro@teste.local", role: "municipal_manager", tenant: outro.id, school: null },
      { key: "esp", email: "esp@teste.local", role: "specialist", tenant: tar.id, school: null },
    ];
    for (const p of people) {
      await db.insert(shared.users).values({ tenantId: p.tenant, schoolId: p.school, email: p.email, name: p.key, role: p.role, accessEnabled: true });
      await upsertCredential({ email: p.email, name: p.key, password: PASS });
    }
    app = await buildApp({ logger: false });
    await app.ready();
    for (const p of people) {
      const r = await app.inject({
        method: "POST", url: "/api/auth/sign-in/email",
        headers: { origin: "http://localhost:3000", "content-type": "application/json" },
        payload: JSON.stringify({ email: p.email, password: PASS }),
      });
      assert.equal(r.statusCode, 200);
      const set = r.headers["set-cookie"];
      cookies[p.key] = (Array.isArray(set) ? set : [String(set)]).map((c) => c.split(";")[0]).join("; ");
    }
  });

  after(async () => {
    await app?.close();
    const { db } = await import("../db/client");
    await (db as any).$client.end();
  });

  test("admin da plataforma (outro município) vê o painel de Tarumã, com auditoria", async () => {
    const r = await call("GET", "/api/population/taruma", "admin");
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.municipality, "Tarumã");
    assert.equal(r.body.source, "taruma-nemt-2024");
    const d = r.body.dashboard;
    assert.equal(d.scope, "municipio");
    assert.equal(d.totalCases, 500);
    assert.equal(d.kpis.find((k: any) => k.id === "casos").value, "500");
    assert.deepEqual(d.casesBySchool.map((x: any) => x.label), ["GL", "JR"]);
    assert.ok(JSON.stringify(r.body).indexOf("9999") === -1, "dados de outra base não vazam");
    assert.equal(r.body.schools.length, 2);
    assert.equal(r.body.center.latitude < -20 && r.body.center.latitude > -25, true);

    const { db } = await import("../db/client");
    const shared = await import("@periscopio/shared");
    const logs = await db.select().from(shared.auditLogs);
    assert.ok(logs.some((l) => l.action === "population:taruma_view"));
  });

  test("gestão municipal de Tarumã vê o município inteiro; capacidade editada recalcula", async () => {
    const r = await call("GET", "/api/population/taruma?capacity=" + encodeURIComponent(JSON.stringify({ fonoaudiologia: 25 })), "municipal");
    assert.equal(r.status, 200);
    assert.equal(r.body.dashboard.services.find((s: any) => s.key === "fonoaudiologia").professionals, 2);
    assert.equal(r.body.capacity.fonoaudiologia, 25);
  });

  test("gestor de uma escola vê só o agregado da própria escola", async () => {
    const r = await call("GET", "/api/population/taruma", "gestorGL");
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.dashboard.scope, "escola");
    assert.equal(r.body.dashboard.totalCases, 117);
    assert.equal(r.body.schools.length, 1);
    assert.ok(!r.body.dashboard.kpis.some((k: any) => k.id === "concentracao"));
  });

  test("outro município e perfil sem acesso não enxergam Tarumã", async () => {
    assert.equal((await call("GET", "/api/population/taruma", "outroGestor")).status, 404);
    assert.equal((await call("GET", "/api/population/taruma", "esp")).status, 403);
  });
});
