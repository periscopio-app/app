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
const cache = new Map<string, { at: number; value: GrafanaSeriesResult }>();

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

type PromMatrix = { status?: string; data?: { result?: { values?: [number, string][] }[] } };

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
  if (hit && d.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const def = GRAFANA_SERIES[metric];
  const { seconds, step } = GRAFANA_RANGES[range];
  const end = Math.floor(d.now() / 1000);
  const params = new URLSearchParams({ query: def.query, start: String(end - seconds), end: String(end), step: String(step) });

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  let value: GrafanaSeriesResult;
  try {
    const res = await d.fetch(`${cfg.base}/api/v1/query_range?${params}`, {
      headers: { Authorization: cfg.auth, Accept: "application/json" },
      signal: ctl.signal,
    });
    if (res.status === 401 || res.status === 403) {
      value = { configured: true, ok: false, metric, error: "O Grafana recusou o token (confira GRAFANA_PROM_USER e GRAFANA_PROM_TOKEN)." };
    } else if (res.status !== 200) {
      value = { configured: true, ok: false, metric, error: `O Grafana respondeu HTTP ${res.status}.` };
    } else {
      const body = (await res.json()) as PromMatrix;
      const values = body.status === "success" ? (body.data?.result?.[0]?.values ?? []) : [];
      const points = values
        .map(([ts, v]) => ({ t: Number(ts) * 1000, v: Number(v) }))
        .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v));
      value = { configured: true, ok: true, metric, label: def.label, unit: def.unit, range, points };
    }
  } catch {
    value = { configured: true, ok: false, metric, error: "Não foi possível falar com o Grafana (rede ou tempo esgotado)." };
  } finally {
    clearTimeout(timer);
  }

  if (value.configured && value.ok) cache.set(key, { at: d.now(), value });
  return value;
}
