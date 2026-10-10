import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../app";

test("Swagger / Docs Route: GET /docs retorna a interface do Swagger UI", async () => {
  const app = await buildApp({ logger: false });
  const response = await app.inject({
    method: "GET",
    url: "/docs",
  });

  // Swagger UI pode redirecionar para /docs/ ou retornar 200
  assert.ok([200, 302, 301].includes(response.statusCode));
});

test("Swagger / Docs Route: GET /docs/json retorna especificação OpenAPI válida", async () => {
  const app = await buildApp({ logger: false });
  const response = await app.inject({
    method: "GET",
    url: "/docs/json",
  });

  assert.equal(response.statusCode, 200);
  const spec = JSON.parse(response.body);
  assert.equal(spec.openapi, "3.0.3");
  assert.ok(spec.info.title.includes("Periscópio"));
  assert.ok(spec.paths["/api/cep/{cep}"]);
  assert.ok(spec.paths["/api/rnds/status"]);
  assert.ok(spec.paths["/api/intersectoral/monitoring/sla-90d"]);
});
