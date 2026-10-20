/**
 * "Meu painel": perfil próprio, foto e métricas por papel.
 * A foto usa um armazenamento em memória (nenhuma chamada real ao Supabase).
 * Requer TEST_DATABASE_URL (Postgres local de teste).
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;

// JPEG mínimo com EXIF "GPS-FICTICIO"
const EXIF = Buffer.from("Exif\0\0GPS-FICTICIO");
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, EXIF.length + 2]),
  EXIF,
  Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9]),
]);

describe("Meu painel (E2E)", { skip }, () => {
  let app: FastifyInstance;
  let dbx: typeof import("../db/client").db;
  let shared: typeof import("@periscopio/shared");
  let av: typeof import("../services/avatar.service");
  const ids: Record<string, string> = {};
  const objetos = new Map<string, { body: Buffer; contentType: string }>();
  let falhaNoStorage = false;

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

    shared = await import("@periscopio/shared");
    ({ db: dbx } = await import("../db/client"));
    av = await import("../services/avatar.service");
    const { buildApp } = await import("../app");

    av.setAvatarStorage({
      async put(key, body, contentType) {
        if (falhaNoStorage) throw new Error("storage fora do ar");
        objetos.set(key, { body, contentType });
      },
      async remove(key) { objetos.delete(key); },
      publicUrl: (key) => `https://storage.teste/avatars-publicos/${key}`,
    });

    const [t] = await dbx.insert(shared.tenants).values({ name: "Município P", municipalityCode: "P" }).returning();
    const [t2] = await dbx.insert(shared.tenants).values({ name: "Município Q", municipalityCode: "Q" }).returning();
    const [escola] = await dbx.insert(shared.schools).values({ tenantId: t.id, name: "Escola Girassol", slug: "girassol", status: "active" }).returning();

    const pessoas = [
      { key: "re", role: "ppi", tenant: t.id, school: escola.id, specialty: "psicopedagogia", phone: null as string | null, cpf: "12345678909" },
      { key: "md", role: "md1", tenant: t.id, school: null, specialty: "medicina", phone: null, cpf: null },
      { key: "esp", role: "specialist", tenant: t.id, school: null, specialty: "fonoaudiologia", phone: null, cpf: null },
      { key: "prof", role: "teacher", tenant: t.id, school: escola.id, specialty: null, phone: null, cpf: null },
      { key: "dir", role: "school_manager", tenant: t.id, school: escola.id, specialty: null, phone: null, cpf: null },
      { key: "board", role: "board", tenant: t.id, school: null, specialty: null, phone: null, cpf: null },
      { key: "pesq", role: "researcher", tenant: t.id, school: null, specialty: null, phone: null, cpf: null },
      { key: "admin", role: "admin_platform", tenant: t.id, school: null, specialty: null, phone: null, cpf: null },
      { key: "outro", role: "ppi", tenant: t2.id, school: null, specialty: null, phone: null, cpf: null },
    ];
    for (const p of pessoas) {
      const [u] = await dbx.insert(shared.users).values({
        tenantId: p.tenant, schoolId: p.school, email: `${p.key}@teste.local`, name: `Pessoa ${p.key}`, role: p.role,
        specialty: p.specialty, cpf: p.cpf, classCode: p.key === "md" ? "CRM-SP 000000" : null, accessEnabled: true,
      }).returning();
      ids[p.key] = u.id;
    }

    // dados sintéticos para as métricas (nenhum dado real)
    const [st] = await dbx.insert(shared.students).values({ tenantId: t.id, schoolId: escola.id, studentCode: "T-PAINEL-0001", birthYear: 2017, birthMonth: 4, ageBracket: "06-09" }).returning();
    const [caso] = await dbx.insert(shared.cases).values({ tenantId: t.id, studentId: st.id, status: "triagem", journeyState: "delegado" }).returning();
    await dbx.insert(shared.caseSummaries).values({ tenantId: t.id, caseId: caso.id, specialty: "fonoaudiologia", assignedProfessionalId: ids.esp, status: "pendente" });
    await dbx.insert(shared.caseTransitions).values({ tenantId: t.id, caseId: caso.id, fromState: "revisao_medica", toState: "delegado", actorId: ids.md, actorRole: "md1", reason: "Delegado em teste" });
    await dbx.insert(shared.teacherObservations).values({ tenantId: t.id, studentId: st.id, teacherId: ids.prof, kind: "flash", domain: "social", payload: {} });

    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    av?.setAvatarStorage(null);
    await app?.close();
  });

  test("sem sessão: 401 em todas as rotas", async () => {
    for (const [m, p] of [["GET", "/api/me/profile"], ["PATCH", "/api/me/profile"], ["PUT", "/api/me/photo"], ["DELETE", "/api/me/photo"], ["POST", "/api/me/deletion-request"], ["GET", "/api/me/metrics"]]) {
      const r = await call(m!, p!, undefined, m === "GET" ? undefined : {});
      assert.equal(r.status, 401, `${m} ${p}`);
    }
  });

  test("ler o perfil: dados próprios, CPF mascarado, sem foto e com a lista do que é editável", async () => {
    const r = await call("GET", "/api/me/profile", "re@teste.local");
    assert.equal(r.status, 200);
    const p = r.body.profile;
    assert.equal(p.email, "re@teste.local");
    assert.equal(p.roleLabel, "Responsável Escolar (RE)");
    assert.equal(p.school.name, "Escola Girassol");
    assert.equal(p.cpfMasked, "***.***.***-09");
    assert.equal(p.avatarUrl, null);
    assert.deepEqual(p.editable, ["name", "phone", "bio"]);
    assert.ok(!JSON.stringify(r.body).includes("12345678909"), "CPF completo não pode vazar");
  });

  test("editar: nome, telefone e apresentação; apagar com vazio; trilha guarda só os nomes dos campos", async () => {
    const r = await call("PATCH", "/api/me/profile", "re@teste.local", { name: "  Maria Souza ", phone: "(11) 91234-5678", bio: "Psicopedagoga institucional" });
    assert.equal(r.status, 200);
    assert.equal(r.body.profile.name, "Maria Souza");
    assert.equal(r.body.profile.phone, "11912345678");
    assert.equal(r.body.profile.bio, "Psicopedagoga institucional");

    const apagar = await call("PATCH", "/api/me/profile", "re@teste.local", { phone: "", bio: null });
    assert.equal(apagar.status, 200);
    assert.equal(apagar.body.profile.phone, null);
    assert.equal(apagar.body.profile.bio, null);

    const { auditLogs } = shared;
    const { eq, and } = await import("drizzle-orm");
    const logs = await dbx.select().from(auditLogs).where(and(eq(auditLogs.actorId, ids.re), eq(auditLogs.action, "profile.updated")));
    assert.equal(logs.length, 2);
    const texto = JSON.stringify(logs.map((l) => l.payload));
    assert.ok(!texto.includes("Maria") && !texto.includes("11912345678"), "a trilha não guarda valores");
    assert.deepEqual(logs.map((l) => (l.payload as any).fields).flat().sort(), ["bio", "bio", "name", "phone", "phone"]);
  });

  test("não dá para alterar papel, e-mail, CPF, escola nem registro profissional", async () => {
    for (const campo of ["role", "email", "cpf", "schoolId", "classCode", "specialty", "tenantId"]) {
      const r = await call("PATCH", "/api/me/profile", "re@teste.local", { [campo]: "admin_platform" });
      assert.equal(r.status, 400, campo);
    }
    const p = (await call("GET", "/api/me/profile", "re@teste.local")).body.profile;
    assert.equal(p.role, "ppi");
    assert.equal(p.email, "re@teste.local");
  });

  test("validações: telefone inválido, nome curto, corpo vazio", async () => {
    assert.equal((await call("PATCH", "/api/me/profile", "re@teste.local", { phone: "123" })).status, 400);
    assert.equal((await call("PATCH", "/api/me/profile", "re@teste.local", { name: "A" })).status, 400);
    assert.equal((await call("PATCH", "/api/me/profile", "re@teste.local", {})).status, 400);
  });

  test("foto: envia, remove metadados de local, guarda chave opaca e devolve o link", async () => {
    const r = await call("PUT", "/api/me/photo", "md@teste.local", { dataBase64: JPEG.toString("base64") });
    assert.equal(r.status, 200);
    assert.match(r.body.avatarUrl, /^https:\/\/storage\.teste\/avatars-publicos\/avatars\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/);
    assert.equal(objetos.size, 1);
    const salvo = [...objetos.values()][0]!;
    assert.equal(salvo.contentType, "image/jpeg");
    assert.ok(!salvo.body.includes(Buffer.from("GPS-FICTICIO")), "EXIF/GPS não pode ir para o armazenamento");

    const perfil = (await call("GET", "/api/me/profile", "md@teste.local")).body.profile;
    assert.equal(perfil.avatarUrl, r.body.avatarUrl);
    assert.ok(!r.body.avatarUrl.includes("md@") && !r.body.avatarUrl.toLowerCase().includes("pessoa"), "sem dado pessoal no endereço");
  });

  test("trocar a foto apaga a anterior; remover apaga o arquivo e limpa o perfil", async () => {
    const antes = [...objetos.keys()][0]!;
    const nova = await call("PUT", "/api/me/photo", "md@teste.local", { dataBase64: `data:image/jpeg;base64,${JPEG.toString("base64")}` });
    assert.equal(nova.status, 200);
    assert.equal(objetos.size, 1);
    assert.ok(!objetos.has(antes), "foto antiga deve ser removida");

    const del = await call("DELETE", "/api/me/photo", "md@teste.local");
    assert.equal(del.status, 200);
    assert.equal(del.body.avatarUrl, null);
    assert.equal(objetos.size, 0);
    assert.equal((await call("GET", "/api/me/profile", "md@teste.local")).body.profile.avatarUrl, null);
    // remover de novo é inofensivo
    assert.equal((await call("DELETE", "/api/me/photo", "md@teste.local")).status, 200);
  });

  test("foto inválida é recusada sem tocar o armazenamento", async () => {
    const tamanho = objetos.size;
    const svg = await call("PUT", "/api/me/photo", "md@teste.local", { dataBase64: Buffer.from("<svg onload=alert(1)/>").toString("base64") });
    assert.equal(svg.status, 422);
    assert.equal((await call("PUT", "/api/me/photo", "md@teste.local", {})).status, 400);
    const grande = await call("PUT", "/api/me/photo", "md@teste.local", { dataBase64: Buffer.concat([JPEG, Buffer.alloc(2 * 1024 * 1024 + 10)]).toString("base64") });
    assert.equal(grande.status, 413);
    assert.equal(objetos.size, tamanho);
  });

  test("armazenamento fora do ar: 503 com mensagem clara e perfil intacto", async () => {
    falhaNoStorage = true;
    const r = await call("PUT", "/api/me/photo", "md@teste.local", { dataBase64: JPEG.toString("base64") });
    falhaNoStorage = false;
    assert.equal(r.status, 503);
    assert.match(r.body.error, /armazenamento de fotos/i);
    assert.equal((await call("GET", "/api/me/profile", "md@teste.local")).body.profile.avatarUrl, null);
  });

  test("cada pessoa só mexe na própria foto (a foto de uma não aparece nem some na de outra)", async () => {
    await call("PUT", "/api/me/photo", "md@teste.local", { dataBase64: JPEG.toString("base64") });
    await call("PUT", "/api/me/photo", "esp@teste.local", { dataBase64: JPEG.toString("base64") });
    assert.equal(objetos.size, 2);
    await call("DELETE", "/api/me/photo", "md@teste.local");
    assert.equal(objetos.size, 1);
    assert.ok((await call("GET", "/api/me/profile", "esp@teste.local")).body.profile.avatarUrl);
    await call("DELETE", "/api/me/photo", "esp@teste.local");
  });

  test("pedido de exclusão da conta: registra uma vez só e aparece no perfil", async () => {
    const a = await call("POST", "/api/me/deletion-request", "prof@teste.local", {});
    assert.equal(a.status, 200);
    assert.equal(a.body.alreadyOpen, false);
    const b = await call("POST", "/api/me/deletion-request", "prof@teste.local", {});
    assert.equal(b.body.alreadyOpen, true);
    assert.equal(b.body.protocol, a.body.protocol);
    const perfil = (await call("GET", "/api/me/profile", "prof@teste.local")).body.profile;
    assert.equal(perfil.deletionRequest.protocol, a.body.protocol);
    // nada foi apagado: a conta continua ativa até a governança tratar o pedido
    assert.equal((await call("GET", "/api/me/metrics", "prof@teste.local")).status, 200);
  });

  test("métricas por papel: títulos, números sintéticos e nenhuma identificação de aluno", async () => {
    const quem: Record<string, string> = {};
    for (const k of ["re", "md", "esp", "prof", "dir", "board", "pesq", "admin"]) {
      const r = await call("GET", "/api/me/metrics", `${k}@teste.local`);
      assert.equal(r.status, 200, k);
      quem[k] = JSON.stringify(r.body);
      const m = r.body.metrics;
      assert.ok(m.titulo && m.aviso && Array.isArray(m.cartoes), k);
      assert.ok(m.cartoes.some((c: any) => c.chave === "avisos_nao_lidos"), `${k} tem avisos`);
      assert.ok(!quem[k].includes("T-PAINEL-0001"), `${k}: código do aluno não pode aparecer`);
      assert.ok(!/diagn|risco|escore|score/i.test(m.cartoes.map((c: any) => c.rotulo).join(" ")), `${k}: sem linguagem clínica`);
    }
    const cartao = (k: string, chave: string) => JSON.parse(quem[k]!).metrics.cartoes.find((c: any) => c.chave === chave);
    assert.equal(cartao("esp", "secoes_pendentes").valor, 1);
    assert.equal(cartao("md", "em_especialistas").valor, 1);
    assert.equal(cartao("md", "delegados_30d").valor, 1);
    assert.equal(cartao("prof", "obs_total").valor, 1);
    assert.equal(cartao("re", "em_andamento").valor, 1);
    // gestão escolar: grupo de 1 caso fica oculto (< 5)
    const gestao = cartao("dir", "com_especialistas");
    assert.equal(gestao.valor, null);
    assert.equal(gestao.oculto, true);
  });

  test("outro município não enxerga nada do primeiro nas métricas", async () => {
    const r = await call("GET", "/api/me/metrics", "outro@teste.local");
    assert.equal(r.status, 200);
    const cartoes = r.body.metrics.cartoes as { chave: string; valor: number | null }[];
    for (const c of cartoes.filter((x) => x.chave !== "avisos_nao_lidos")) assert.ok(!c.valor, `${c.chave} deveria ser zero/nulo`);
  });
});
