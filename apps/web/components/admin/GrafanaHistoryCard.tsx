"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { api, ApiError } from "@/lib/api";

type Range = "1h" | "24h" | "7d";
const RANGES: { id: Range; label: string }[] = [
  { id: "1h", label: "1 hora" },
  { id: "24h", label: "24 horas" },
  { id: "7d", label: "7 dias" },
];
const METRICS = ["requests_per_min", "errors_5xx_per_min", "latency_p95_ms", "memory_mb", "cpu_percent", "eventloop_lag_p99_ms"] as const;

interface Point { t: number; v: number }
type Resposta =
  | { configured: false }
  | { configured: true; ok: true; metric: string; label: string; unit: string; range: Range; points: Point[] }
  | { configured: true; ok: false; metric: string; error: string };

const W = 320;
const H = 90;

function Linha({ points, label }: { points: Point[]; label: string }) {
  if (points.length < 2) return <p className="text-xs text-slate-500 py-6">Sem dados neste período.</p>;
  const ts = points.map((p) => p.t);
  const vs = points.map((p) => p.v);
  const [t0, t1] = [Math.min(...ts), Math.max(...ts)];
  const vmax = Math.max(...vs, 0);
  const x = (t: number) => ((t - t0) / (t1 - t0 || 1)) * W;
  const y = (v: number) => H - 4 - (v / (vmax || 1)) * (H - 8);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full h-24">
      <path d={d} fill="none" stroke="#0e7490" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));

/** Histórico das métricas da plataforma, vindo do Grafana Cloud pela API (o token nunca chega ao navegador). */
export function GrafanaHistoryCard() {
  const [range, setRange] = useState<Range>("24h");
  const [dados, setDados] = useState<Resposta[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await Promise.all(METRICS.map((m) => api.get<Resposta>(`/api/admin/grafana/series?metric=${m}&range=${range}`)));
      setDados(res);
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
    <section aria-label="Histórico de métricas do Grafana">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Histórico (Grafana Cloud)</h2>
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
          <button type="button" onClick={() => void carregar()} disabled={carregando} aria-label="Atualizar histórico" className="rounded-lg border border-[#E1E9ED] bg-white p-2 text-slate-700 disabled:opacity-50">
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>

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

      {!erro && !dados && carregando && <p className="text-sm text-slate-500">Carregando histórico…</p>}
    </section>
  );
}
