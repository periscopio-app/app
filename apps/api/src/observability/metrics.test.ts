import test from "node:test";
import assert from "node:assert/strict";
import { incr, observeRequest, recordError, resetMetrics, snapshot, toPrometheus } from "./metrics";
import { genRequestId, stripQuery } from "./http";
import { isLimited } from "../security/rate-limit";

test("percentis saem do histograma e erros 5xx entram na taxa", () => {
  resetMetrics();
  for (let i = 0; i < 90; i++) observeRequest("GET", "/api/x", 200, 20);
  for (let i = 0; i < 8; i++) observeRequest("GET", "/api/x", 200, 400);
  observeRequest("GET", "/api/x", 500, 3000);
  observeRequest("GET", "/api/x", 404, 5);
  const s = snapshot();
  assert.equal(s.http.total, 100);
  assert.equal(s.http.errors5xx, 1);
  assert.equal(s.http.errors4xx, 1);
  assert.equal(s.http.errorRate5xx, 0.01);
  assert.equal(s.http.p50Ms, 25);
  assert.equal(s.http.p95Ms, 500);
  assert.equal(s.routes[0].route, "/api/x");
});

test("lista de erros recentes tem teto e guarda a mais nova primeiro", () => {
  resetMetrics();
  for (let i = 0; i < 60; i++) {
    recordError({ at: "t", requestId: `req-${i}`, method: "GET", route: "/r", status: 500, errorClass: "Error", message: "x".repeat(1000) });
  }
  const s = snapshot();
  assert.equal(s.recentErrors.length, 50);
  assert.equal(s.recentErrors[0].requestId, "req-59");
  assert.equal(s.recentErrors[0].message!.length, 300);
  assert.equal(s.counters.http_5xx_total, 60);
});

test("formato Prometheus traz requisições, latência e eventos", () => {
  resetMetrics();
  observeRequest("POST", "/api/y", 201, 12);
  incr("email_send_failures");
  const t = toPrometheus();
  assert.match(t, /periscopio_http_requests_total\{method="POST",route="\/api\/y",status_class="2xx"\} 1/);
  assert.match(t, /periscopio_http_request_duration_ms_bucket\{method="POST",route="\/api\/y",le="25"\} 1/);
  assert.match(t, /periscopio_events_total\{event="email_send_failures"\} 1/);
});

test("o log não leva a query string (token de acesso) e o request id é validado", () => {
  assert.equal(stripQuery("/api/access/validate?token=segredo.assinatura"), "/api/access/validate");
  assert.equal(stripQuery(undefined), "");
  assert.equal(genRequestId({ headers: { "x-request-id": "abc-12345678" } }), "abc-12345678");
  const gerado = genRequestId({ headers: { "x-request-id": "<script>" } });
  assert.match(gerado, /^[0-9a-f-]{36}$/);
});

test("limite por janela: bloqueia depois do teto e libera quando a janela passa", () => {
  const t0 = 1_000_000;
  assert.equal(isLimited("k", 2, 1000, t0), false);
  assert.equal(isLimited("k", 2, 1000, t0 + 1), false);
  assert.equal(isLimited("k", 2, 1000, t0 + 2), true);
  assert.equal(isLimited("outra", 2, 1000, t0 + 2), false);
  assert.equal(isLimited("k", 2, 1000, t0 + 1500), false);
});
