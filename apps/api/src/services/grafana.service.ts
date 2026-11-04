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
const cache = new Map<string, { at: number; value: GrafanaSeriesResult | GrafanaDeploysResult }>();

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
  } catch {
    return { ok: false, error: "Não foi possível falar com o Grafana (rede ou tempo esgotado)." };
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
