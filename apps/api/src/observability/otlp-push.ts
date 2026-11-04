import { hostname } from "node:os";
import { buildOtlpPayload } from "./otlp";
import { rawMetrics, takeEventLoopLagMs } from "./metrics";

/**
 * Envio periódico das métricas ao Grafana Cloud (OTLP/HTTP). Fica desligado se faltar qualquer variável
 * ou se o endereço não for https. Nunca derruba a API: falha só vira estado (e um aviso a cada 10 minutos).
 * O token fica só no servidor e nunca entra em log, estado ou resposta.
 */

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ status: number }>;

export interface PushDeps {
  env: Record<string, string | undefined>;
  fetch: FetchLike;
  now: () => number;
  warn: (msg: string) => void;
}

const defaults: PushDeps = {
  env: process.env,
  fetch: (url, init) => fetch(url, init) as never,
  now: () => Date.now(),
  warn: (m) => console.warn(m),
};

export interface PushStatus {
  enabled: boolean;
  intervalSeconds: number;
  lastAttemptAt: string | null;
  lastOkAt: string | null;
  lastError: string | null;
}

const status: PushStatus = { enabled: false, intervalSeconds: 60, lastAttemptAt: null, lastOkAt: null, lastError: null };
export const otlpPushStatus = (): PushStatus => ({ ...status });

const TIMEOUT_MS = 8000;
const WARN_EVERY_MS = 10 * 60_000;
let lastWarnAt = 0;

/** Lê o cabeçalho Authorization de OTEL_EXPORTER_OTLP_HEADERS (formato `chave=valor,chave2=valor2`, valor às vezes com %20). */
function authFromOtelHeaders(raw: string | undefined): string | null {
  for (const pair of (raw ?? "").split(",")) {
    const i = pair.indexOf("=");
    if (i < 1) continue;
    if (pair.slice(0, i).trim().toLowerCase() !== "authorization") continue;
    let v = pair.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    try { v = decodeURIComponent(v); } catch {}
    return v.trim() || null;
  }
  return null;
}

/**
 * Configuração do envio. Aceita as variáveis padrão do OpenTelemetry que o Grafana entrega prontas
 * (OTEL_EXPORTER_OTLP_ENDPOINT e OTEL_EXPORTER_OTLP_HEADERS com `Authorization=Basic ...`) ou, se preferir,
 * GRAFANA_OTLP_ENDPOINT + GRAFANA_OTLP_USER + GRAFANA_OTLP_TOKEN. Só https.
 */
export function resolveOtlpConfig(env: PushDeps["env"]): { url: string; auth: string } | null {
  let endpoint = env.GRAFANA_OTLP_ENDPOINT?.trim() || env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  let auth: string | null = null;
  const user = env.GRAFANA_OTLP_USER?.trim();
  const token = env.GRAFANA_OTLP_TOKEN?.trim();
  if (env.GRAFANA_OTLP_ENDPOINT?.trim() && user && token) auth = `Basic ${Buffer.from(`${user}:${token}`).toString("base64")}`;
  else auth = authFromOtelHeaders(env.OTEL_EXPORTER_OTLP_HEADERS);
  const full = env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT?.trim();
  if (!auth || (!endpoint && !full)) return null;

  let u: URL;
  try {
    u = new URL(full && !env.GRAFANA_OTLP_ENDPOINT?.trim() ? full : (endpoint as string));
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const base = `${u.origin}${u.pathname.replace(/\/+$/, "")}`.replace(/\/v1\/metrics$/, "");
  return { url: `${base}/v1/metrics`, auth };
}

/** Uma tentativa de envio. Resolve sempre; o resultado fica em `otlpPushStatus()`. */
export async function pushMetricsOnce(overrides: Partial<PushDeps> = {}): Promise<boolean> {
  const d = { ...defaults, ...overrides };
  const cfg = resolveOtlpConfig(d.env);
  status.enabled = cfg !== null;
  if (!cfg) return false;

  status.lastAttemptAt = new Date(d.now()).toISOString();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const cpu = process.cpuUsage();
    const body = JSON.stringify(
      buildOtlpPayload({
        nowMs: d.now(),
        raw: rawMetrics(),
        memory: { rss: process.memoryUsage().rss, heapUsed: process.memoryUsage().heapUsed },
        cpuSeconds: (cpu.user + cpu.system) / 1e6,
        lagMs: takeEventLoopLagMs(),
        commit: (d.env.RENDER_GIT_COMMIT ?? d.env.GIT_COMMIT ?? "").slice(0, 7) || "desconhecido",
        environment: d.env.NODE_ENV ?? "development",
        instanceId: d.env.RENDER_INSTANCE_ID || hostname(),
        serviceName: d.env.OTEL_SERVICE_NAME?.trim() || "periscopio-api",
      }),
    );
    const res = await d.fetch(cfg.url, { method: "POST", headers: { Authorization: cfg.auth, "Content-Type": "application/json" }, body, signal: ctl.signal });
    if (res.status >= 200 && res.status < 300) {
      status.lastOkAt = new Date(d.now()).toISOString();
      status.lastError = null;
      return true;
    }
    status.lastError = res.status === 401 || res.status === 403 ? "O Grafana recusou as credenciais (confira o cabeçalho Authorization em OTEL_EXPORTER_OTLP_HEADERS)." : `O Grafana respondeu HTTP ${res.status}.`;
  } catch {
    status.lastError = "Não foi possível falar com o Grafana (rede ou tempo esgotado).";
  } finally {
    clearTimeout(timer);
  }
  if (d.now() - lastWarnAt >= WARN_EVERY_MS) {
    lastWarnAt = d.now();
    d.warn(`[otlp] envio de métricas falhou: ${status.lastError}`);
  }
  return false;
}

/** Liga o envio a cada `intervalMs`. O timer não segura o processo vivo. Devolve a função que desliga. */
export function startOtlpPush(intervalMs = 60_000, overrides: Partial<PushDeps> = {}): () => void {
  const d = { ...defaults, ...overrides };
  status.enabled = resolveOtlpConfig(d.env) !== null;
  status.intervalSeconds = Math.round(intervalMs / 1000);
  if (!status.enabled) return () => {};
  const timer = setInterval(() => void pushMetricsOnce(overrides), intervalMs);
  timer.unref();
  void pushMetricsOnce(overrides);
  return () => clearInterval(timer);
}
