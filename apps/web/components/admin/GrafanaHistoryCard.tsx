"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { api, ApiError } from "@/lib/api";

export type Range = "1h" | "24h" | "7d";
export const RANGES: { id: Range; label: string }[] = [
  { id: "1h", label: "1 hora" },
  { id: "24h", label: "24 horas" },
  { id: "7d", label: "7 dias" },
];
const METRICS = ["requests_per_min", "errors_5xx_per_min", "latency_p95_ms", "memory_mb", "cpu_percent", "eventloop_lag_p99_ms"] as const;

export interface Point { t: number; v: number }
export type Resposta =
  | { configured: false }
  | { configured: true; ok: true; metric: string; label: string; unit: string; range: Range; points: Point[] }
  | { configured: true; ok: false; metric: string; error: string };

interface Deploy { commit: string; firstSeen: number; lastSeen: number; current: boolean }
type RespostaDeploys =
  | { configured: false }
  | { configured: true; ok: true; range: string; stepSeconds: number; deploys: Deploy[] }
  | { configured: true; ok: false; error: string };

export interface PushStatus { enabled: boolean; intervalSeconds: number; lastAttemptAt: string | null; lastOkAt: string | null; lastError: string | null }

const W = 320;
const H = 90;

export function Linha({ points, label, height = "h-24" }: { points: Point[]; label: string; height?: string }) {
  if (points.length < 2) return <p className="text-xs text-slate-500 py-4">Ainda sem dados neste período.</p>;
  const ts = points.map((p) => p.t);
  const vs = points.map((p) => p.v);
  const [t0, t1] = [Math.min(...ts), Math.max(...ts)];
  const vmax = Math.max(...vs, 0);
  const x = (t: number) => ((t - t0) / (t1 - t0 || 1)) * W;
  const y = (v: number) => H - 4 - (v / (vmax || 1)) * (H - 8);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className={`w-full ${height}`}>
      <path d={d} fill="none" stroke="#0e7490" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export const dataHora = (ms: number) =>
  new Date(ms).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));

/** Detalhes técnicos (gráficos, envio das métricas e versões no ar). Os cards simples ficam em SaudeSimples. */
export function GrafanaHistoryCard() {
  const [range, setRange] = useState<Range>("24h");
  const [dados, setDados] = useState<Resposta[] | null>(null);
  const [deploys, setDeploys] = useState<RespostaDeploys | null>(null);
  const [push, setPush] = useState<PushStatus | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [res, dep, envio] = await Promise.all([
        Promise.all(METRICS.map((m) => api.get<Resposta>(`/api/admin/grafana/series?metric=${m}&range=${range}`))),
        api.get<RespostaDeploys>(`/api/admin/grafana/deploys?range=${range === "7d" ? "7d" : "24h"}`),
        api.get<PushStatus>("/api/admin/grafana/push"),
      ]);
      setDados(res);
      setDeploys(dep);
      setPush(envio);
    } catch (e) {
      setDados(null);
      setErro(e instanceof ApiError ? e.message : "Não foi possível carregar o histórico.");
    } finally {
      setCarregando(false);
    }
  }, [range]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const naoConfigurado = dados?.every((d) => !d.configured);

  return (
    <section aria-label="Detalhes técnicos do Grafana">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Detalhes técnicos (Grafana Cloud)</h2>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Período" className="flex rounded-lg border border-[#E1E9ED] overflow-hidden">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={range === r.id}
                onClick={() => setRange(r.id)}
                className={`px-3 py-1.5 text-xs font-medium ${range === r.id ? "bg-cyan-700 text-white" : "bg-white text-slate-700"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void carregar()} disabled={carregando} aria-label="Atualizar detalhes técnicos" className="rounded-lg border border-[#E1E9ED] bg-white p-2 text-slate-700 disabled:opacity-50">
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>

      {push && (
        <p className="mb-2 rounded-xl border border-[#E1E9ED] bg-white p-3 text-xs text-slate-600" aria-live="polite">
          <span className="font-semibold text-slate-800">Envio das métricas pela API: </span>
          {!push.enabled
            ? "desligado (faltam OTEL_EXPORTER_OTLP_ENDPOINT e OTEL_EXPORTER_OTLP_HEADERS no servidor)."
            : push.lastOkAt
              ? `ligado, último envio ok em ${dataHora(Date.parse(push.lastOkAt))} (a cada ${push.intervalSeconds} s).`
              : push.lastError
                ? `ligado, mas falhou: ${push.lastError}`
                : "ligado, aguardando o primeiro envio."}
          {push.enabled && push.lastError && push.lastOkAt ? ` Última falha: ${push.lastError}` : ""}
        </p>
      )}

      {erro && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}

      {!erro && naoConfigurado && (
        <div className="rounded-xl border border-[#E1E9ED] bg-white p-4 text-sm text-slate-600">
          O histórico ainda não está ligado. Defina <span className="font-mono">GRAFANA_PROM_URL</span>, <span className="font-mono">GRAFANA_PROM_USER</span> e{" "}
          <span className="font-mono">GRAFANA_PROM_TOKEN</span> no servidor (Render). O token deve ter só a permissão <span className="font-mono">metrics:read</span>.
        </div>
      )}

      {!erro && dados && !naoConfigurado && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dados.map((d, i) =>
            !d.configured ? null : d.ok ? (
              <div key={d.metric} className="rounded-xl border border-[#E1E9ED] bg-white p-3">
                <p className="text-xs uppercase tracking-wider text-slate-500">{d.label}</p>
                <p className="text-lg font-bold font-display">
                  {d.points.length ? fmt(d.points[d.points.length - 1].v) : "—"} <span className="text-xs font-normal text-slate-500">{d.unit}</span>
                </p>
                <Linha points={d.points} label={`${d.label} nas últimas ${RANGES.find((r) => r.id === d.range)?.label}`} />
              </div>
            ) : (
              <div key={METRICS[i]} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-semibold">{METRICS[i]}</p>
                <p>{d.error}</p>
              </div>
            ),
          )}
        </div>
      )}

      {!erro && deploys && deploys.configured && (
        <div className="mt-3 rounded-xl border border-[#E1E9ED] bg-white p-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Versões no ar (deploys)</h3>
          {!deploys.ok ? (
            <p className="text-xs text-amber-900">{deploys.error}</p>
          ) : deploys.deploys.length === 0 ? (
            <p className="text-xs text-slate-500">Nenhuma versão registrada neste período. O Grafana precisa já ter recebido as métricas.</p>
          ) : (
            <ul className="divide-y divide-[#E1E9ED] text-sm">
              {deploys.deploys.map((d) => (
                <li key={d.commit} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <span className="font-mono">{d.commit}</span>
                  <span className="text-xs text-slate-600">
                    visto desde {dataHora(d.firstSeen)}
                    {d.current ? " · no ar agora" : ` · até ${dataHora(d.lastSeen)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-slate-500">Horários de Brasília, com precisão de alguns minutos (intervalo de coleta do Grafana).</p>
        </div>
      )}

      {!erro && !dados && carregando && <p className="text-sm text-slate-500">Carregando…</p>}
    </section>
  );
}
