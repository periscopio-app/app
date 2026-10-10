import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../app";

test("ViaCEP Route: rejeita CEP com formato incorreto (< 8 dígitos)", async () => {
  const app = await buildApp({ logger: false });
  const response = await app.inject({
    method: "GET",
    url: "/api/cep/123",
  });

  assert.equal(response.statusCode, 400);
  const body = JSON.parse(response.body);
  assert.ok(body.error.includes("CEP inválido"));
});

test("ViaCEP Route: consulta e normaliza CEP válido (01001-000)", async () => {
  const app = await buildApp({ logger: false });
  const response = await app.inject({
    method: "GET",
    url: "/api/cep/01001000",
  });

  if (response.statusCode === 200) {
    const body = JSON.parse(response.body);
    assert.equal(body.uf, "SP");
    assert.equal(body.localidade, "São Paulo");
    assert.equal(body.ibge, "3550308");
    assert.equal(body.bairro, "Sé");
  } else {
    assert.ok([502, 504].includes(response.statusCode));
  }
});

test("ViaCEP Route: retorna 404 para CEP não cadastrado nos Correios (99999-999)", async () => {
  const app = await buildApp({ logger: false });
  const response = await app.inject({
    method: "GET",
    url: "/api/cep/99999999",
  });

  if (response.statusCode === 404) {
    const body = JSON.parse(response.body);
    assert.ok(body.error.includes("não encontrado"));
  } else {
    assert.ok([502, 504].includes(response.statusCode));
  }
});
