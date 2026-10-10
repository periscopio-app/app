import { test } from "node:test";
import assert from "node:assert";
import { buildApp } from "../app";
import { RETENTION_POLICIES } from "./lgpd.routes";

test("LGPD Route: POST /api/lgpd/requests aceita solicitação de titular válida", async () => {
  const app = await buildApp({ logger: false });

  const res = await app.inject({
    method: "POST",
    url: "/api/lgpd/requests",
    payload: {
      requesterEmail: "responsavel@exemplo.com.br",
      requesterName: "Maria da Silva",
      kind: "access",
      details: "Solicito confirmação do tratamento dos dados do meu filho.",
    },
  });

  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.payload);
  assert.strictEqual(body.success, true);
  assert.ok(body.protocol, "deve retornar protocolo de atendimento");
  assert.strictEqual(body.legalDeadlineDays, 15, "prazo legal deve ser de 15 dias úteis (art. 19)");
  assert.match(body.message, /protocolo/i);
});

test("LGPD Route: POST /api/lgpd/requests rejeita tipo de requisição inválido", async () => {
  const app = await buildApp({ logger: false });

  const res = await app.inject({
    method: "POST",
    url: "/api/lgpd/requests",
    payload: {
      requesterEmail: "responsavel@exemplo.com.br",
      kind: "tipo_inexistente",
    },
  });

  assert.strictEqual(res.statusCode, 400);
  const body = JSON.parse(res.payload);
  assert.ok(body.error || body.message, "deve retornar mensagem de erro para tipo inválido");
});

test("LGPD Route: GET /api/lgpd/retention/policies expõe matriz de retenção conforme legislação", async () => {
  const app = await buildApp({ logger: false });

  const res = await app.inject({
    method: "GET",
    url: "/api/lgpd/retention/policies",
  });

  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.payload);
  assert.strictEqual(body.version, "1.0");
  assert.ok(Array.isArray(body.policies));
  assert.ok(body.policies.length >= 4);

  const prontuarioPolicy = body.policies.find((p: any) => p.category.includes("Prontuários"));
  assert.ok(prontuarioPolicy);
  assert.strictEqual(prontuarioPolicy.retentionPeriodYears, 20, "Prontuário deve ser guardado por 20 anos");
  assert.match(prontuarioPolicy.legalBasis, /13.787/);
});

test("Consent Route: GET /api/consent/terms/latest retorna termo de consentimento com versão", async () => {
  const app = await buildApp({ logger: false });

  const res = await app.inject({
    method: "GET",
    url: "/api/consent/terms/latest?type=responsavel_legal",
    headers: {
      "x-test-email": "bruno@oceanoazul.dev.br",
    },
  });

  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.payload);
  assert.ok(body.term);
  assert.strictEqual(body.term.version, "v1.0");
  assert.match(body.term.title, /Termo de Consentimento/i);
  assert.match(body.term.content, /LGPD/i);
});
