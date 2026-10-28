/**
 * Nome do aluno para a equipe do caso (E2E). Dados sintéticos. Requer TEST_DATABASE_URL.
 * Garante: caixinha desligada = ninguém recebe o nome; ligada = só quem atende o caso; gestão/Board/pesquisa/
 * administração nunca; especialista só nos casos em que tem seção; outro município/escola nunca; auditoria sem o nome.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { nomeCurto } from "../services/student-name.service";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;

describe("nomeCurto", () => {
  test("primeiro nome + inicial do último sobrenome", () => {
    assert.equal(nomeCurto("João da Silva"), "João S.");
    assert.equal(nomeCurto("  maria   de souza  santos "), "maria S.");
    assert.equal(nomeCurto("Ana"), "Ana");
    assert.equal(nomeCurto("   "), null);
    assert.equal(nomeCurto(null), null);
    assert.equal(nomeCurto("Éder Álvares"), "Éder Á.");
  });
});

describe("Nome do aluno na tela do caso (E2E)", { skip }, () => {
  let app: FastifyInstance;
  let dbx: typeof import("../db/client").db;
  let shared: typeof import("@periscopio/shared");
  let priv: typeof import("../services/privilege.service");
  const NOME = "Enzo Ficticio Teste";
  let casoA = "";
  let casoB = "";
  let escolaA = "";

  const call = async (method: string, path: string, email?: string, body?: unknown) => {
    const headers: Record<string, string> = { origin: "http://localhost:3000" };
    if (email) headers["x-test-email"] = (email.includes("@") ? email : `${email}@teste.local`).toLowerCase();
    if (body !== undefined) headers["content-type"] = "application/json";
    const r = await app.inject({ method: method as never, url: path, headers, payload: body === undefined ? undefined : JSON.stringify(body) });
    let parsed: any = null;
    try { parsed = r.json(); } catch { parsed = r.body; }
    return { status: r.statusCode, body: parsed };
  };

  const ligar = async (role: string, allowed: boolean) => {
    await dbx.insert(shared.privilegeRoleGrants).values({ role, capability: "student.name.view", allowed })
      .onConflictDoUpdate({ target: [shared.privilegeRoleGrants.scopeTenantId, shared.privilegeRoleGrants.role, shared.privilegeRoleGrants.capability], set: { allowed } });
    priv.invalidatePrivilegeCache();
  };
  const limparCaixinhas = async () => {
    await dbx.delete(shared.privilegeRoleGrants);
    priv.invalidatePrivilegeCache();
  };

  before(async () => {
    const { assertSafeTestDatabase, resetTestDatabase } = await import("../testing/test-db");
    assertSafeTestDatabase(url);
    await resetTestDatabase(url!);
    process.env.DATABASE_URL = url!;
    process.env.NODE_ENV = "test";
    process.env.BETTER_AUTH_SECRET = "segredo-de-teste-com-mais-de-32-caracteres!!";
    process.env.IDENTITY_VAULT_KEY = "chave-sintetica-teste-com-mais-de-32-bytes!!";
    process.env.BETTER_AUTH_URL = "http://localhost:3001";
    process.env.CORS_ORIGINS = "http://localhost:3000";

    shared = await import("@periscopio/shared");
    ({ db: dbx } = await import("../db/client"));
    priv = await import("../services/privilege.service");
    const { buildApp } = await import("../app");
    app = await buildApp();
    await app.ready();

    const [t] = await dbx.insert(shared.tenants).values({ name: "Município N", municipalityCode: "N" }).returning();
    const [t2] = await dbx.insert(shared.tenants).values({ name: "Município O", municipalityCode: "O" }).returning();
    const [eA] = await dbx.insert(shared.schools).values({ tenantId: t.id, name: "Escola Oceano Azul", slug: "oceano", status: "active" }).returning();
    const [eB] = await dbx.insert(shared.schools).values({ tenantId: t.id, name: "Escola Girassol", slug: "girassol", status: "active" }).returning();
    escolaA = eA.id;

    const pessoas = [
      { key: "reA", role: "ppi", tenant: t.id, school: eA.id, specialty: "psicopedagogia" },
      { key: "reB", role: "ppi", tenant: t.id, school: eB.id, specialty: "psicopedagogia" },
      { key: "profA", role: "teacher", tenant: t.id, school: eA.id, specialty: null },
      { key: "md", role: "md1", tenant: t.id, school: null, specialty: "medicina" },
      { key: "mdOutro", role: "md1", tenant: t2.id, school: null, specialty: "medicina" },
      { key: "fono", role: "specialist", tenant: t.id, school: null, specialty: "fonoaudiologia" },
      { key: "psico", role: "specialist", tenant: t.id, school: null, specialty: "psicologia" },
      { key: "dir", role: "school_manager", tenant: t.id, school: eA.id, specialty: null },
      { key: "municipal", role: "municipal_manager", tenant: t.id, school: null, specialty: null },
      { key: "board", role: "board", tenant: t.id, school: null, specialty: null },
      { key: "pesq", role: "researcher", tenant: t.id, school: null, specialty: null },
      { key: "admin", role: "admin_platform", tenant: t.id, school: null, specialty: null },
    ];
    const ids: Record<string, string> = {};
    for (const p of pessoas) {
      const [u] = await dbx.insert(shared.users).values({
        tenantId: p.tenant, schoolId: p.school, email: `${p.key}@teste.local`.toLowerCase(), name: `Pessoa ${p.key}`, role: p.role,
        specialty: p.specialty, accessEnabled: true,
      }).returning();
      ids[p.key] = u.id;
    }

    const { encryptText } = await import("../services/identity-crypto.service");
    const [stA] = await dbx.insert(shared.students).values({ tenantId: t.id, schoolId: eA.id, studentCode: "T-NOME-0001", birthYear: 2018, birthMonth: 3, ageBracket: "06-09", grade: "3º ano" }).returning();
    const [stB] = await dbx.insert(shared.students).values({ tenantId: t.id, schoolId: eB.id, studentCode: "T-NOME-0002", birthYear: 2018, birthMonth: 5, ageBracket: "06-09" }).returning();
    await dbx.insert(shared.studentIdentityVault).values({ tenantId: t.id, studentId: stA.id, encryptedFullName: encryptText(NOME) });
    // aluno B não tem nome no cofre
    const [cA] = await dbx.insert(shared.cases).values({ tenantId: t.id, studentId: stA.id, status: "triagem", journeyState: "delegado" }).returning();
    const [cB] = await dbx.insert(shared.cases).values({ tenantId: t.id, studentId: stB.id, status: "triagem", journeyState: "revisao_medica" }).returning();
    casoA = cA.id;
    casoB = cB.id;
    // só a fono tem seção delegada no caso A
    await dbx.insert(shared.caseSummaries).values({ tenantId: t.id, caseId: cA.id, specialty: "fonoaudiologia", assignedProfessionalId: ids.fono, status: "pendente" });
  });

  after(async () => {
    await app?.close();
    const { db } = await import("../db/client");
    await (db as any).$client.end();
  });

  test("com a caixinha desligada (padrão) ninguém recebe o nome, nem na fila", async () => {
    await limparCaixinhas();
    for (const who of ["reA", "md", "fono", "profA"]) {
      const r = await call("GET", `/api/cases/${casoA}/student-identity`, who);
      assert.equal(r.status, 200, who);
      assert.deepEqual(r.body, { enabled: false, fullName: null, label: null }, who);
    }
    const fila = await call("GET", "/api/cases", "md");
    assert.equal(fila.status, 200);
    assert.ok(fila.body.cases.every((c: any) => c.studentLabel === null));
    assert.ok(!JSON.stringify(fila.body).includes("Enzo"));
  });

  test("ligada para RE, médico e especialista: recebem o nome só onde fazem parte do caso", async () => {
    await limparCaixinhas();
    for (const role of ["ppi", "md1", "specialist"]) await ligar(role, true);

    const re = await call("GET", `/api/cases/${casoA}/student-identity`, "reA");
    assert.deepEqual(re.body, { enabled: true, fullName: NOME, label: "Enzo T." });

    const md = await call("GET", `/api/cases/${casoA}/student-identity`, "md");
    assert.equal(md.body.enabled, true);
    assert.equal(md.body.fullName, NOME);

    // especialista com seção delegada vê; sem seção não vê
    assert.equal((await call("GET", `/api/cases/${casoA}/student-identity`, "fono")).body.fullName, NOME);
    assert.equal((await call("GET", `/api/cases/${casoA}/student-identity`, "psico")).body.enabled, false);

    // RE de outra escola nem enxerga o caso
    assert.equal((await call("GET", `/api/cases/${casoA}/student-identity`, "reB")).status, 404);
    // médico de outro município também não
    assert.equal((await call("GET", `/api/cases/${casoA}/student-identity`, "mdOutro")).status, 404);

    // aluno sem nome no cofre: segue o fluxo antigo
    assert.deepEqual((await call("GET", `/api/cases/${casoB}/student-identity`, "md")).body, { enabled: false, fullName: null, label: null });
  });

  test("gestão, Board, pesquisa, direção e administração NUNCA recebem o nome, mesmo com a caixinha marcada", async () => {
    await limparCaixinhas();
    for (const role of ["ppi", "md1", "specialist", "school_manager", "municipal_manager", "board", "researcher", "admin_platform"]) {
      await ligar(role, true);
    }
    for (const who of ["dir", "municipal", "board", "pesq", "admin"]) {
      const r = await call("GET", `/api/cases/${casoA}/student-identity`, who);
      assert.ok(!JSON.stringify(r.body).includes("Enzo"), `${who} não pode receber o nome`);
      assert.notEqual(r.body?.enabled, true, who);
    }
    const lista = await call("GET", "/api/cases", "board");
    assert.ok(!JSON.stringify(lista.body).includes("Enzo"));
  });

  test("a fila mostra o nome curto para a equipe e grava auditoria sem o nome", async () => {
    await limparCaixinhas();
    await ligar("md1", true);
    const fila = await call("GET", "/api/cases", "md");
    const a = fila.body.cases.find((c: any) => c.id === casoA);
    const b = fila.body.cases.find((c: any) => c.id === casoB);
    assert.equal(a.studentLabel, "Enzo T.");
    assert.equal(b.studentLabel, null);
    assert.equal(a.tenantId, undefined, "não vaza campos internos");
    assert.ok(!JSON.stringify(fila.body).includes("Enzo Ficticio"), "o nome completo não sai na fila");

    await call("GET", `/api/cases/${casoA}/student-identity`, "md");
    const logs = await dbx.select().from(shared.auditLogs);
    const lido = logs.filter((l) => l.action === "student.identity_viewed");
    const listado = logs.filter((l) => l.action === "student.identity_listed");
    assert.ok(lido.length >= 1 && listado.length >= 1);
    assert.equal((lido[0].payload as any).studentCode, "T-NOME-0001");
    assert.equal((lido[0].payload as any).caseId, casoA);
    assert.ok(!JSON.stringify(logs).includes("Enzo"), "a auditoria não guarda o nome");
  });

  test("exceção da pessoa vale por cima do perfil (negar para um médico específico)", async () => {
    await limparCaixinhas();
    await ligar("md1", true);
    const [u] = await dbx.select().from(shared.users).where((await import("drizzle-orm")).eq(shared.users.email, "md@teste.local"));
    await dbx.insert(shared.privilegeUserGrants).values({ userId: u.id, capability: "student.name.view", allowed: false });
    priv.invalidatePrivilegeCache();
    assert.equal((await call("GET", `/api/cases/${casoA}/student-identity`, "md")).body.enabled, false);
    await dbx.delete(shared.privilegeUserGrants);
    priv.invalidatePrivilegeCache();
  });

  test("cadastro do aluno com o nome: vai cifrado para o cofre e o nome não aparece na resposta nem na auditoria", async () => {
    await limparCaixinhas();
    const r = await call("POST", "/api/students", "reA", { schoolId: escolaA, birthYear: 2018, birthMonth: 7, grade: "2º ano", fullName: "Bia Sintetica Teste" });
    assert.equal(r.status, 201);
    assert.ok(!JSON.stringify(r.body).includes("Bia"));
    const { eq } = await import("drizzle-orm");
    const [cofre] = await dbx.select().from(shared.studentIdentityVault).where(eq(shared.studentIdentityVault.studentId, r.body.student.id));
    assert.ok(cofre && !cofre.encryptedFullName.includes("Bia"), "guardado cifrado");
    const { decryptText } = await import("../services/identity-crypto.service");
    assert.equal(decryptText(cofre.encryptedFullName), "Bia Sintetica Teste");
    const logs = await dbx.select().from(shared.auditLogs);
    assert.ok(!JSON.stringify(logs).includes("Bia"));
    assert.ok(logs.some((l) => l.action === "student.vault_updated" && (l.payload as any).via === "cadastro"));

    // sem nome continua funcionando; nome curto demais é recusado
    assert.equal((await call("POST", "/api/students", "reA", { schoolId: escolaA, birthYear: 2018, birthMonth: 8 })).status, 201);
    assert.equal((await call("POST", "/api/students", "reA", { schoolId: escolaA, birthYear: 2018, birthMonth: 8, fullName: "A" })).status, 400);
    assert.equal((await call("POST", "/api/students", "reA", { schoolId: escolaA, birthYear: 2018, birthMonth: 8, fullName: 123 })).status, 400);
  });
});
