import { test } from "node:test";
import assert from "node:assert";
import { buildApp } from "../app";

test("Identity Vault Route: GET /api/students/:studentId/vault/status requer autenticação", async () => {
  const app = await buildApp({ logger: false });

  const res = await app.inject({
    method: "GET",
    url: "/api/students/00000000-0000-0000-0000-000000000000/vault/status",
  });

  assert.strictEqual(res.statusCode, 401);
});

test("Identity Vault Route: GET /api/students/:studentId/vault/status retorna 404 para aluno inexistente", async () => {
  const app = await buildApp({ logger: false });

  const res = await app.inject({
    method: "GET",
    url: "/api/students/00000000-0000-0000-0000-000000000000/vault/status",
    headers: {
      "x-test-email": "bruno@oceanoazul.dev.br",
    },
  });

  assert.strictEqual(res.statusCode, 404);
});

test("Identity Vault Route: GET /api/admin/vault/audit-logs protege auditoria contra não-admins", async () => {
  const app = await buildApp({ logger: false });

  // Sem autenticação -> 401
  const unauth = await app.inject({
    method: "GET",
    url: "/api/admin/vault/audit-logs",
  });
  assert.strictEqual(unauth.statusCode, 401);

  // Com autenticação de Master Admin -> 200 e lista de logs
  const adminRes = await app.inject({
    method: "GET",
    url: "/api/admin/vault/audit-logs",
    headers: {
      "x-test-email": "bruno@oceanoazul.dev.br",
    },
  });

  assert.strictEqual(adminRes.statusCode, 200);
  const body = JSON.parse(adminRes.payload);
  assert.ok(Array.isArray(body.logs), "deve retornar array de logs de auditoria do cofre");
});
