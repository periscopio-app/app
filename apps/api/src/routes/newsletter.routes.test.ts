import { test } from "node:test";
import assert from "node:assert";
import { buildApp } from "../app";

test("Newsletter Route: POST /api/newsletter/subscribe inscreve novo leitor", async () => {
  const app = await buildApp({ logger: false });
  const testEmail = `leitor.${Date.now()}@escola.sp.gov.br`;

  const res = await app.inject({
    method: "POST",
    url: "/api/newsletter/subscribe",
    payload: {
      email: testEmail,
      name: "Professora Maria",
      role: "professor",
    },
  });

  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.payload);
  assert.strictEqual(body.success, true);
  assert.match(body.message, /sucesso/i);

  // Inscrição repetida com o mesmo e-mail é idempotente
  const dupRes = await app.inject({
    method: "POST",
    url: "/api/newsletter/subscribe",
    payload: {
      email: testEmail,
      name: "Professora Maria",
    },
  });
  assert.strictEqual(dupRes.statusCode, 200);
  const dupBody = JSON.parse(dupRes.payload);
  assert.match(dupBody.message, /já está inscrito/i);
});

test("Newsletter Route: POST /api/newsletter/unsubscribe realiza opt-out LGPD", async () => {
  const app = await buildApp({ logger: false });
  const testEmail = `optout.${Date.now()}@escola.sp.gov.br`;

  // Inscrever
  await app.inject({
    method: "POST",
    url: "/api/newsletter/subscribe",
    payload: { email: testEmail },
  });

  // Cancelar
  const unsubRes = await app.inject({
    method: "POST",
    url: "/api/newsletter/unsubscribe",
    payload: { email: testEmail },
  });

  assert.strictEqual(unsubRes.statusCode, 200);
  const unsubBody = JSON.parse(unsubRes.payload);
  assert.strictEqual(unsubBody.success, true);
  assert.match(unsubBody.message, /cancelada com sucesso/i);
});

test("Newsletter Route: POST /api/newsletter/subscribe rejeita e-mail inválido", async () => {
  const app = await buildApp({ logger: false });

  const res = await app.inject({
    method: "POST",
    url: "/api/newsletter/subscribe",
    payload: {
      email: "invalido@",
    },
  });

  assert.strictEqual(res.statusCode, 400);
});

test("Newsletter Route: GET /api/newsletter/issues retorna boletins publicados", async () => {
  const app = await buildApp({ logger: false });

  const res = await app.inject({
    method: "GET",
    url: "/api/newsletter/issues",
  });

  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.payload);
  assert.ok(Array.isArray(body.issues));
});

test("Newsletter Route: POST /api/admin/newsletter/issues cria nova edição para admin", async () => {
  const app = await buildApp({ logger: false });

  // Sem autenticação -> 401
  const unauth = await app.inject({
    method: "POST",
    url: "/api/admin/newsletter/issues",
    payload: {
      title: "Título Válido do Boletim",
      content: "Conteúdo completo com fundamentação científica e pedagógica para teste.",
    },
  });
  assert.strictEqual(unauth.statusCode, 401);

  // Com autenticação Master Admin
  const authRes = await app.inject({
    method: "POST",
    url: "/api/admin/newsletter/issues",
    headers: {
      "x-test-email": "bruno@oceanoazul.dev.br",
    },
    payload: {
      title: "Boletim Científico: Triagem Escolar e Protocolo TEA",
      summary: "Diretrizes sobre o uso das escalas ATA e ASQ.",
      content: "Texto completo do artigo abordando as melhores práticas multiprofissionais no ambiente escolar.",
      category: "saude_mental",
      status: "publicado",
    },
  });

  assert.strictEqual(authRes.statusCode, 200);
  const body = JSON.parse(authRes.payload);
  assert.strictEqual(body.success, true);
  assert.ok(body.issue.id);
  assert.strictEqual(body.issue.title, "Boletim Científico: Triagem Escolar e Protocolo TEA");
});
