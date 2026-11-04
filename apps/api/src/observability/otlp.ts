import { LATENCY_BUCKETS_MS } from "./metrics";

/**
 * Monta o corpo OTLP/HTTP em JSON com as mesmas séries de /metrics, para a API enviar sozinha ao Grafana Cloud.
 * Nomes e unidades seguem a conversão do Grafana (OTLP para Prometheus): unidade vazia evita sufixos extras,
 * contadores ganham `_total` e histogramas viram `_bucket`, `_sum` e `_count`, então as consultas do painel valem.
 * Inteiros de 64 bits vão como texto, como manda o OTLP em JSON. Sem dado pessoal em rótulo nenhum.
 */

type Attrs = Record<string, string>;
type Raw = {
  startedAt: number;
  routes: { method: string; route: string; count: number; s2xx: number; s3xx: number; s4xx: number; s5xx: number; sumMs: number; buckets: number[] }[];
  counters: [string, number][];
  ai?: { feature: string; provider: string; model: string; ok: number; failed: number; inputTokens: number; outputTokens: number }[];
};

export interface OtlpContext {
  nowMs: number;
  raw: Raw;
  memory: { rss: number; heapUsed: number };
  cpuSeconds: number;
  lagMs: number;
  commit: string;
  environment: string;
  instanceId: string;
  serviceName?: string;
}

const attrList = (a: Attrs) => Object.entries(a).map(([key, v]) => ({ key, value: { stringValue: v } }));
const nano = (ms: number) => String(Math.round(ms) * 1_000_000);

export function buildOtlpPayload(c: OtlpContext) {
  const t = nano(c.nowMs);
  const start = nano(c.raw.startedAt);

  const gauge = (name: string, value: number, attrs: Attrs = {}) => ({
    name,
    gauge: { dataPoints: [{ asDouble: value, timeUnixNano: t, attributes: attrList(attrs) }] },
  });
  const counter = (name: string, points: { value: number; attrs: Attrs }[]) => ({
    name,
    sum: {
      aggregationTemporality: 2,
      isMonotonic: true,
      dataPoints: points.map((p) => ({ asDouble: p.value, startTimeUnixNano: start, timeUnixNano: t, attributes: attrList(p.attrs) })),
    },
  });

  const metrics: unknown[] = [
    gauge("periscopio_uptime_seconds", Math.round((c.nowMs - c.raw.startedAt) / 1000)),
    gauge("periscopio_build_info", 1, { commit: c.commit, environment: c.environment }),
    gauge("periscopio_process_start_time_seconds", Math.round(c.raw.startedAt / 1000)),
    gauge("periscopio_process_resident_memory_bytes", c.memory.rss),
    gauge("periscopio_nodejs_heap_used_bytes", c.memory.heapUsed),
    gauge("periscopio_nodejs_eventloop_lag_p99_ms", c.lagMs),
    counter("periscopio_process_cpu_seconds", [{ value: c.cpuSeconds, attrs: {} }]),
  ];

  const req: { value: number; attrs: Attrs }[] = [];
  for (const r of c.raw.routes) {
    for (const [cls, n] of [["2xx", r.s2xx], ["3xx", r.s3xx], ["4xx", r.s4xx], ["5xx", r.s5xx]] as const) {
      if (n) req.push({ value: n, attrs: { method: r.method, route: r.route, status_class: cls } });
    }
  }
  if (req.length) metrics.push(counter("periscopio_http_requests", req));

  const hist = c.raw.routes.filter((r) => r.count > 0).map((r) => {
    // buckets guarda contagem cumulativa; o OTLP quer a contagem de cada faixa
    const perBucket = r.buckets.map((v, i) => v - (i === 0 ? 0 : r.buckets[i - 1]));
    return {
      attributes: attrList({ method: r.method, route: r.route }),
      startTimeUnixNano: start,
      timeUnixNano: t,
      count: String(r.count),
      sum: r.sumMs,
      bucketCounts: perBucket.map(String),
      explicitBounds: [...LATENCY_BUCKETS_MS],
    };
  });
  if (hist.length) metrics.push({ name: "periscopio_http_request_duration_ms", histogram: { aggregationTemporality: 2, dataPoints: hist } });

  if (c.raw.counters.length) metrics.push(counter("periscopio_events", c.raw.counters.map(([event, value]) => ({ value, attrs: { event } }))));

  const ai = c.raw.ai ?? [];
  if (ai.length) {
    const tokens: { value: number; attrs: Attrs }[] = [];
    const calls: { value: number; attrs: Attrs }[] = [];
    for (const a of ai) {
      const base = { feature: a.feature, provider: a.provider, model: a.model };
      tokens.push({ value: a.inputTokens, attrs: { ...base, direction: "input" } }, { value: a.outputTokens, attrs: { ...base, direction: "output" } });
      calls.push({ value: a.ok, attrs: { ...base, status: "ok" } }, { value: a.failed, attrs: { ...base, status: "error" } });
    }
    metrics.push(counter("periscopio_ai_tokens", tokens), counter("periscopio_ai_requests", calls));
  }

  return {
    resourceMetrics: [
      {
        resource: { attributes: attrList({ "service.name": c.serviceName || "periscopio-api", "service.instance.id": c.instanceId, "deployment.environment": c.environment }) },
        scopeMetrics: [{ scope: { name: "periscopio.observability" }, metrics }],
      },
    ],
  };
}
