import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../app";
import { clearCepCache } from "../services/cep.service";

const realFetch = globalThis.fetch;
let calls: string[] = [];

function mock(handler: (url: string) => Response | Promise<Response>) {
  calls = [];
  globalThis.fetch = (async (input: any) => {
    const url = String(input);
    calls.push(new URL(url).hostname);
    return handler(url);
  }) as typeof fetch;
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const BRASIL = { cep: "01001000", state: "SP", city: "São Paulo", neighborhood: "Sé", street: "Praça da Sé" };
const VIACEP = {
  cep: "01001-000", logradouro: "Praça da Sé", complemento: "lado ímpar", bairro: "Sé",
  localidade: "São Paulo", uf: "SP", ibge: "3550308", ddd: "11",
};

beforeEach(() => clearCepCache());
afterEach(() => {
  globalThis.fetch = realFetch;
});

async function get(cep: string) {
  const app = await buildApp({ logger: false });
  const res = await app.inject({ method: "GET", url: `/api/cep/${cep}` });
  return { status: res.statusCode, body: JSON.parse(res.body) };
}

test("CEP: rejeita formato incorreto sem consultar ninguém", async () => {
  mock(() => json({}));
  const r = await get("123");
  assert.equal(r.status, 400);
  assert.ok(r.body.error.includes("CEP inválido"));
  assert.equal(calls.length, 0);
});

test("CEP: usa a BrasilAPI primeiro e normaliza o formato", async () => {
  mock(() => json(BRASIL));
  const r = await get("01001-000");
  assert.equal(r.status, 200);
  assert.deepEqual(calls, ["brasilapi.com.br"]);
  assert.equal(r.body.cep, "01001-000");
  assert.equal(r.body.uf, "SP");
  assert.equal(r.body.localidade, "São Paulo");
  assert.equal(r.body.bairro, "Sé");
  assert.equal(r.body.logradouro, "Praça da Sé");
});

test("CEP: cai para o ViaCEP quando a BrasilAPI está fora (5xx)", async () => {
  mock((u) => (u.includes("brasilapi") ? json({ message: "x" }, 503) : json(VIACEP)));
  const r = await get("01001000");
  assert.equal(r.status, 200);
  assert.deepEqual(calls, ["brasilapi.com.br", "viacep.com.br"]);
  assert.equal(r.body.ibge, "3550308");
  assert.equal(r.body.ddd, "11");
});

test("CEP: cai para o OpenCEP quando BrasilAPI e ViaCEP falham (rede e 429)", async () => {
  mock((u) => {
    if (u.includes("brasilapi")) throw new Error("ECONNRESET");
    if (u.includes("viacep")) return json({}, 429);
    return json({ cep: "01001-000", logradouro: "Praça da Sé", bairro: "Sé", localidade: "São Paulo", uf: "sp", ibge: "3550308" });
  });
  const r = await get("01001000");
  assert.equal(r.status, 200);
  assert.deepEqual(calls, ["brasilapi.com.br", "viacep.com.br", "opencep.com"]);
  assert.equal(r.body.uf, "SP");
});

test("CEP: 404 da BrasilAPI é definitivo e não consulta os demais", async () => {
  mock(() => json({ message: "CEP não encontrado" }, 404));
  const r = await get("99999999");
  assert.equal(r.status, 404);
  assert.ok(r.body.error.includes("não encontrado"));
  assert.deepEqual(calls, ["brasilapi.com.br"]);
});

test("CEP: erro:true do ViaCEP vira 404", async () => {
  mock((u) => (u.includes("brasilapi") ? json({}, 500) : json({ erro: "true" })));
  const r = await get("99999999");
  assert.equal(r.status, 404);
});

test("CEP: todos os provedores fora devolve 502 com mensagem genérica", async () => {
  mock(() => {
    throw new Error("getaddrinfo ENOTFOUND secret-internal-host");
  });
  const r = await get("01001000");
  assert.equal(r.status, 502);
  assert.ok(!JSON.stringify(r.body).includes("ENOTFOUND"));
  assert.deepEqual(calls, ["brasilapi.com.br", "viacep.com.br", "opencep.com"]);
});

test("CEP: resposta inválida de um provedor passa para o próximo", async () => {
  mock((u) => (u.includes("brasilapi") ? new Response("<html>", { status: 200 }) : json(VIACEP)));
  const r = await get("01001000");
  assert.equal(r.status, 200);
  assert.deepEqual(calls, ["brasilapi.com.br", "viacep.com.br"]);
});

test("CEP: segunda consulta do mesmo CEP vem do cache", async () => {
  mock(() => json(BRASIL));
  await get("01001000");
  const again = await get("01001000");
  assert.equal(again.status, 200);
  assert.equal(calls.length, 1);
});
