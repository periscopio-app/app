import { test } from "node:test";
import assert from "node:assert";
import { buildApp } from "../app";

test("Support Route: GET /api/support/faq retorna catálogo de perguntas frequentes", async () => {
  const app = await buildApp({ logger: false });

  const res = await app.inject({
    method: "GET",
    url: "/api/support/faq",
  });

  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.payload);
  assert.ok(Array.isArray(body.faq), "faq deve ser um array");
  assert.ok(body.faq.length >= 4, "deve conter itens de FAQ");
  const first = body.faq[0];
  assert.ok(first.question);
  assert.ok(first.answer);
  assert.ok(first.category);
});

test("Support Route: POST /api/support/tickets registra dúvida de usuário", async () => {
  const app = await buildApp({ logger: false });

  const res = await app.inject({
    method: "POST",
    url: "/api/support/tickets",
    payload: {
      title: "Como aplicar escala ASQ?",
      description: "Gostaria de saber quais as faixas etárias cobertas pela escala ASQ na plataforma.",
      category: "duvida",
      userEmail: "professora.teste@escola.sp.gov.br",
      userName: "Professora Teste",
    },
  });

  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.payload);
  assert.strictEqual(body.success, true);
  assert.ok(body.ticketId, "deve retornar id do ticket gerado");
  assert.match(body.message, /sucesso/i);
});

test("Support Route: POST /api/support/tickets registra incidente técnico com telemetria", async () => {
  const app = await buildApp({ logger: false });

  const res = await app.inject({
    method: "POST",
    url: "/api/support/tickets",
    payload: {
      title: "Erro ao anexar relatório em PDF",
      description: "Ao clicar em fazer upload do PDF o botão permaneceu desabilitado sem aviso.",
      category: "erro_sistema",
      pageUrl: "http://localhost:3000/taruma/dashboard/medico",
      browserInfo: "Mozilla/5.0 Chrome/120.0.0.0",
      errorDetails: "TypeError: Failed to fetch at uploadAttachment (bundle.js:12)",
      userEmail: "medico.teste@escola.sp.gov.br",
    },
  });

  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.payload);
  assert.strictEqual(body.success, true);
  assert.ok(body.ticketId);
});

test("Support Route: POST /api/support/tickets rejeita chamado curto ou inválido", async () => {
  const app = await buildApp({ logger: false });

  // Título muito curto (< 3 chars)
  const res1 = await app.inject({
    method: "POST",
    url: "/api/support/tickets",
    payload: {
      title: "Oi",
      description: "Descrição com mais de dez caracteres para teste.",
      userEmail: "usuario@teste.com",
    },
  });
  assert.strictEqual(res1.statusCode, 400);

  // Descrição muito curta (< 10 chars)
  const res2 = await app.inject({
    method: "POST",
    url: "/api/support/tickets",
    payload: {
      title: "Título Válido",
      description: "Curto",
      userEmail: "usuario@teste.com",
    },
  });
  assert.strictEqual(res2.statusCode, 400);

  // E-mail inválido
  const res3 = await app.inject({
    method: "POST",
    url: "/api/support/tickets",
    payload: {
      title: "Título Válido",
      description: "Descrição detalhada com tamanho suficiente.",
      userEmail: "email_invalido",
    },
  });
  assert.strictEqual(res3.statusCode, 400);
});

test("Support Route: GET e PATCH /api/admin/support/tickets gerencia chamados para admin", async () => {
  const app = await buildApp({ logger: false });

  // Criar um chamado primeiro
  const createRes = await app.inject({
    method: "POST",
    url: "/api/support/tickets",
    payload: {
      title: "Chamado para gestão do admin",
      description: "Chamado de teste para verificar atualização e resposta do suporte.",
      category: "duvida",
      userEmail: "solicitante@teste.com.br",
    },
  });
  const { ticketId } = JSON.parse(createRes.payload);

  // Consulta sem perfil admin deve ser rejeitada
  const unauthRes = await app.inject({
    method: "GET",
    url: "/api/admin/support/tickets",
  });
  assert.strictEqual(unauthRes.statusCode, 401);

  // Consulta autenticada como Master Admin
  const adminRes = await app.inject({
    method: "GET",
    url: "/api/admin/support/tickets",
    headers: {
      "x-test-email": "bruno@oceanoazul.dev.br",
    },
  });
  assert.strictEqual(adminRes.statusCode, 200);
  const adminBody = JSON.parse(adminRes.payload);
  assert.ok(Array.isArray(adminBody.tickets));
  assert.ok(adminBody.metrics);
  assert.ok(typeof adminBody.metrics.total === "number");

  // Atualizar chamado como resolvido
  const patchRes = await app.inject({
    method: "PATCH",
    url: `/api/admin/support/tickets/${ticketId}`,
    headers: {
      "x-test-email": "bruno@oceanoazul.dev.br",
    },
    payload: {
      status: "resolvido",
      resolutionNotes: "Dúvida sanada: o fluxo está documentado na Central de Ajuda.",
    },
  });
  assert.strictEqual(patchRes.statusCode, 200);
  const patchBody = JSON.parse(patchRes.payload);
  assert.strictEqual(patchBody.success, true);
  assert.strictEqual(patchBody.ticket.status, "resolvido");
  assert.strictEqual(patchBody.ticket.resolutionNotes, "Dúvida sanada: o fluxo está documentado na Central de Ajuda.");
});

test("Support Route: POST /api/support/ask-rag responde dúvidas com inteligência semântica", async () => {
  const app = await buildApp({ logger: false });

  // Pergunta sobre FOGAP
  const resFogap = await app.inject({
    method: "POST",
    url: "/api/support/ask-rag",
    payload: {
      question: "Como funciona o envio do formulário FOGAP pelo RE?",
    },
  });
  assert.strictEqual(resFogap.statusCode, 200);
  const bodyFogap = JSON.parse(resFogap.payload);
  assert.strictEqual(bodyFogap.success, true);
  assert.ok(bodyFogap.answer.includes("FOGAP"));
  assert.strictEqual(bodyFogap.canOpenTicket, true);

  // Pergunta curta rejeitada
  const resShort = await app.inject({
    method: "POST",
    url: "/api/support/ask-rag",
    payload: {
      question: "oi",
    },
  });
  assert.strictEqual(resShort.statusCode, 400);
});

