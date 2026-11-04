import { networkErrorCode } from "../storage/config";

/**
 * Histórico de métricas vindo do Grafana Cloud (Prometheus), só para o Administrador Master.
 *
 * A API consulta o Grafana; o navegador nunca vê o token. As consultas são uma LISTA FECHADA
 * (nada de PromQL livre) e todas são agregadas da própria plataforma: sem aluno, sem dado clínico.
 */

export const GRAFANA_SERIES = {
  requests_per_min: {
    label: "Requisições por minuto",
    unit: "req/min",
    query: "sum(rate(periscopio_http_requests_total[5m])) * 60",
  },
  errors_5xx_per_min: {
    label: "Erros do servidor (5xx) por minuto",
    unit: "erros/min",
    query: 'sum(rate(periscopio_http_requests_total{status_class="5xx"}[5m])) * 60',
  },
  latency_p95_ms: {
    label: "Latência p95",
    unit: "ms",
    query: "histogram_quantile(0.95, sum by (le) (rate(periscopio_http_request_duration_ms_bucket[5m])))",
  },
  memory_mb: {
    label: "Memória do processo",
    unit: "MB",
    query: "max(periscopio_process_resident_memory_bytes) / 1048576",
  },
  cpu_percent: {
    label: "CPU do processo",
    unit: "%",
    query: "sum(rate(periscopio_process_cpu_seconds_total[5m])) * 100",
  },
  ai_tokens_per_hour: {
    label: "Tokens de IA por hora",
    unit: "tokens/h",
    query: "sum(increase(periscopio_ai_tokens_total[1h]))",
  },
  eventloop_lag_p99_ms: {
    label: "Atraso do event loop (p99)",
    unit: "ms",
    query: "max(periscopio_nodejs_eventloop_lag_p99_ms)",
  },
} as const;

export type GrafanaMetric = keyof typeof GRAFANA_SERIES;
export const GRAFANA_METRICS = Object.keys(GRAFANA_SERIES) as [GrafanaMetric, ...GrafanaMetric[]];

export const GRAFANA_RANGES = {
  "1h": { seconds: 3600, step: 60 },
  "24h": { seconds: 86_400, step: 300 },
  "7d": { seconds: 604_800, step: 1800 },
} as const;
export type GrafanaRange = keyof typeof GRAFANA_RANGES;

export interface GrafanaPoint {
  t: number; // epoch em milissegundos
  v: number;
}

export type GrafanaSeriesResult =
  | { configured: false }
  | { configured: true; ok: true; metric: GrafanaMetric; label: string; unit: string; range: GrafanaRange; points: GrafanaPoint[] }
  | { configured: true; ok: false; metric: GrafanaMetric; error: string };

type FetchLike = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<{ status: number; json(): Promise<unknown> }>;

export interface GrafanaDeps {
  env: Record<string, string | undefined>;
  fetch: FetchLike;
  now: () => number;
}

const defaults: GrafanaDeps = {
  env: process.env,
  fetch: (url, init) => fetch(url, init) as never,
  now: () => Date.now(),
};

const CACHE_TTL_MS = 30_000;
const TIMEOUT_MS = 8_000;
const cache = new Map<string, { at: number; value: GrafanaSeriesResult | GrafanaDeploysResult | GrafanaStatsResult }>();

export function clearGrafanaCache() {
  cache.clear();
}

/** Base da API Prometheus do Grafana Cloud. Só https; devolve null se não estiver configurada. */
function resolveConfig(env: GrafanaDeps["env"]): { base: string; auth: string } | null {
  const url = env.GRAFANA_PROM_URL?.trim();
  const user = env.GRAFANA_PROM_USER?.trim();
  const token = env.GRAFANA_PROM_TOKEN?.trim();
  if (!url || !user || !token) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const base = `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
  return { base, auth: `Basic ${Buffer.from(`${user}:${token}`).toString("base64")}` };
}

/** Mensagem curta, sem token nem corpo da resposta, que aponta a variável provável. */
export function describePromError(err: unknown): string {
  const code = networkErrorCode(err);
  if (code === "ABORT_ERR") return "O Grafana não respondeu a tempo. Confira se GRAFANA_PROM_URL é o endereço público do Prometheus (termina em /api/prom).";
  if (err instanceof SyntaxError) return "O endereço de leitura não devolveu dados do Prometheus. Confira se GRAFANA_PROM_URL termina em /api/prom.";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "O endereço de GRAFANA_PROM_URL não existe (DNS). Use o endereço público do Prometheus, não o interno.";
  if (code) return `Não foi possível falar com o Grafana (${code}). Confira GRAFANA_PROM_URL.`;
  return "Não foi possível falar com o Grafana (rede). Confira GRAFANA_PROM_URL.";
}

type PromSeries = { metric?: Record<string, string>; values?: [number, string][] };
type PromMatrix = { status?: string; data?: { result?: PromSeries[] } };
type PromOutcome = { ok: true; series: PromSeries[] } | { ok: false; error: string };

/** Uma consulta `query_range` ao Grafana. Erros viram mensagem genérica, sem token nem corpo da resposta. */
async function promQueryRange(cfg: { base: string; auth: string }, query: string, range: GrafanaRange, d: GrafanaDeps): Promise<PromOutcome> {
  const { seconds, step } = GRAFANA_RANGES[range];
  const end = Math.floor(d.now() / 1000);
  const params = new URLSearchParams({ query, start: String(end - seconds), end: String(end), step: String(step) });
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await d.fetch(`${cfg.base}/api/v1/query_range?${params}`, {
      headers: { Authorization: cfg.auth, Accept: "application/json" },
      signal: ctl.signal,
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "O Grafana recusou o token (confira GRAFANA_PROM_USER e GRAFANA_PROM_TOKEN)." };
    }
    if (res.status !== 200) return { ok: false, error: `O Grafana respondeu HTTP ${res.status}.` };
    const body = (await res.json()) as PromMatrix;
    return { ok: true, series: body.status === "success" ? (body.data?.result ?? []) : [] };
  } catch (err) {
    return { ok: false, error: describePromError(err) };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchGrafanaSeries(
  metric: GrafanaMetric,
  range: GrafanaRange,
  overrides: Partial<GrafanaDeps> = {},
): Promise<GrafanaSeriesResult> {
  const d = { ...defaults, ...overrides };
  const cfg = resolveConfig(d.env);
  if (!cfg) return { configured: false };

  const key = `${metric}:${range}`;
  const hit = cache.get(key);
  if (hit && d.now() - hit.at < CACHE_TTL_MS) return hit.value as GrafanaSeriesResult;

  const def = GRAFANA_SERIES[metric];
  const out = await promQueryRange(cfg, def.query, range, d);
  let value: GrafanaSeriesResult;
  if (!out.ok) {
    value = { configured: true, ok: false, metric, error: out.error };
  } else {
    const points = (out.series[0]?.values ?? [])
      .map(([ts, v]) => ({ t: Number(ts) * 1000, v: Number(v) }))
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v));
    value = { configured: true, ok: true, metric, label: def.label, unit: def.unit, range, points };
  }
  if (value.configured && value.ok) cache.set(key, { at: d.now(), value });
  return value;
}

export interface GrafanaDeploy {
  commit: string;
  firstSeen: number; // epoch ms; precisão = passo da consulta
  lastSeen: number;
  current: boolean;
}

export type GrafanaDeploysResult =
  | { configured: false }
  | { configured: true; ok: true; range: GrafanaRange; stepSeconds: number; deploys: GrafanaDeploy[] }
  | { configured: true; ok: false; error: string };

/**
 * Deploys vistos pelo Grafana: cada commit diferente em `periscopio_build_info` é uma versão que
 * esteve no ar. Não usa a API da Render (a chave dela tem acesso total à conta, inclusive às variáveis).
 */
export async function fetchGrafanaDeploys(range: GrafanaRange, overrides: Partial<GrafanaDeps> = {}): Promise<GrafanaDeploysResult> {
  const d = { ...defaults, ...overrides };
  const cfg = resolveConfig(d.env);
  if (!cfg) return { configured: false };

  const key = `deploys:${range}`;
  const hit = cache.get(key);
  if (hit && d.now() - hit.at < CACHE_TTL_MS) return hit.value as GrafanaDeploysResult;

  const out = await promQueryRange(cfg, "max by (commit) (periscopio_build_info)", range, d);
  if (!out.ok) return { configured: true, ok: false, error: out.error };

  const { step } = GRAFANA_RANGES[range];
  const nowMs = d.now();
  const deploys: GrafanaDeploy[] = out.series
    .map((s) => {
      const times = (s.values ?? []).map(([ts]) => Number(ts) * 1000).filter(Number.isFinite);
      if (!s.metric?.commit || times.length === 0) return null;
      const firstSeen = Math.min(...times);
      const lastSeen = Math.max(...times);
      return { commit: s.metric.commit.slice(0, 12), firstSeen, lastSeen, current: nowMs - lastSeen <= step * 2 * 1000 };
    })
    .filter((x): x is GrafanaDeploy => x !== null)
    .sort((a, b) => b.firstSeen - a.firstSeen);

  const value: GrafanaDeploysResult = { configured: true, ok: true, range, stepSeconds: step, deploys };
  cache.set(key, { at: d.now(), value });
  return value;
}

// ─── Resumo para quem gere o sistema ───────────────────────────────────────

type PromVector = { status?: string; data?: { result?: { metric?: Record<string, string>; value?: [number, string] }[] } };
type InstantOutcome = { ok: true; rows: { labels: Record<string, string>; value: number }[] } | { ok: false; error: string };

async function promInstant(cfg: { base: string; auth: string }, query: string, d: GrafanaDeps): Promise<InstantOutcome> {
  const params = new URLSearchParams({ query, time: String(Math.floor(d.now() / 1000)) });
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await d.fetch(`${cfg.base}/api/v1/query?${params}`, { headers: { Authorization: cfg.auth, Accept: "application/json" }, signal: ctl.signal });
    if (res.status === 401 || res.status === 403) return { ok: false, error: "O Grafana recusou o token (confira GRAFANA_PROM_USER e GRAFANA_PROM_TOKEN)." };
    if (res.status !== 200) return { ok: false, error: `O Grafana respondeu HTTP ${res.status}.` };
    const body = (await res.json()) as PromVector;
    const rows = (body.status === "success" ? (body.data?.result ?? []) : [])
      .map((r) => ({ labels: r.metric ?? {}, value: Number(r.value?.[1]) }))
      .filter((r) => Number.isFinite(r.value));
    return { ok: true, rows };
  } catch (err) {
    return { ok: false, error: describePromError(err) };
  } finally {
    clearTimeout(timer);
  }
}

export interface GrafanaStats {
  uptimeSeconds: number | null;
  requests: number | null;
  errors5xx: number | null;
  p95Ms: number | null;
  memoryMb: number | null;
  ai: {
    inputTokens: number | null;
    outputTokens: number | null;
    calls: number | null;
    errors: number | null;
    byModel: { provider: string; model: string; tokens: number }[];
    byFeature: { feature: string; tokens: number }[];
  };
}

export type GrafanaStatsResult =
  | { configured: false }
  | {
      configured: true;
      ok: true;
      range: GrafanaRange;
      stats: GrafanaStats;
      /** Preços por milhão de tokens, só se o administrador definir AI_PRICE_*; nenhum valor é inventado. */
      pricing: { inputPerMtok: number | null; outputPerMtok: number | null; currency: string };
    }
  | { configured: true; ok: false; error: string };

const WINDOW: Record<GrafanaRange, string> = { "1h": "1h", "24h": "24h", "7d": "7d" };
const num = (v: string | undefined) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null);

export async function fetchGrafanaStats(range: GrafanaRange, overrides: Partial<GrafanaDeps> = {}): Promise<GrafanaStatsResult> {
  const d = { ...defaults, ...overrides };
  const cfg = resolveConfig(d.env);
  if (!cfg) return { configured: false };

  const key = `stats:${range}`;
  const hit = cache.get(key);
  if (hit && d.now() - hit.at < CACHE_TTL_MS) return hit.value as GrafanaStatsResult;

  const w = WINDOW[range];
  const q = (expr: string) => promInstant(cfg, expr, d);
  const [up, req, err5, p95, mem, aiIn, aiOut, aiCalls, aiErr, byModel, byFeature] = await Promise.all([
    q("max(periscopio_uptime_seconds)"),
    q(`sum(increase(periscopio_http_requests_total[${w}]))`),
    q(`sum(increase(periscopio_http_requests_total{status_class="5xx"}[${w}]))`),
    q(`histogram_quantile(0.95, sum by (le) (rate(periscopio_http_request_duration_ms_bucket[${w}])))`),
    q("max(periscopio_process_resident_memory_bytes) / 1048576"),
    q(`sum(increase(periscopio_ai_tokens_total{direction="input"}[${w}]))`),
    q(`sum(increase(periscopio_ai_tokens_total{direction="output"}[${w}]))`),
    q(`sum(increase(periscopio_ai_requests_total[${w}]))`),
    q(`sum(increase(periscopio_ai_requests_total{status="error"}[${w}]))`),
    q(`sum by (provider, model) (increase(periscopio_ai_tokens_total[${w}]))`),
    q(`sum by (feature) (increase(periscopio_ai_tokens_total[${w}]))`),
  ]);

  const first = [up, req, err5, p95, mem, aiIn, aiOut, aiCalls, aiErr, byModel, byFeature].find((o) => !o.ok);
  if (first && !first.ok) return { configured: true, ok: false, error: first.error };

  const one = (o: InstantOutcome) => (o.ok && o.rows.length ? o.rows[0].value : null);
  const rounded = (v: number | null) => (v === null ? null : Math.round(v));
  const stats: GrafanaStats = {
    uptimeSeconds: rounded(one(up)),
    requests: rounded(one(req)),
    errors5xx: rounded(one(err5)),
    p95Ms: rounded(one(p95)),
    memoryMb: rounded(one(mem)),
    ai: {
      inputTokens: rounded(one(aiIn)),
      outputTokens: rounded(one(aiOut)),
      calls: rounded(one(aiCalls)),
      errors: rounded(one(aiErr)),
      byModel: (byModel.ok ? byModel.rows : [])
        .map((r) => ({ provider: r.labels.provider ?? "desconhecido", model: r.labels.model ?? "desconhecido", tokens: Math.round(r.value) }))
        .filter((r) => r.tokens > 0)
        .sort((a, b) => b.tokens - a.tokens),
      byFeature: (byFeature.ok ? byFeature.rows : [])
        .map((r) => ({ feature: r.labels.feature ?? "desconhecido", tokens: Math.round(r.value) }))
        .filter((r) => r.tokens > 0)
        .sort((a, b) => b.tokens - a.tokens),
    },
  };
  const value: GrafanaStatsResult = {
    configured: true,
    ok: true,
    range,
    stats,
    pricing: { inputPerMtok: num(d.env.AI_PRICE_INPUT_PER_MTOK), outputPerMtok: num(d.env.AI_PRICE_OUTPUT_PER_MTOK), currency: d.env.AI_PRICE_CURRENCY?.trim() || "US$" },
  };
  cache.set(key, { at: d.now(), value });
  return value;
}
