/**
 * REG-018 — etiquetas do município: só o Administrador Master cadastra; o RE só escolhe as ativas do próprio município.
 * Dados sintéticos. Requer TEST_DATABASE_URL.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;
const G = "dificuldades_persistentes";

describe("Etiquetas (REG-018)", { skip }, () => {
  let app: FastifyInstance;
  let pool: typeof import("../db/client").pool;
  let tA = "";
  let tB = "";

  const call = async (method: string, path: string, email?: string, body?: unknown) => {
    const headers: Record<string, string> = { origin: "http://localhost:3000" };
    if (email) headers["x-test-email"] = email;
    if (body !== undefined) headers["content-type"] = "application/json";
    const r = await app.inject({ method: method as never, url: path, headers, payload: body === undefined ? undefined : JSON.stringify(body) });
    let parsed: any = null;
    try { parsed = r.json(); } catch { parsed = r.body; }
    return { status: r.statusCode, body: parsed };
  };

  before(async () => {
    const { assertSafeTestDatabase, resetTestDatabase } = await import("../testing/test-db");
    assertSafeTestDatabase(url);
    await resetTestDatabase(url!);
    process.env.DATABASE_URL = url!;
    process.env.NODE_ENV = "test";
    process.env.BETTER_AUTH_SECRET = "segredo-de-teste-com-mais-de-32-caracteres!!";
    process.env.BETTER_AUTH_URL = "http://localhost:3001";
    process.env.CORS_ORIGINS = "http://localhost:3000";
    process.env.SUPERADMIN_EMAILS = "master@teste.local";
    const shared = await import("@periscopio/shared");
    const { db, pool: p } = await import("../db/client");
    pool = p;
    const [a] = await db.insert(shared.tenants).values({ name: "Município A", municipalityCode: "EA" }).returning();
    const [b] = await db.insert(shared.tenants).values({ name: "Município B", municipalityCode: "EB" }).returning();
    tA = a.id; tB = b.id;
    const [esc] = await db.insert(shared.schools).values({ tenantId: tA, name: "Escola E", slug: "e", status: "active" }).returning();
    const [escB] = await db.insert(shared.schools).values({ tenantId: tB, name: "Escola F", slug: "f", status: "active" }).returning();
    const pessoas: [string, string, string, string | null][] = [
      ["adm", "admin_platform", tA, null], ["re", "ppi", tA, esc.id], ["reb", "ppi", tB, escB.id], ["md", "md1", tA, null],
    ];
    for (const [k, role, tenant, school] of pessoas) {
      await db.insert(shared.users).values({ tenantId: tenant, schoolId: school, email: `${k}@teste.local`, name: `Pessoa ${k}`, role, accessEnabled: true });
    }
    const { buildApp } = await import("../app");
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await app?.close();
  });

  test("quem não é Administrador Master não cadastra, não altera e não lista a gestão (403, sem dado)", async () => {
    for (const who of ["re@teste.local", "md@teste.local"]) {
      const post = await call("POST", "/api/admin/etiquetas", who, { grupo: G, rotulo: "Visão" });
      assert.equal(post.status, 403, who);
      assert.ok(!post.body.etiqueta);
      assert.equal((await call("GET", `/api/admin/etiquetas?grupo=${G}`, who)).status, 403);
      assert.equal((await call("PATCH", "/api/admin/etiquetas/00000000-0000-4000-8000-000000000001", who, { ativo: false })).status, 403);
    }
    assert.equal((await call("GET", `/api/etiquetas?grupo=${G}`)).status, 401, "sem sessão");
  });

  let visaoId = "";

  test("o Administrador Master cadastra; nome repetido (maiúscula/espaço) é 409; grupo e nome inválidos são 400", async () => {
    const ok = await call("POST", "/api/admin/etiquetas", "adm@teste.local", { grupo: G, rotulo: "  Visão   baixa " });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.equal(ok.body.etiqueta.rotulo, "Visão baixa", "espaços normalizados");
    assert.equal(ok.body.etiqueta.ativo, true);
    visaoId = ok.body.etiqueta.id;

    const dup = await call("POST", "/api/admin/etiquetas", "adm@teste.local", { grupo: G, rotulo: "visão BAIXA" });
    assert.equal(dup.status, 409);
    assert.match(dup.body.error, /Já existe/);

    assert.equal((await call("POST", "/api/admin/etiquetas", "adm@teste.local", { grupo: "inventado", rotulo: "Audição" })).status, 400);
    for (const ruim of ["a", "12", "<b>x</b>", "veja https://x.com", "fulano@x.com", "   "]) {
      assert.equal((await call("POST", "/api/admin/etiquetas", "adm@teste.local", { grupo: G, rotulo: ruim })).status, 400, ruim);
    }
    assert.equal((await call("POST", "/api/admin/etiquetas", "adm@teste.local", { grupo: G, rotulo: "x".repeat(81) })).status, 400);
  });

  test("o RE vê só as ativas do próprio município; outro município não vê nada", async () => {
    await call("POST", "/api/admin/etiquetas", "adm@teste.local", { grupo: G, rotulo: "Audição" });
    const re = await call("GET", `/api/etiquetas?grupo=${G}`, "re@teste.local");
    assert.equal(re.status, 200);
    assert.deepEqual(re.body.etiquetas.map((e: any) => e.rotulo), ["Audição", "Visão baixa"], "ordem alfabética");
    assert.deepEqual(Object.keys(re.body.etiquetas[0]).sort(), ["grupo", "id", "rotulo"], "sem campos de gestão");
    assert.deepEqual((await call("GET", `/api/etiquetas?grupo=${G}`, "reb@teste.local")).body.etiquetas, []);
    assert.equal((await call("GET", "/api/etiquetas?grupo=inventado", "re@teste.local")).status, 400);
  });

  test("a mesma etiqueta pode existir em outro município; o admin cadastra para o município que escolher", async () => {
    const b = await call("POST", "/api/admin/etiquetas", "adm@teste.local", { tenantId: tB, grupo: G, rotulo: "Visão baixa" });
    assert.equal(b.status, 201);
    assert.deepEqual((await call("GET", `/api/etiquetas?grupo=${G}`, "reb@teste.local")).body.etiquetas.map((e: any) => e.rotulo), ["Visão baixa"]);
    assert.equal((await call("POST", "/api/admin/etiquetas", "adm@teste.local", { tenantId: "00000000-0000-4000-8000-0000000000aa", grupo: G, rotulo: "Fala" })).status, 404);
  });

  test("desativar tira da lista do RE mas mantém na do admin; renomear para nome existente é 409; id inexistente é 404", async () => {
    const off = await call("PATCH", `/api/admin/etiquetas/${visaoId}`, "adm@teste.local", { ativo: false });
    assert.equal(off.status, 200);
    assert.deepEqual((await call("GET", `/api/etiquetas?grupo=${G}`, "re@teste.local")).body.etiquetas.map((e: any) => e.rotulo), ["Audição"]);
    const adm = await call("GET", `/api/admin/etiquetas?grupo=${G}`, "adm@teste.local");
    assert.equal(adm.body.etiquetas.find((e: any) => e.id === visaoId).ativo, false);

    assert.equal((await call("PATCH", `/api/admin/etiquetas/${visaoId}`, "adm@teste.local", { rotulo: "audição" })).status, 409);
    assert.equal((await call("PATCH", `/api/admin/etiquetas/${visaoId}`, "adm@teste.local", {})).status, 400);
    assert.equal((await call("PATCH", "/api/admin/etiquetas/00000000-0000-4000-8000-0000000000bb", "adm@teste.local", { ativo: true })).status, 404);
    assert.equal((await call("PATCH", "/api/admin/etiquetas/nao-e-uuid", "adm@teste.local", { ativo: true })).status, 400);
    assert.equal((await call("PATCH", `/api/admin/etiquetas/${visaoId}`, "adm@teste.local", { rotulo: "Visão reduzida", ativo: true })).status, 200);
  });

  test("toda mudança fica na trilha de auditoria, só com o nome da etiqueta", async () => {
    const r = await pool.query("SELECT action, payload FROM audit_logs WHERE action LIKE 'etiqueta.%' ORDER BY created_at");
    const acoes = r.rows.map((x) => x.action);
    assert.ok(acoes.filter((a) => a === "etiqueta.created").length >= 3);
    assert.ok(acoes.includes("etiqueta.updated"));
    assert.ok(!JSON.stringify(r.rows).includes("@teste.local"), "sem e-mail no payload");
  });
});
