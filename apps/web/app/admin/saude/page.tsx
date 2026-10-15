"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, ArrowLeft, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";

// ─── tipos (espelham GET /api/admin/observability) ──────────────────────────

interface RouteRow {
  method: string; route: string; count: number; errors5xx: number; errors4xx: number;
  avgMs: number; p95Ms: number | null; maxMs: number;
}
interface RecentError {
  at: string; requestId: string; method: string; route: string; status: number;
  errorClass: string | null; message: string | null;
}
interface Snapshot {
  generatedAt: string;
  instance: { node: string; commit: string | null; environment: string; memoryMb: number };
  db: { ok: boolean; latencyMs: number; error: string | null };
  alerts: { level: "alto" | "medio"; text: string }[];
  config: { key: string; ok: boolean; optional?: boolean; hint: string }[];
  uptimeSeconds: number;
  startedAt: string;
  http: {
    total: number; errors5xx: number; errors4xx: number; errorRate5xx: number;
    avgMs: number; p50Ms: number | null; p95Ms: number | null; p99Ms: number | null; maxMs: number;
  };
  counters: Record<string, number>;
  routes: RouteRow[];
  recentErrors: RecentError[];
  note: string;
}

const COUNTER_LABEL: Record<string, string> = {
  access_links_sent: "Links de acesso enviados",
  password_resets: "Senhas definidas pelo link",
  email_send_failures: "E-mails que não saíram",
  http_5xx_total: "Erros do servidor (5xx)",
};

function fmtUptime(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}min` : `${m}min`;
}
const ms = (v: number | null) => (v == null ? "—" : `${v} ms`);

function Card({ label, value, tone = "ok", hint }: { label: string; value: string; tone?: "ok" | "warn" | "bad"; hint?: string }) {
  const color = tone === "bad" ? "text-red-700" : tone === "warn" ? "text-amber-700" : "text-black";
  return (
    <div className="rounded-xl border border-[#E1E9ED] bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold font-display ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default function AdminSaudePage() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.get<Snapshot>("/api/admin/observability"));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível carregar a saúde do sistema.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [auto, load]);

  const h = data?.http;
  const rate = h ? `${(h.errorRate5xx * 100).toFixed(1)}%` : "—";

  return (
    <div className="min-h-screen bg-[#F6F9FB] text-black p-4 sm:p-6 md:p-10 font-sans">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-col gap-3 pb-6 border-b border-[#E1E9ED]">
          <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-black w-fit">
            <ArrowLeft className="w-3.5 h-3.5" /> Usuários & Perfis
          </Link>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-700 border border-blue-500/30 w-fit">
            <Activity className="w-3.5 h-3.5" /> Administrador Master
          </span>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl md:text-3xl font-bold font-display">Saúde do sistema</h1>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Atualizar a cada 30 s
              </label>
              <button
                onClick={() => void load()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E1E9ED] bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-600 max-w-3xl">
            Mostra se a plataforma está de pé, quais erros aconteceram e o que falta configurar. Não exibe dados de alunos nem segredos.
          </p>
        </div>

        {error && (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}

        {!data && !error && <p className="mt-6 text-sm text-slate-600">Carregando…</p>}

        {data && h && (
          <div className="mt-6 flex flex-col gap-6">
            {/* alertas */}
            {data.alerts.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircle2 className="w-4 h-4" /> Nenhum alerta no momento.
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.alerts.map((a, i) => (
                  <li
                    key={i}
                    className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                      a.level === "alto" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{a.text}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* números */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card label="Banco de dados" value={data.db.ok ? "No ar" : "Fora do ar"} tone={data.db.ok ? (data.db.latencyMs > 800 ? "warn" : "ok") : "bad"} hint={`Resposta em ${data.db.latencyMs} ms`} />
              <Card label="Requisições" value={String(h.total)} hint={`No ar há ${fmtUptime(data.uptimeSeconds)}`} />
              <Card label="Erros do servidor" value={rate} tone={h.errorRate5xx > 0.02 ? "bad" : h.errors5xx > 0 ? "warn" : "ok"} hint={`${h.errors5xx} de 5xx · ${h.errors4xx} de 4xx`} />
              <Card label="Tempo de resposta (95%)" value={ms(h.p95Ms)} tone={(h.p95Ms ?? 0) > 2500 ? "warn" : "ok"} hint={`média ${h.avgMs} ms · 50%: ${ms(h.p50Ms)} · 99%: ${ms(h.p99Ms)}`} />
            </div>

            {/* contadores */}
            {Object.keys(data.counters).length > 0 && (
              <section>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">Eventos</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(data.counters).map(([k, v]) => (
                    <Card key={k} label={COUNTER_LABEL[k] ?? k} value={String(v)} tone={k === "email_send_failures" && v > 0 ? "bad" : "ok"} />
                  ))}
                </div>
              </section>
            )}

            {/* configuração */}
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">Configuração do ambiente</h2>
              <ul className="rounded-xl border border-[#E1E9ED] bg-white divide-y divide-[#E1E9ED]">
                {data.config.map((c) => (
                  <li key={c.key} className="flex items-start justify-between gap-3 p-3">
                    <div className="flex items-start gap-3">
                      {c.ok ? (
                        <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
                      ) : c.optional ? (
                        <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 mt-0.5 text-red-600 shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-mono font-semibold">{c.key}</p>
                          {c.optional && (
                            <span className="text-[10px] font-sans font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              Opcional
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{c.hint}</p>
                      </div>
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      c.ok 
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                        : c.optional 
                        ? "bg-amber-50 text-amber-800 border border-amber-200" 
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}>
                      {c.ok ? "Configurado" : c.optional ? "Não configurado (opcional)" : "Pendente"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* rotas */}
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">Rotas (piores primeiro)</h2>
              <div className="overflow-x-auto rounded-xl border border-[#E1E9ED] bg-white">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500 border-b border-[#E1E9ED]">
                    <tr>
                      <th className="p-3">Rota</th><th className="p-3 text-right">Chamadas</th><th className="p-3 text-right">5xx</th>
                      <th className="p-3 text-right">4xx</th><th className="p-3 text-right">Média</th><th className="p-3 text-right">95%</th><th className="p-3 text-right">Máx.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.routes.length === 0 && (
                      <tr><td colSpan={7} className="p-3 text-slate-500">Ainda sem tráfego desde o último reinício.</td></tr>
                    )}
                    {data.routes.slice(0, 20).map((r) => (
                      <tr key={`${r.method} ${r.route}`} className="border-b border-[#E1E9ED] last:border-0">
                        <td className="p-3 font-mono text-xs">{r.method} {r.route}</td>
                        <td className="p-3 text-right">{r.count}</td>
                        <td className={`p-3 text-right ${r.errors5xx ? "text-red-700 font-semibold" : ""}`}>{r.errors5xx}</td>
                        <td className="p-3 text-right">{r.errors4xx}</td>
                        <td className="p-3 text-right">{r.avgMs} ms</td>
                        <td className="p-3 text-right">{ms(r.p95Ms)}</td>
                        <td className="p-3 text-right">{r.maxMs} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* erros recentes */}
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">Últimos erros do servidor</h2>
              {data.recentErrors.length === 0 ? (
                <p className="text-sm text-slate-600">Nenhum erro 5xx desde o último reinício.</p>
              ) : (
                <ul className="rounded-xl border border-[#E1E9ED] bg-white divide-y divide-[#E1E9ED]">
                  {data.recentErrors.slice(0, 20).map((e) => (
                    <li key={e.requestId + e.at} className="p-3 text-sm">
                      <p className="font-mono text-xs">
                        <span className="font-semibold text-red-700">{e.status}</span> {e.method} {e.route}
                        {e.errorClass ? ` · ${e.errorClass}` : ""}
                      </p>
                      {e.message && <p className="mt-0.5 text-slate-700">{e.message}</p>}
                      <p className="mt-0.5 text-xs text-slate-500">
                        {new Date(e.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · id da requisição: {e.requestId}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="text-xs text-slate-500">
              Instância: Node {data.instance.node} · {data.instance.environment} · {data.instance.memoryMb} MB
              {data.instance.commit ? ` · versão ${data.instance.commit}` : ""}. {data.note}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
