/**
 * E2E do mapa populacional (agregados) e do cadastro/importação de alunos. Requer TEST_DATABASE_URL (Postgres local de teste).
 * O fetch para api.resend.com é interceptado: nenhum e-mail real é enviado.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;
const PASS = "Senha-de-teste-123!";

describe("mapa populacional e cadastro de aluno (E2E)", { skip }, () => {
  let app: FastifyInstance;
  const cookies = {} as Record<string, string>;
  const sent: any[] = [];
  const realFetch = globalThis.fetch;
  let schoolGL = "";
  let schoolNova = "";
  let schoolB = "";

  async function call(method: string, path: string, who?: string, body?: unknown) {
    const headers: Record<string, string> = { origin: "http://localhost:3000" };
    if (who) headers.cookie = cookies[who];
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
    process.env.BETTER_AUTH_SECRET = "segredo-de-teste-com-mais-de-32-caracteres!!";
    process.env.BETTER_AUTH_URL = "http://localhost:3001";
    process.env.CORS_ORIGINS = "http://localhost:3000";
    process.env.RESEND_API_KEY = "re_teste";

    globalThis.fetch = (async (input: any, init?: any) => {
      if (String(input).startsWith("https://api.resend.com/")) {
        sent.push(JSON.parse(init.body));
        return new Response(JSON.stringify({ id: "email_fake" }), { status: 200 });
      }
      return realFetch(input, init);
    }) as typeof fetch;

    const shared = await import("@periscopio/shared");
    const { db } = await import("../db/client");
    const { upsertCredential } = await import("../auth/credentials");
    const { buildApp } = await import("../app");

    const [tA] = await db.insert(shared.tenants).values({ name: "Município A", municipalityCode: "A" }).returning();
    const [tB] = await db.insert(shared.tenants).values({ name: "Município B", municipalityCode: "B" }).returning();
    const [sA] = await db.insert(shared.schools).values({ tenantId: tA.id, name: "Escola GL", slug: "escola-gl", status: "active", externalCode: "2" }).returning();
    const [sN] = await db.insert(shared.schools).values({ tenantId: tA.id, name: "Escola Nova", slug: "escola-nova", status: "active" }).returning();
    const [sB] = await db.insert(shared.schools).values({ tenantId: tB.id, name: "Escola B1", slug: "escola-b1", status: "active" }).returning();
    schoolGL = sA.id; schoolNova = sN.id; schoolB = sB.id;
    const people = [
      { key: "admin", email: "admin@teste.local", role: "admin_platform", tenant: tA.id, school: null },
      { key: "gestor", email: "gestor@teste.local", role: "school_manager", tenant: tA.id, school: sA.id },
      { key: "municipal", email: "municipal@teste.local", role: "municipal_manager", tenant: tA.id, school: null },
      { key: "re", email: "re@teste.local", role: "ppi", tenant: tA.id, school: sA.id },
      { key: "esp", email: "esp@teste.local", role: "specialist", tenant: tA.id, school: sA.id },
      { key: "boardB", email: "drab@teste.local", role: "board", tenant: tB.id, school: null },
    ];
    for (const p of people) {
      await db.insert(shared.users).values({
        tenantId: p.tenant, schoolId: p.school, email: p.email, name: p.key, role: p.role, accessEnabled: true,
      });
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
    globalThis.fetch = realFetch;
    await app?.close();
    const { db } = await import("../db/client");
    await (db as any).$client.end();
  });

  const cells = (t: number | null, f: number | null) => ({
    total: t,
    ageBands: { "6-9": 14, "10-12": null },
    complaints: { "Falta de atenção": 20 },
    services: { fonoaudiologia: f, psicopedagogia: 42, psicoterapia: null, psicomotricidade: 12, neuropsicologia: 54, assistencia_social: 0, consulta_medica: t },
  });
  const importBody = {
    source: "teste-agregado",
    referenceYear: 2024,
    total: cells(500, 227),
    schools: [
      { schoolCode: "2", schoolLabel: "GL", ...cells(117, 66) },
      { schoolCode: "9", schoolLabel: "VILA DO LAGO", ...cells(12, 9) },
    ],
  };

  test("importação: só admin; campo individual é recusado", async () => {
    assert.equal((await call("POST", "/api/population/import", "gestor", importBody)).status, 403);
    const comNome = { ...importBody, schools: [{ ...importBody.schools[0], nome: "Fulano" }] };
    assert.equal((await call("POST", "/api/population/import", "admin", comNome)).status, 400);
    const r = await call("POST", "/api/population/import", "admin", importBody);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.imported, 3);
  });

  test("mapa: escola vinculada calcula profissionais; pontos sem informação listados", async () => {
    const m = await call("GET", "/api/population/map", "municipal");
    assert.equal(m.status, 200, JSON.stringify(m.body));
    const gl = m.body.schools.find((s: any) => s.name === "Escola GL");
    assert.equal(gl.planning.casesRegistered, 117);
    assert.equal(gl.planning.ratePer1000, null, "sem matrícula não há taxa");
    assert.ok(gl.semInformacao.includes("matrícula"));
    assert.ok(gl.semInformacao.includes("localização"));
    assert.equal(gl.planning.lowerBound, true, "psicoterapia suprimida");
    const nova = m.body.schools.find((s: any) => s.name === "Escola Nova");
    assert.equal(nova.planning, null);
    assert.ok(nova.semInformacao.includes("dados da base populacional"));
    assert.deepEqual(m.body.unlinked.map((u: any) => u.schoolCode), ["9"]);
    assert.equal(m.body.network.total, 500);
    assert.equal(m.body.capacityIsPlaceholder, true);
  });

  test("RE preenche localização e matrícula; taxa por mil aparece; gestor da escola não vê a rede", async () => {
    const g = await call("PUT", `/api/schools/${schoolGL}/geo`, "re", { address: "Rua Exemplo, 100, Tarumã - SP", latitude: -22.74, longitude: -50.57, enrollment: 900 });
    assert.equal(g.status, 200, JSON.stringify(g.body));
    const m = await call("GET", "/api/population/map?capacity=" + encodeURIComponent(JSON.stringify({ fonoaudiologia: 33 })), "gestor");
    const gl = m.body.schools.find((s: any) => s.name === "Escola GL");
    assert.equal(gl.planning.ratePer1000, 130);
    assert.equal(m.body.capacity.fonoaudiologia, 33);
    assert.equal(m.body.network, null);
    assert.deepEqual(m.body.unlinked, []);
    assert.equal(m.body.schools.length, 1, "gestor só enxerga a própria escola");
  });

  test("isolamento: outra escola/tenant não edita nem enxerga; coordenada fora do Brasil é recusada", async () => {
    assert.equal((await call("PUT", `/api/schools/${schoolNova}/geo`, "re", { enrollment: 10 })).status, 404);
    assert.equal((await call("PUT", `/api/schools/${schoolB}/geo`, "re", { enrollment: 10 })).status, 404);
    assert.equal((await call("PUT", `/api/schools/${schoolGL}/geo`, "re", { latitude: 48, longitude: 2 })).status, 400);
    assert.equal((await call("PUT", `/api/schools/${schoolGL}/geo`, "re", { latitude: -22 })).status, 400);
    const b = await call("GET", "/api/population/map", "boardB");
    assert.equal(b.status, 200);
    assert.equal(b.body.network, null);
    assert.ok(b.body.schools.every((s: any) => s.name === "Escola B1"));
    assert.equal((await call("GET", "/api/population/map", "esp")).status, 403);
  });

  test("aluno: código gerado, validação de nascimento e importação em lote só com ano/mês", async () => {
    const ok = await call("POST", "/api/students", "re", { schoolId: schoolGL, birthYear: 2017, birthMonth: 3 });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.match(ok.body.student.studentCode, /^ESCO-\d{4}-[A-Z2-9]{8}$/);
    assert.equal(ok.body.student.ageBracket, "06-09");
    assert.equal((await call("POST", "/api/students", "re", { schoolId: schoolGL, birthYear: 0, birthMonth: 3 })).status, 400);
    assert.equal((await call("POST", "/api/students", "re", { schoolId: schoolGL, birthYear: 2017 })).status, 400);
    assert.equal((await call("POST", "/api/students", "re", { schoolId: schoolB, birthYear: 2017, birthMonth: 3 })).status, 404);

    const pii = await call("POST", `/api/schools/${schoolGL}/students/bulk`, "re", { students: [{ birthYear: 2016, birthMonth: 5, nome: "X" }] });
    assert.equal(pii.status, 400);
    const bulk = await call("POST", `/api/schools/${schoolGL}/students/bulk`, "re", {
      students: [{ birthYear: 2016, birthMonth: 5 }, { birthYear: 2015, birthMonth: 11 }, { birthYear: 2018, birthMonth: 1 }],
    });
    assert.equal(bulk.status, 201, JSON.stringify(bulk.body));
    assert.equal(bulk.body.imported, 3);
    const bad = await call("POST", `/api/schools/${schoolGL}/students/bulk`, "re", { students: [{ birthYear: 2016, birthMonth: 5 }, { birthYear: 1800, birthMonth: 5 }] });
    assert.equal(bad.status, 400);
    const list = await call("GET", `/api/schools/${schoolGL}/students`, "re");
    assert.equal(list.body.students.length, 4, "lote com erro não importa nada");
  });
});
