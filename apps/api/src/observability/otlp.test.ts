import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOtlpPayload, type OtlpContext } from "./otlp";
import { LATENCY_BUCKETS_MS } from "./metrics";

const NOW = 1_800_000_000_000;
const nb = LATENCY_BUCKETS_MS.length + 1;
const cumulative = (perBucket: number[]) => perBucket.reduce<number[]>((acc, v, i) => [...acc, v + (acc[i - 1] ?? 0)], []);

const ctx = (over: Partial<OtlpContext> = {}): OtlpContext => ({
  nowMs: NOW,
  raw: {
    startedAt: NOW - 90_000,
    routes: [{ method: "GET", route: "/api/x", count: 10, s2xx: 8, s3xx: 0, s4xx: 1, s5xx: 1, sumMs: 700, buckets: cumulative([6, 2, 1, 0, 1, 0, 0, 0, 0, 0, 0]) }],
    counters: [["email_send_failures", 3]],
  },
  memory: { rss: 1000, heapUsed: 500 },
  cpuSeconds: 12.5,
  lagMs: 4.2,
  commit: "abc1234",
  environment: "production",
  instanceId: "inst-1",
  ...over,
});

const byName = (p: ReturnType<typeof buildOtlpPayload>) =>
  Object.fromEntries((p.resourceMetrics[0].scopeMetrics[0].metrics as { name: string }[]).map((m) => [m.name, m as any]));

describe("buildOtlpPayload", () => {
  it("usa os nomes que o painel consulta, sem sufixos de unidade", () => {
    const m = byName(buildOtlpPayload(ctx()));
    for (const n of [
      "periscopio_uptime_seconds", "periscopio_build_info", "periscopio_process_start_time_seconds",
      "periscopio_process_resident_memory_bytes", "periscopio_nodejs_heap_used_bytes", "periscopio_nodejs_eventloop_lag_p99_ms",
      "periscopio_process_cpu_seconds", "periscopio_http_requests", "periscopio_http_request_duration_ms", "periscopio_events",
    ]) assert.ok(m[n], `falta ${n}`);
    assert.equal(m.periscopio_http_requests.sum.isMonotonic, true);
    assert.equal(m.periscopio_http_requests.sum.aggregationTemporality, 2);
    assert.equal(m.periscopio_uptime_seconds.unit, undefined);
  });

  it("separa contadores por classe de status e leva a versão como rótulo", () => {
    const m = byName(buildOtlpPayload(ctx()));
    const classes = m.periscopio_http_requests.sum.dataPoints.map((d: any) => d.attributes.find((a: any) => a.key === "status_class").value.stringValue);
    assert.deepEqual(classes, ["2xx", "4xx", "5xx"]);
    const commit = m.periscopio_build_info.gauge.dataPoints[0].attributes.find((a: any) => a.key === "commit").value.stringValue;
    assert.equal(commit, "abc1234");
  });

  it("converte o histograma de cumulativo para contagem por faixa e usa inteiros como texto", () => {
    const h = byName(buildOtlpPayload(ctx())).periscopio_http_request_duration_ms.histogram.dataPoints[0];
    assert.deepEqual(h.bucketCounts, ["6", "2", "1", "0", "1", "0", "0", "0", "0", "0", "0"]);
    assert.equal(h.bucketCounts.length, nb);
    assert.deepEqual(h.explicitBounds, [...LATENCY_BUCKETS_MS]);
    assert.equal(h.count, "10");
    assert.equal(h.sum, 700);
    assert.equal(h.timeUnixNano, String(NOW * 1_000_000));
    assert.equal(h.startTimeUnixNano, String((NOW - 90_000) * 1_000_000));
  });

  it("sem tráfego não emite séries vazias de requisições", () => {
    const m = byName(buildOtlpPayload(ctx({ raw: { startedAt: NOW - 1000, routes: [], counters: [] } })));
    assert.equal(m.periscopio_http_requests, undefined);
    assert.equal(m.periscopio_http_request_duration_ms, undefined);
    assert.equal(m.periscopio_events, undefined);
    assert.ok(m.periscopio_uptime_seconds);
  });

  it("não coloca dado pessoal nem segredo: só rotas-padrão, método, classe e nome de evento", () => {
    const txt = JSON.stringify(buildOtlpPayload(ctx()));
    assert.ok(!/studentCode|email@|cpf|token/i.test(txt));
  });
});
