/**
 * Laudos em PDF (Bloco 5) — E2E com dados sintéticos.
 * Prova: RE e médico enviam e abrem; especialista, professor, gestor e Board não;
 * só PDF de verdade; outro município e outra escola não alcançam o caso.
 * Requer TEST_DATABASE_URL.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

describe("Laudos em PDF/JPG/PNG (E2E)", { skip }, () => {
  let app: FastifyInstance;
  let dbx: typeof import("../db/client").db;
  let shared: typeof import("@periscopio/shared");
  let svc: typeof import("../services/attachment.service");
  const objetos = new Map<string, Buffer>();
  let caseId = "";
  let attId = "";

  const call = async (method: string, path: string, who?: string, body?: unknown) => {
    const headers: Record<string, string> = { origin: "http://localhost:3000" };
    if (who) headers["x-test-email"] = `${who}@teste.local`.toLowerCase();
    if (body !== undefined) headers["content-type"] = "application/json";
    const r = await app.inject({ method: method as never, url: path, headers, payload: body === undefined ? undefined : JSON.stringify(body) });
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
    ({ db: dbx } = await import("../db/client"));
    svc = await import("../services/attachment.service");
    svc.setAttachmentStorage({
      async put(key, body) { objetos.set(key, body); },
      async get(key) { const o = objetos.get(key); if (!o) throw new Error("não existe"); return o; },
      async remove(key) { objetos.delete(key); },
    });
    const { buildApp } = await import("../app");
    app = await buildApp();
    await app.ready();

    const [t] = await dbx.insert(shared.tenants).values({ name: "Município A", municipalityCode: "A1" }).returning();
    const [t2] = await dbx.insert(shared.tenants).values({ name: "Município B", municipalityCode: "B1" }).returning();
    const [e1] = await dbx.insert(shared.schools).values({ tenantId: t.id, name: "Escola 1", slug: "e1", status: "active" }).returning();
    const [e2] = await dbx.insert(shared.schools).values({ tenantId: t.id, name: "Escola 2", slug: "e2", status: "active" }).returning();
    const [e3] = await dbx.insert(shared.schools).values({ tenantId: t2.id, name: "Escola 3", slug: "e3", status: "active" }).returning();

    const mk = async (key: string, tid: string, sid: string | null, role: string) => {
      await dbx.insert(shared.users).values({ tenantId: tid, schoolId: sid, email: `${key}@teste.local`.toLowerCase(), name: `Pessoa ${key}`, role, specialty: role === "ppi" ? "psicopedagogia" : role === "specialist" ? "fonoaudiologia" : null, accessEnabled: true });
    };
    await mk("re", t.id, e1.id, "ppi");
    await mk("reOutra", t.id, e2.id, "ppi");
    await mk("md", t.id, null, "md1");
    await mk("esp", t.id, null, "specialist");
    await mk("prof", t.id, e1.id, "teacher");
    await mk("gestor", t.id, e1.id, "school_manager");
    await mk("board", t.id, null, "board");
    await mk("mdOutro", t2.id, null, "md1");
    await mk("reOutro", t2.id, e3.id, "ppi");

    const [st] = await dbx.insert(shared.students).values({ tenantId: t.id, schoolId: e1.id, studentCode: "ANX-0001", birthYear: 2018, birthMonth: 3, ageBracket: "06-09", grade: "3º ano" }).returning();
    const [c] = await dbx.insert(shared.cases).values({ tenantId: t.id, studentId: st.id, status: "triagem", journeyState: "revisao_medica" as never }).returning();
    caseId = c.id;
  });

  after(async () => {
    svc?.setAttachmentStorage(null);
    await app?.close();
    const { db } = await import("../db/client");
    await (db as any).$client.end();
  });

  const enviar = (who: string, bytes: Buffer = PDF, fileName = "laudo.pdf") =>
    call("POST", `/api/cases/${caseId}/attachments`, who, { fileName, dataBase64: bytes.toString("base64") });

  test("RE do caso envia PDF; o arquivo vai ao armazenamento e a chave não carrega o nome", async () => {
    const r = await enviar("re", PDF, "Laudo_Joao_Silva.pdf");
    assert.equal(r.status, 200, JSON.stringify(r.body));
    attId = r.body.attachment.id;
    assert.equal(objetos.size, 1);
    const key = [...objetos.keys()][0];
    assert.doesNotMatch(key, /joao|silva/i);
  });

  test("médico também envia e lista os dois laudos", async () => {
    assert.equal((await enviar("md")).status, 200);
    const r = await call("GET", `/api/cases/${caseId}/attachments`, "md");
    assert.equal(r.status, 200);
    assert.equal(r.body.attachments.length, 2);
  });

  test("RE e médico abrem o PDF; o conteúdo volta igual e sem cache", async () => {
    for (const who of ["re", "md"]) {
      const r = await call("GET", `/api/cases/${caseId}/attachments/${attId}/file`, who);
      assert.equal(r.status, 200, who);
      assert.equal(r.headers["content-type"], "application/pdf");
      assert.match(String(r.headers["cache-control"]), /no-store/);
      assert.ok(Buffer.from(r.raw).equals(PDF));
    }
  });

  test("especialista, professor, gestor e Board não enviam, não listam e não abrem", async () => {
    for (const who of ["esp", "prof", "gestor", "board"]) {
      assert.equal((await enviar(who)).status, 403, `${who} envio`);
      assert.equal((await call("GET", `/api/cases/${caseId}/attachments`, who)).status, 403, `${who} lista`);
      assert.equal((await call("GET", `/api/cases/${caseId}/attachments/${attId}/file`, who)).status, 403, `${who} abrir`);
    }
    assert.equal((await call("GET", `/api/cases/${caseId}/attachments`)).status, 401);
  });

  test("outro município e outra escola recebem 404 (sem vazar que o caso existe)", async () => {
    for (const who of ["mdOutro", "reOutro", "reOutra"]) {
      const rr = await call("GET", `/api/cases/${caseId}/attachments`, who); assert.equal(rr.status, 404, who + " " + JSON.stringify(rr.body));
      assert.equal((await enviar(who)).status, 404, `${who} envio`);
      assert.equal((await call("GET", `/api/cases/${caseId}/attachments/${attId}/file`, who)).status, 404, `${who} abrir`);
    }
  });

  test("foto do celular (JPG/PNG) é aceita e volta com o tipo certo", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const a = await enviar("re", png, "laudo-foto.png");
    const b = await enviar("md", jpg, "foto.jpg");
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(b.status, 200, JSON.stringify(b.body));
    assert.equal((await call("GET", `/api/cases/${caseId}/attachments/${a.body.attachment.id}/file`, "md")).headers["content-type"], "image/png");
    assert.equal((await call("GET", `/api/cases/${caseId}/attachments/${b.body.attachment.id}/file`, "re")).headers["content-type"], "image/jpeg");
    assert.equal((await call("GET", `/api/cases/${caseId}/attachments/${a.body.attachment.id}/file`, "esp")).status, 403);
    for (const k of [...objetos.keys()].filter((k) => !k.endsWith(".pdf"))) objetos.delete(k);
    await dbx.delete(shared.clinicalAttachments).where(eq(shared.clinicalAttachments.mimeType, "image/png"));
    await dbx.delete(shared.clinicalAttachments).where(eq(shared.clinicalAttachments.mimeType, "image/jpeg"));
  });

  test("só PDF/JPG/PNG de verdade: GIF, texto disfarçado, vazio e acima de 10 MB são recusados", async () => {
    const gif = Buffer.from("GIF89a\x01\x00\x01\x00");
    assert.equal((await enviar("re", gif, "animado.png")).status, 400);
    assert.equal((await enviar("re", Buffer.from("texto qualquer"), "falso.pdf")).status, 400);
    assert.equal((await call("POST", `/api/cases/${caseId}/attachments`, "re", { fileName: "v.pdf", dataBase64: "" })).status, 400);
    const grande = Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]);
    assert.equal((await enviar("re", grande, "grande.pdf")).status, 413);
    assert.equal((await call("GET", `/api/cases/${caseId}/attachments`, "re")).body.attachments.length, 2, "nada novo foi gravado");
  });

  test("se o armazenamento cair, devolve 503 e não deixa registro órfão", async () => {
    svc.setAttachmentStorage({
      async put() { throw new Error("fora do ar"); },
      async get() { throw new Error("fora do ar"); },
      async remove() {},
    });
    assert.equal((await enviar("re")).status, 503);
    assert.equal((await call("GET", `/api/cases/${caseId}/attachments/${attId}/file`, "md")).status, 503);
    svc.setAttachmentStorage({
      async put(key, body) { objetos.set(key, body); },
      async get(key) { const o = objetos.get(key); if (!o) throw new Error("x"); return o; },
      async remove(key) { objetos.delete(key); },
    });
    assert.equal((await call("GET", `/api/cases/${caseId}/attachments`, "re")).body.attachments.length, 2);
  });
});
