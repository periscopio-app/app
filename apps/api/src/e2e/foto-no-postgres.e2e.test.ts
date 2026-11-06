/**
 * REG-017 — a foto de perfil fica no Postgres (user_avatars), não no Supabase, e continua lá depois de reiniciar a API.
 * Usa o armazenamento PADRÃO (sem o falso em memória do profile.e2e). Fotos sintéticas. Requer TEST_DATABASE_URL.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;

const EXIF = Buffer.from("Exif\0\0GPS-FICTICIO");
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, EXIF.length + 2]),
  EXIF,
  Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9]),
]);
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

describe("Foto de perfil no Postgres (REG-017)", { skip }, () => {
  let app: FastifyInstance;
  let dbx: typeof import("../db/client").db;
  let pool: typeof import("../db/client").pool;
  let shared: typeof import("@periscopio/shared");
  let buildApp: typeof import("../app").buildApp;
  const ids: Record<string, string> = {};

  const call = async (instance: FastifyInstance, method: string, path: string, email?: string, body?: unknown) => {
    const headers: Record<string, string> = { origin: "http://localhost:3000" };
    if (email) headers["x-test-email"] = email;
    if (body !== undefined) headers["content-type"] = "application/json";
    const r = await instance.inject({ method: method as never, url: path, headers, payload: body === undefined ? undefined : JSON.stringify(body) });
    let parsed: any = null;
    try { parsed = r.json(); } catch { parsed = r.body; }
    return { status: r.statusCode, body: parsed, raw: r.rawPayload, headers: r.headers };
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
    ({ db: dbx, pool } = await import("../db/client"));
    ({ buildApp } = await import("../app"));
    (await import("../services/avatar.service")).setAvatarStorage(null);

    const [t] = await dbx.insert(shared.tenants).values({ name: "Município F", municipalityCode: "F" }).returning();
    const [escola] = await dbx.insert(shared.schools).values({ tenantId: t.id, name: "Escola Foto", slug: "foto", status: "active" }).returning();
    for (const k of ["re", "md", "legado"]) {
      const [u] = await dbx.insert(shared.users).values({
        tenantId: t.id, schoolId: k === "md" ? null : escola.id, email: `${k}@teste.local`, name: `Pessoa ${k}`,
        role: k === "md" ? "md1" : "ppi", accessEnabled: true,
      }).returning();
      ids[k] = u.id;
      ids[`${k}_tenant`] = t.id;
    }
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await app?.close();
  });

  const perfil = async (instance: FastifyInstance, email: string) => (await call(instance, "GET", "/api/me/profile", email)).body.profile;

  test("enviar: a foto vai para user_avatars, sem os metadados (EXIF/GPS), e o endereço é relativo e opaco", async () => {
    const r = await call(app, "PUT", "/api/me/photo", "re@teste.local", { dataBase64: JPEG.toString("base64") });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.match(r.body.avatarUrl, new RegExp(`^/api/avatars/${UUID}$`), "relativo (passa pelo /api do site) e sem dado pessoal");
    assert.ok(!/re@|Pessoa|supabase/i.test(r.body.avatarUrl));

    const linha = (await pool.query("SELECT content, content_type, size_bytes FROM user_avatars WHERE user_id = $1", [ids.re])).rows;
    assert.equal(linha.length, 1);
    assert.equal(linha[0].content_type, "image/jpeg");
    assert.equal(linha[0].size_bytes, linha[0].content.length);
    assert.ok(!Buffer.from(linha[0].content).includes("GPS-FICTICIO"), "metadados de local foram removidos antes de gravar");
  });

  test("a foto é servida sem login, com cabeçalhos seguros e cache longo", async () => {
    const { avatarUrl } = await perfil(app, "re@teste.local");
    const r = await call(app, "GET", avatarUrl);
    assert.equal(r.status, 200);
    assert.equal(r.headers["content-type"], "image/jpeg");
    assert.match(String(r.headers["cache-control"]), /public.*immutable/);
    assert.equal(r.headers["x-content-type-options"], "nosniff");
    assert.match(String(r.headers["content-security-policy"]), /default-src 'none'/);
    assert.ok(Buffer.from(r.raw).length > 0 && !Buffer.from(r.raw).includes("GPS-FICTICIO"));
  });

  test("persiste: uma instância nova da API (reinício) continua mostrando a mesma foto", async () => {
    const antes = (await perfil(app, "re@teste.local")).avatarUrl;
    const outra = await buildApp();
    await outra.ready();
    try {
      assert.equal((await perfil(outra, "re@teste.local")).avatarUrl, antes);
      assert.equal((await call(outra, "GET", antes)).status, 200);
    } finally {
      await outra.close();
    }
  });

  test("trocar: a chave muda, a foto antiga deixa de existir e continua uma só linha por usuário", async () => {
    const velha = (await perfil(app, "re@teste.local")).avatarUrl;
    const r = await call(app, "PUT", "/api/me/photo", "re@teste.local", { dataBase64: JPEG.toString("base64") });
    assert.equal(r.status, 200);
    assert.notEqual(r.body.avatarUrl, velha);
    assert.equal((await call(app, "GET", velha)).status, 404, "a foto antiga não é mais servida");
    assert.equal((await call(app, "GET", r.body.avatarUrl)).status, 200);
    assert.equal((await pool.query("SELECT 1 FROM user_avatars WHERE user_id = $1", [ids.re])).rowCount, 1);
  });

  test("cada pessoa tem a própria foto: trocar a de uma não mexe na de outra", async () => {
    const md = await call(app, "PUT", "/api/me/photo", "md@teste.local", { dataBase64: JPEG.toString("base64") });
    assert.equal(md.status, 200);
    const re = await perfil(app, "re@teste.local");
    assert.notEqual(re.avatarUrl, md.body.avatarUrl);
    assert.equal((await pool.query("SELECT 1 FROM user_avatars")).rowCount, 2);
  });

  test("remover: apaga a linha e o endereço antigo passa a dar 404", async () => {
    const { avatarUrl } = await perfil(app, "re@teste.local");
    const r = await call(app, "DELETE", "/api/me/photo", "re@teste.local");
    assert.equal(r.status, 200);
    assert.equal(r.body.avatarUrl, null);
    assert.equal((await call(app, "GET", avatarUrl)).status, 404);
    assert.equal((await perfil(app, "re@teste.local")).avatarUrl, null);
    assert.equal((await pool.query("SELECT 1 FROM user_avatars WHERE user_id = $1", [ids.re])).rowCount, 0);
  });

  test("chave antiga do Supabase sem foto no Postgres vira 'sem foto', não imagem quebrada", async () => {
    const velhaChave = `avatars/${ids.legado_tenant}/${ids.legado}/00000000-0000-4000-8000-000000000001.jpg`;
    await pool.query("UPDATE users SET avatar_key = $2 WHERE id = $1", [ids.legado, velhaChave]);
    assert.equal((await perfil(app, "legado@teste.local")).avatarUrl, null);
  });

  test("chaves inexistentes ou malformadas: 404 curto, sem pista do que existe", async () => {
    for (const k of ["00000000-0000-4000-8000-0000000000ff", "nao-e-uuid", "..%2f..%2fetc", "1"]) {
      const r = await call(app, "GET", `/api/avatars/${k}`);
      assert.equal(r.status, 404, k);
      assert.deepEqual(r.body, { error: "Não encontrado." });
    }
  });
});
