import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../app";

test("GET /api/locations/states retorna os 27 estados do Brasil a partir de cidade.json", async () => {
  const app = await buildApp({ logger: false });
  const response = await app.inject({
    method: "GET",
    url: "/api/locations/states",
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.total, 27);
  assert.equal(Array.isArray(body.estados), true);

  const sp = body.estados.find((e: any) => e.sigla === "SP");
  assert.ok(sp);
  assert.equal(sp.nome, "São Paulo");
  assert.equal(sp.totalCidades, 645);
});

test("GET /api/locations/cities/SP retorna as cidades de São Paulo incluindo Tarumã", async () => {
  const app = await buildApp({ logger: false });
  const response = await app.inject({
    method: "GET",
    url: "/api/locations/cities/SP",
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.sigla, "SP");
  assert.equal(body.totalCidades, 645);
  assert.ok(body.cidades.includes("Tarumã"));
  assert.ok(body.cidades.includes("São Paulo"));
});

test("GET /api/locations/cities?uf=PR retorna as cidades do Paraná", async () => {
  const app = await buildApp({ logger: false });
  const response = await app.inject({
    method: "GET",
    url: "/api/locations/cities?uf=PR",
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.sigla, "PR");
  assert.equal(body.totalCidades, 399);
  assert.ok(body.cidades.includes("Curitiba"));
});
