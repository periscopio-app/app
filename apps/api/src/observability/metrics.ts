/**
 * Métricas em memória (por instância) e registro dos últimos erros 5xx.
 * Sem dado pessoal: guarda rota (padrão, não a URL), método, status, tempo e a classe do erro.
 * Reinicia quando a instância reinicia; para histórico longo, raspar /metrics com um coletor.
 */

import { monitorEventLoopDelay } from "node:perf_hooks";

export const LATENCY_BUCKETS_MS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000] as const;
const MAX_ROUTES = 300;

/** Atraso do event loop entre duas leituras de /metrics. O timer interno não segura o processo vivo. */
const loopDelay = monitorEventLoopDelay({ resolution: 20 });
loopDelay.enable();
const MAX_RECENT_ERRORS = 50;

interface RouteStat {
  method: string;
  route: string;
  count: number;
  s2xx: number;
  s3xx: number;
  s4xx: number;
  s5xx: number;
  sumMs: number;
  maxMs: number;
  /** contagem cumulativa por limite superior (le), mais um último item para "+Inf" */
  buckets: number[];
}

export interface RecentError {
  at: string;
  requestId: string;
  method: string;
  route: string;
  status: number;
  errorClass: string | null;
  message: string | null;
}

let startedAt = Date.now();
const routes = new Map<string, RouteStat>();
const counters = new Map<string, number>();
const recentErrors: RecentError[] = [];

/** Uso de IA por recurso, provedor e modelo (somente contagens: nunca o texto enviado nem o recebido). */
interface AiStat { feature: string; provider: string; model: string; ok: number; failed: number; inputTokens: number; outputTokens: number }
const aiStats = new Map<string, AiStat>();
const AI_MAX_KEYS = 100;
const aiLabel = (v: string) => v.replace(/[^\w.:/\- ]/g, "").slice(0, 80) || "desconhecido";

export function recordAiUsage(feature: string, items: { provider: string; model: string; inputTokens: number; outputTokens: number; ok: boolean }[]): void {
  for (const it of items) {
    const key = `${aiLabel(feature)}|${aiLabel(it.provider)}|${aiLabel(it.model)}`;
    let st = aiStats.get(key);
    if (!st) {
      if (aiStats.size >= AI_MAX_KEYS) continue;
      st = { feature: aiLabel(feature), provider: aiLabel(it.provider), model: aiLabel(it.model), ok: 0, failed: 0, inputTokens: 0, outputTokens: 0 };
      aiStats.set(key, st);
    }
    if (it.ok) st.ok++; else st.failed++;
    st.inputTokens += Math.max(0, Math.round(it.inputTokens) || 0);
    st.outputTokens += Math.max(0, Math.round(it.outputTokens) || 0);
  }
}

export function resetMetrics(): void {
  startedAt = Date.now();
  routes.clear();
  counters.clear();
  recentErrors.length = 0;
  aiStats.clear();
}

export function incr(name: string, by = 1): void {
  counters.set(name, (counters.get(name) ?? 0) + by);
}

export function observeRequest(method: string, route: string, status: number, ms: number): void {
  let key = `${method} ${route}`;
  if (!routes.has(key) && routes.size >= MAX_ROUTES) key = `${method} (outras rotas)`;
  let s = routes.get(key);
  if (!s) {
    s = {
      method,
      route: key.slice(method.length + 1),
      count: 0, s2xx: 0, s3xx: 0, s4xx: 0, s5xx: 0, sumMs: 0, maxMs: 0,
      buckets: new Array(LATENCY_BUCKETS_MS.length + 1).fill(0),
    };
    routes.set(key, s);
  }
  s.count++;
  if (status >= 500) s.s5xx++;
  else if (status >= 400) s.s4xx++;
  else if (status >= 300) s.s3xx++;
  else s.s2xx++;
  s.sumMs += ms;
  if (ms > s.maxMs) s.maxMs = ms;
  let i = LATENCY_BUCKETS_MS.findIndex((b) => ms <= b);
  if (i === -1) i = LATENCY_BUCKETS_MS.length;
  for (let j = i; j < s.buckets.length; j++) s.buckets[j]++;
}

export function recordError(e: RecentError): void {
  incr("http_5xx_total");
  recentErrors.unshift({ ...e, message: e.message ? e.message.slice(0, 300) : null });
  if (recentErrors.length > MAX_RECENT_ERRORS) recentErrors.length = MAX_RECENT_ERRORS;
}

/** Estima o percentil pelo limite superior do balde (aproximação conservadora). */
function percentile(buckets: number[], total: number, p: number, maxMs: number): number | null {
  if (total === 0) return null;
  const target = Math.ceil(total * p);
  const i = buckets.findIndex((c) => c >= target);
  if (i === -1 || i >= LATENCY_BUCKETS_MS.length) return Math.round(maxMs);
  return LATENCY_BUCKETS_MS[i];
}

export function snapshot() {
  const all = [...routes.values()];
  const total = all.reduce((a, r) => a + r.count, 0);
  const merged = new Array(LATENCY_BUCKETS_MS.length + 1).fill(0);
  let maxMs = 0, sumMs = 0, s4 = 0, s5 = 0;
  for (const r of all) {
    r.buckets.forEach((c, i) => (merged[i] += c));
    maxMs = Math.max(maxMs, r.maxMs);
    sumMs += r.sumMs;
    s4 += r.s4xx;
    s5 += r.s5xx;
  }
  const byRoute = all
    .map((r) => ({
      method: r.method,
      route: r.route,
      count: r.count,
      errors5xx: r.s5xx,
      errors4xx: r.s4xx,
      avgMs: r.count ? Math.round(r.sumMs / r.count) : 0,
      p95Ms: percentile(r.buckets, r.count, 0.95, r.maxMs),
      maxMs: Math.round(r.maxMs),
    }))
    .sort((a, b) => b.errors5xx - a.errors5xx || (b.p95Ms ?? 0) - (a.p95Ms ?? 0));
  return {
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    startedAt: new Date(startedAt).toISOString(),
    http: {
      total,
      errors5xx: s5,
      errors4xx: s4,
      errorRate5xx: total ? Number((s5 / total).toFixed(4)) : 0,
      avgMs: total ? Math.round(sumMs / total) : 0,
      p50Ms: percentile(merged, total, 0.5, maxMs),
      p95Ms: percentile(merged, total, 0.95, maxMs),
      p99Ms: percentile(merged, total, 0.99, maxMs),
      maxMs: Math.round(maxMs),
    },
    counters: Object.fromEntries([...counters.entries()].sort()),
    routes: byRoute.slice(0, 40),
    recentErrors: [...recentErrors],
  };
}

/** Dados brutos desta instância, para exportadores (cópia: quem recebe não altera o estado). */
export function rawMetrics() {
  return {
    startedAt,
    routes: [...routes.values()].map((r) => ({ ...r, buckets: [...r.buckets] })),
    counters: [...counters.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ai: [...aiStats.values()].map((a) => ({ ...a })),
  };
}

/** Atraso p99 do event loop desde a leitura anterior (zera a janela). Compartilhado por /metrics e pelo envio OTLP. */
export function takeEventLoopLagMs(): number {
  const ms = loopDelay.count > 0 ? loopDelay.percentile(99) / 1e6 : 0;
  loopDelay.reset();
  return Number.isFinite(ms) ? ms : 0;
}

const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");

/** Formato de texto do Prometheus (https://prometheus.io/docs/instrumenting/exposition_formats/). */
export function toPrometheus(): string {
  const out: string[] = [];
  out.push("# HELP periscopio_uptime_seconds Tempo desde o início desta instância.");
  out.push("# TYPE periscopio_uptime_seconds gauge");
  out.push(`periscopio_uptime_seconds ${Math.round((Date.now() - startedAt) / 1000)}`);
  // Versão em execução: cada deploy novo troca o valor do label `commit`, o que permite listar deploys no Grafana.
  const commit = (process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT ?? "").slice(0, 7) || "desconhecido";
  out.push("# HELP periscopio_build_info Versão (commit) em execução; o valor é sempre 1.");
  out.push("# TYPE periscopio_build_info gauge");
  out.push(`periscopio_build_info{commit="${esc(commit)}",environment="${esc(process.env.NODE_ENV ?? "development")}"} 1`);
  out.push("# HELP periscopio_process_start_time_seconds Início desta instância, em segundos desde 1970.");
  out.push("# TYPE periscopio_process_start_time_seconds gauge");
  out.push(`periscopio_process_start_time_seconds ${Math.round(startedAt / 1000)}`);
  // Memória e CPU do processo: substituem o stream de métricas do Render (exige plano Professional).
  // Sem label: uma série por métrica, nenhum dado pessoal.
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  const lagMs = takeEventLoopLagMs();
  out.push("# HELP periscopio_process_resident_memory_bytes Memória residente (RSS) do processo.");
  out.push("# TYPE periscopio_process_resident_memory_bytes gauge");
  out.push(`periscopio_process_resident_memory_bytes ${mem.rss}`);
  out.push("# HELP periscopio_nodejs_heap_used_bytes Heap do V8 em uso.");
  out.push("# TYPE periscopio_nodejs_heap_used_bytes gauge");
  out.push(`periscopio_nodejs_heap_used_bytes ${mem.heapUsed}`);
  out.push("# HELP periscopio_process_cpu_seconds_total CPU de usuário e de sistema consumida pelo processo.");
  out.push("# TYPE periscopio_process_cpu_seconds_total counter");
  out.push(`periscopio_process_cpu_seconds_total ${((cpu.user + cpu.system) / 1e6).toFixed(3)}`);
  out.push("# HELP periscopio_nodejs_eventloop_lag_p99_ms Atraso p99 do event loop desde a leitura anterior.");
  out.push("# TYPE periscopio_nodejs_eventloop_lag_p99_ms gauge");
  out.push(`periscopio_nodejs_eventloop_lag_p99_ms ${Number.isFinite(lagMs) ? lagMs.toFixed(2) : "0"}`);
  out.push("# HELP periscopio_http_requests_total Requisições por rota e classe de status.");
  out.push("# TYPE periscopio_http_requests_total counter");
  for (const r of routes.values()) {
    const l = `method="${esc(r.method)}",route="${esc(r.route)}"`;
    for (const [cls, n] of [["2xx", r.s2xx], ["3xx", r.s3xx], ["4xx", r.s4xx], ["5xx", r.s5xx]] as const) {
      if (n) out.push(`periscopio_http_requests_total{${l},status_class="${cls}"} ${n}`);
    }
  }
  out.push("# HELP periscopio_http_request_duration_ms Latência das requisições em milissegundos.");
  out.push("# TYPE periscopio_http_request_duration_ms histogram");
  for (const r of routes.values()) {
    const l = `method="${esc(r.method)}",route="${esc(r.route)}"`;
    LATENCY_BUCKETS_MS.forEach((b, i) => out.push(`periscopio_http_request_duration_ms_bucket{${l},le="${b}"} ${r.buckets[i]}`));
    out.push(`periscopio_http_request_duration_ms_bucket{${l},le="+Inf"} ${r.count}`);
    out.push(`periscopio_http_request_duration_ms_sum{${l}} ${Math.round(r.sumMs)}`);
    out.push(`periscopio_http_request_duration_ms_count{${l}} ${r.count}`);
  }
  out.push("# HELP periscopio_events_total Eventos internos (falhas de e-mail, limites de taxa, redefinições).");
  out.push("# TYPE periscopio_events_total counter");
  for (const [name, n] of [...counters.entries()].sort()) out.push(`periscopio_events_total{event="${esc(name)}"} ${n}`);
  if (aiStats.size) {
    out.push("# HELP periscopio_ai_tokens_total Tokens gastos pela IA, por recurso, provedor, modelo e direção.");
    out.push("# TYPE periscopio_ai_tokens_total counter");
    out.push("# HELP periscopio_ai_requests_total Chamadas à IA, por recurso, provedor, modelo e resultado.");
    out.push("# TYPE periscopio_ai_requests_total counter");
    for (const a of aiStats.values()) {
      const l = `feature="${esc(a.feature)}",provider="${esc(a.provider)}",model="${esc(a.model)}"`;
      out.push(`periscopio_ai_tokens_total{${l},direction="input"} ${a.inputTokens}`);
      out.push(`periscopio_ai_tokens_total{${l},direction="output"} ${a.outputTokens}`);
      out.push(`periscopio_ai_requests_total{${l},status="ok"} ${a.ok}`);
      out.push(`periscopio_ai_requests_total{${l},status="error"} ${a.failed}`);
    }
  }
  return out.join("\n") + "\n";
}
