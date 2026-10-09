"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Me } from "@/lib/api";
import { RoleBanner } from "@/components/ui/RoleBanner";
import { BarChart3, Check, Download, ShieldCheck, ThumbsDown, ThumbsUp, X } from "lucide-react";

interface Row { dims: Record<string, string>; value: number | null; suppressed: boolean; n?: number }
interface Result {
  metric: string; label: string; unit: string; groupBy: string[]; groupLabels: string[];
  rows: Row[]; total: number | null; suppressedCount: number; additive: boolean;
  viz: "table" | "bar" | "line"; notes: string[]; summary?: string;
}
interface Plan {
  metric: string; groupBy: string[]; viz?: "table" | "bar" | "line";
  filters: { schoolId?: string; ageBracket?: string; journeyState?: string; specialty?: string; from?: string; to?: string };
}
interface Catalog {
  metrics: { id: string; label: string; description: string; unit: string; additive: boolean; dims: string[]; filters: string[] }[];
  dimensions: Record<string, string>;
  schools: { id: string; name: string }[];
  ageBrackets: string[];
  journeyStates: { id: string; label: string }[];
  specialties: string[];
  glossary: Record<string, string>;
  assistantEnabled: boolean;
  canApprove: boolean;
  privacy: string;
}
type Overview = Record<string, Result>;
interface AskReply {
  questionId: string; understood: boolean; scrubbed?: boolean; message?: string;
  plan?: Plan; result?: Result; summary?: string; explanation?: string | null; source?: string; confidence?: number | null;
}
interface QItem { id: string; question: string; plan: Plan | null; correctedPlan: Plan | null; rating: number | null; source: string }

const fmt = (v: number | null) => (v == null ? "<5" : String(v).replace(".", ","));
const label = (r: Row) => Object.values(r.dims).join(" · ") || "Total";
const SUGGESTIONS = [
  "Quantos casos temos por escola?",
  "Tempo médio até o encerramento por mês",
  "Quantos profissionais precisamos por serviço?",
  "Queixas mais registradas na base de Tarumã",
  "Casos por etapa da jornada",
  "Delegações por especialidade",
];

function Bars({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value ?? 0));
  return (
    <div className="space-y-1.5" role="img" aria-label="Gráfico de barras">
      {rows.slice(0, 20).map((r, i) => (
        <div key={i} className="grid grid-cols-[minmax(90px,200px)_1fr_56px] items-center gap-2 text-xs text-black">
          <span className="truncate" title={label(r)}>{label(r)}</span>
          <div className="h-5 rounded bg-neutral-100 border border-linha overflow-hidden">
            {r.value != null ? (
              <div className="h-full bg-roxo-100 border-r border-roxo" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
            ) : (
              <div className="h-full w-full" style={{ backgroundImage: "repeating-linear-gradient(45deg,#d4d4d4 0 4px,#fff 4px 8px)" }} />
            )}
          </div>
          <span className="text-right font-semibold">{fmt(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

function Line({ rows }: { rows: Row[] }) {
  const pts = rows.filter((r) => r.value != null);
  if (pts.length < 2) return <p className="text-xs text-black">Poucos pontos para linha; veja a tabela.</p>;
  const W = 560, H = 160, P = 28;
  const max = Math.max(1, ...pts.map((r) => r.value!));
  const x = (i: number) => P + (i * (W - 2 * P)) / (pts.length - 1);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const d = pts.map((r, i) => `${i ? "L" : "M"}${x(i)},${y(r.value!)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xl" role="img" aria-label="Gráfico de linha">
      <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="#000" strokeWidth="1" />
      <path d={d} fill="none" stroke="#000" strokeWidth="2" />
      {pts.map((r, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(r.value!)} r="4" fill="#fff" stroke="#000" strokeWidth="2" />
          <text x={x(i)} y={H - 8} fontSize="9" textAnchor="middle" fill="#000">{label(r).slice(-5)}</text>
          <text x={x(i)} y={y(r.value!) - 8} fontSize="9" textAnchor="middle" fill="#000">{fmt(r.value)}</text>
        </g>
      ))}
    </svg>
  );
}

function csvOf(r: Result) {
  const head = [...r.groupLabels, r.label].join(";");
  const lines = r.rows.map((x) => [...r.groupBy.map((d) => x.dims[d]), x.value == null ? "<5" : x.value].join(";"));
  return [head, ...lines].join("\n");
}

function ResultView({ r, title }: { r: Result; title?: string }) {
  const [view, setView] = useState<"table" | "bar" | "line">(r.viz);
  useEffect(() => setView(r.viz), [r]);
  const canChart = r.groupBy.length === 1 && r.rows.length > 0;
  const download = () => {
    const blob = new Blob(["﻿" + csvOf(r)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bi-${r.metric}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-black">{title ?? r.label} <span className="font-normal text-xs">({r.unit})</span></h3>
        <div className="flex gap-1 text-xs">
          {canChart && (["bar", "line", "table"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)}
              className={`rounded-lg border px-2 py-1 text-black ${view === v ? "bg-roxo-100 border-roxo font-semibold" : "border-linha bg-white"}`}>
              {v === "bar" ? "Barras" : v === "line" ? "Linha" : "Tabela"}
            </button>
          ))}
          <button type="button" onClick={download} className="inline-flex items-center gap-1 rounded-lg border border-linha bg-white px-2 py-1 text-black">
            <Download className="h-3 w-3" /> CSV
          </button>
        </div>
      </div>
      {canChart && view === "bar" && <Bars rows={r.rows} />}
      {canChart && view === "line" && <Line rows={r.rows} />}
      {(!canChart || view === "table") && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-black">
            <thead>
              <tr className="text-left text-xs border-b border-linha">
                {r.groupLabels.map((g) => <th key={g} className="py-1.5 pr-3">{g}</th>)}
                <th className="py-1.5">{r.groupLabels.length ? "Valor" : r.label}</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((x, i) => (
                <tr key={i} className="border-b border-linha">
                  {r.groupBy.map((d) => <td key={d} className="py-1.5 pr-3">{x.dims[d]}</td>)}
                  <td className="py-1.5 font-semibold">{fmt(x.value)}{x.n != null && <span className="ml-1 text-[11px] font-normal">(n={x.n})</span>}</td>
                </tr>
              ))}
              {r.rows.length === 0 && <tr><td className="py-4 text-center" colSpan={r.groupBy.length + 1}>Nenhum dado para esse recorte.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {r.total != null && <p className="text-xs text-black">Total: <strong>{fmt(r.total)}</strong></p>}
      {r.notes.map((n) => <p key={n} className="text-xs text-neutral-800">{n}</p>)}
    </div>
  );
}

function Kpi({ title, r, sub }: { title: string; r?: Result; sub?: string }) {
  const row = r?.rows[0];
  const lower = r && r.rows.length > 1 ? r.rows.reduce((s, x) => s + (x.value ?? 0), 0) : null;
  return (
    <div className="rounded-2xl bg-white border border-linha p-4 shadow-suave">
      <div className="text-xs font-semibold text-black">{title}</div>
      <div className="mt-1 text-2xl font-extrabold text-black">
        {r ? (r.rows.length > 1 ? `${r.total == null ? "≥ " : ""}${fmt(r.total ?? Math.round((lower ?? 0) * 10) / 10)}` : row ? fmt(row.value) : "—") : "…"}
      </div>
      {sub && <div className="text-[11px] text-neutral-800">{sub}</div>}
    </div>
  );
}

export default function BiPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [cat, setCat] = useState<Catalog | null>(null);
  const [ov, setOv] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [ask, setAsk] = useState<AskReply | null>(null);
  const [askErr, setAskErr] = useState<string | null>(null);
  const [fbMsg, setFbMsg] = useState<string | null>(null);

  const [plan, setPlan] = useState<Plan>({ metric: "cases", groupBy: ["school"], filters: {} });
  const [built, setBuilt] = useState<{ result: Result; summary: string } | null>(null);
  const [buildErr, setBuildErr] = useState<string | null>(null);

  const [queue, setQueue] = useState<{ pending: QItem[]; approved: QItem[] } | null>(null);

  const loadQueue = useCallback(async () => {
    try { setQueue(await api.get("/api/bi/questions")); } catch { /* sem permissão */ }
  }, []);

  useEffect(() => {
    api.get<{ user: Me }>("/api/me").then((r) => setMe(r.user)).catch(() => undefined);
    (async () => {
      try {
        const [c, o] = await Promise.all([api.get<Catalog>("/api/bi/catalog"), api.get<Overview>("/api/bi/overview")]);
        setCat(c); setOv(o);
        if (c.canApprove) loadQueue();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao carregar o BI");
      }
    })();
  }, [loadQueue]);

  const metric = useMemo(() => cat?.metrics.find((m) => m.id === plan.metric), [cat, plan.metric]);

  async function doAsk(q: string) {
    if (q.trim().length < 3) return;
    setAsking(true); setAskErr(null); setAsk(null); setFbMsg(null);
    try {
      const r = await api.post<AskReply>("/api/bi/ask", { question: q });
      setAsk(r);
      if (r.understood && r.plan) setPlan({ ...r.plan, groupBy: r.plan.groupBy ?? [], filters: r.plan.filters ?? {} });
    } catch (e) {
      setAskErr(e instanceof Error ? e.message : "Falha ao perguntar");
    } finally { setAsking(false); }
  }

  async function runBuilder() {
    setBuildErr(null);
    try {
      const r = await api.post<{ result: Result; summary: string }>("/api/bi/query", { plan });
      setBuilt(r);
    } catch (e) {
      setBuildErr(e instanceof Error ? e.message : "Falha na consulta");
    }
  }

  async function feedback(rating: 1 | -1, corrected?: boolean) {
    if (!ask?.questionId) return;
    try {
      const r = await api.post<{ approved: boolean; pendingReview: boolean }>("/api/bi/feedback", {
        questionId: ask.questionId, rating, ...(corrected ? { correctedPlan: plan } : {}),
      });
      setFbMsg(r.approved ? "Obrigado! Esta pergunta passou a ensinar o assistente." : r.pendingReview ? "Obrigado! Vai para revisão da gestão antes de ensinar o assistente." : "Obrigado pelo retorno.");
      if (cat?.canApprove) loadQueue();
    } catch (e) {
      setFbMsg(e instanceof Error ? e.message : "Falha ao enviar");
    }
  }

  async function decide(id: string, approve: boolean) {
    try { await api.post(`/api/bi/questions/${id}/approve`, { approve }); await loadQueue(); } catch { /* ignora */ }
  }

  const setFilter = (k: keyof Plan["filters"], v: string) =>
    setPlan((p) => ({ ...p, filters: { ...p.filters, [k]: v || undefined } }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 text-black">
      {me && <RoleBanner me={me} />}
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-black"><BarChart3 className="h-6 w-6" /> BI do gestor</h1>
        <p className="mt-1 text-sm text-black">Pergunte em português ou monte a consulta. Alunos aparecem só como contagem anônima.</p>
        <p className="mt-2 inline-flex items-start gap-2 rounded-xl border border-linha bg-roxo-50 px-3 py-2 text-xs text-black">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          {cat?.privacy ?? "Grupos com menos de 5 casos são ocultados."} Não digite nome ou documento de aluno.
        </p>
      </header>

      {error && <p role="alert" className="rounded-xl border border-black bg-white p-3 text-sm">{error}</p>}

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi title="Alunos cadastrados" r={ov?.students} />
        <Kpi title="Casos abertos" r={ov?.cases} />
        <Kpi title="Tempo médio até encerrar (dias)" r={ov?.cycle} sub="só casos encerrados; mínimo 5" />
        <Kpi title="Profissionais necessários" r={ov?.professionals} sub="estimativa de gestão" />
      </section>

      <section className="rounded-2xl bg-white border border-linha p-4 shadow-suave space-y-3">
        <h2 className="text-sm font-bold text-black">Perguntar ao assistente</h2>
        <form onSubmit={(e) => { e.preventDefault(); doAsk(question); }} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="bi-q" className="sr-only">Pergunta</label>
          <input id="bi-q" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500}
            placeholder="Ex.: tempo médio até o encerramento por mês nos últimos 6 meses"
            className="flex-1 rounded-xl border border-black bg-white px-3 py-2 text-sm text-black" />
          <button type="submit" disabled={asking}
            className="rounded-xl bg-roxo-100 border border-roxo px-4 py-2 text-sm font-semibold text-black hover:bg-roxo-200 disabled:opacity-60">
            {asking ? "Pensando…" : "Perguntar"}
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => { setQuestion(s); doAsk(s); }}
              className="rounded-full border border-linha bg-white px-3 py-1 text-xs text-black hover:bg-roxo-50">{s}</button>
          ))}
        </div>
        {askErr && <p role="alert" className="text-sm text-black border border-black rounded-xl p-2">{askErr}</p>}
        {ask && !ask.understood && <p className="text-sm text-black border border-linha rounded-xl p-3 bg-neutral-50">{ask.message}</p>}
        {ask?.scrubbed && <p className="text-xs text-black">Removi da pergunta algo que parecia documento, e-mail ou telefone.</p>}
        {ask?.understood && ask.result && (
          <div className="space-y-3 rounded-xl border border-linha p-3">
            {ask.explanation && <p className="text-xs text-neutral-800">{ask.explanation}</p>}
            <p className="text-sm font-semibold text-black">{ask.summary}</p>
            <ResultView r={ask.result} />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span>Esta resposta ajudou?</span>
              <button type="button" onClick={() => feedback(1)} className="inline-flex items-center gap-1 rounded-lg border border-linha px-2 py-1"><ThumbsUp className="h-3 w-3" /> Sim</button>
              <button type="button" onClick={() => feedback(-1)} className="inline-flex items-center gap-1 rounded-lg border border-linha px-2 py-1"><ThumbsDown className="h-3 w-3" /> Não</button>
              <button type="button" onClick={() => feedback(1, true)} className="rounded-lg border border-linha px-2 py-1">Usar a consulta ajustada abaixo como correção</button>
              {fbMsg && <span role="status">{fbMsg}</span>}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white border border-linha p-4 shadow-suave space-y-3">
        <h2 className="text-sm font-bold text-black">Montar consulta</h2>
        {cat && (
          <div className="grid gap-3 md:grid-cols-3 text-xs">
            <label className="space-y-1">Métrica
              <select value={plan.metric} onChange={(e) => setPlan({ metric: e.target.value, groupBy: [], filters: {} })}
                className="w-full rounded-lg border border-black bg-white px-2 py-1.5 text-sm text-black">
                {cat.metrics.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
            {[0, 1].map((i) => (
              <label key={i} className="space-y-1">{i === 0 ? "Agrupar por" : "Depois por"}
                <select value={plan.groupBy[i] ?? ""} onChange={(e) => {
                  const g = [...plan.groupBy]; if (e.target.value) g[i] = e.target.value; else g.splice(i);
                  setPlan({ ...plan, groupBy: g.filter(Boolean) });
                }} className="w-full rounded-lg border border-black bg-white px-2 py-1.5 text-sm text-black">
                  <option value="">—</option>
                  {metric?.dims.filter((d) => d !== plan.groupBy[1 - i]).map((d) => <option key={d} value={d}>{cat.dimensions[d]}</option>)}
                </select>
              </label>
            ))}
            {metric?.filters.includes("schoolId") && (
              <label className="space-y-1">Escola
                <select value={plan.filters.schoolId ?? ""} onChange={(e) => setFilter("schoolId", e.target.value)} className="w-full rounded-lg border border-black bg-white px-2 py-1.5 text-sm text-black">
                  <option value="">Todas que posso ver</option>
                  {cat.schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            )}
            {metric?.filters.includes("ageBracket") && (
              <label className="space-y-1">Faixa etária
                <select value={plan.filters.ageBracket ?? ""} onChange={(e) => setFilter("ageBracket", e.target.value)} className="w-full rounded-lg border border-black bg-white px-2 py-1.5 text-sm text-black">
                  <option value="">Todas</option>
                  {cat.ageBrackets.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
            )}
            {metric?.filters.includes("journeyState") && (
              <label className="space-y-1">Etapa
                <select value={plan.filters.journeyState ?? ""} onChange={(e) => setFilter("journeyState", e.target.value)} className="w-full rounded-lg border border-black bg-white px-2 py-1.5 text-sm text-black">
                  <option value="">Todas</option>
                  {cat.journeyStates.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </label>
            )}
            {metric?.filters.includes("specialty") && (
              <label className="space-y-1">Especialidade
                <select value={plan.filters.specialty ?? ""} onChange={(e) => setFilter("specialty", e.target.value)} className="w-full rounded-lg border border-black bg-white px-2 py-1.5 text-sm text-black">
                  <option value="">Todas</option>
                  {cat.specialties.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            )}
            {metric?.filters.includes("from") && (
              <>
                <label className="space-y-1">De (mês)
                  <input type="month" value={plan.filters.from ?? ""} onChange={(e) => setFilter("from", e.target.value)} className="w-full rounded-lg border border-black bg-white px-2 py-1.5 text-sm text-black" />
                </label>
                <label className="space-y-1">Até (mês)
                  <input type="month" value={plan.filters.to ?? ""} onChange={(e) => setFilter("to", e.target.value)} className="w-full rounded-lg border border-black bg-white px-2 py-1.5 text-sm text-black" />
                </label>
              </>
            )}
          </div>
        )}
        {metric && <p className="text-xs text-neutral-800">{metric.description}</p>}
        <button type="button" onClick={runBuilder} className="rounded-xl bg-roxo-100 border border-roxo px-4 py-2 text-sm font-semibold text-black hover:bg-roxo-200">Consultar</button>
        {buildErr && <p role="alert" className="text-sm text-black border border-black rounded-xl p-2">{buildErr}</p>}
        {built && (
          <div className="rounded-xl border border-linha p-3 space-y-2">
            <p className="text-sm font-semibold text-black">{built.summary}</p>
            <ResultView r={built.result} />
          </div>
        )}
      </section>

      {ov && (
        <section className="grid gap-4 md:grid-cols-2" aria-label="Painéis">
          {[
            ["casesByState", "Casos por etapa da jornada"],
            ["casesByMonth", "Casos abertos por mês"],
            ["casesBySchool", "Casos por escola"],
            ["delegations", "Delegações por especialidade"],
            ["populationBySchool", "Base populacional por escola"],
            ["populationByService", "Demanda por serviço (base populacional)"],
            ["professionals", "Profissionais necessários por serviço"],
          ].map(([k, t]) => (
            <div key={k} className="rounded-2xl bg-white border border-linha p-4 shadow-suave">
              <ResultView r={ov[k]} title={t} />
            </div>
          ))}
        </section>
      )}

      {cat?.canApprove && queue && (
        <section className="rounded-2xl bg-white border border-linha p-4 shadow-suave space-y-2">
          <h2 className="text-sm font-bold text-black">Ensinar o assistente (revisão da gestão)</h2>
          <p className="text-xs text-neutral-800">Perguntas aprovadas passam a ser reaproveitadas. {queue.approved.length} aprovada(s) até agora.</p>
          {queue.pending.length === 0 && <p className="text-sm text-black">Nada pendente.</p>}
          {queue.pending.map((q) => {
            const p = q.correctedPlan ?? q.plan;
            return (
              <div key={q.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-linha p-2 text-sm">
                <div>
                  <div className="font-semibold">{q.question}</div>
                  <div className="text-xs text-neutral-800">{p ? `${p.metric} · ${p.groupBy.join(", ") || "sem agrupamento"}` : "sem plano"}{q.correctedPlan ? " · corrigida" : ""}</div>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => decide(q.id, true)} className="inline-flex items-center gap-1 rounded-lg border border-roxo bg-roxo-100 px-2 py-1 text-xs"><Check className="h-3 w-3" /> Aprovar</button>
                  <button type="button" onClick={() => decide(q.id, false)} className="inline-flex items-center gap-1 rounded-lg border border-linha px-2 py-1 text-xs"><X className="h-3 w-3" /> Descartar</button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {cat && (
        <section className="rounded-2xl bg-white border border-linha p-4 text-xs text-black">
          <h2 className="mb-1 text-sm font-bold">Como ler</h2>
          <ul className="list-disc pl-5 space-y-1">
            {Object.entries(cat.glossary).map(([k, v]) => <li key={k}><strong>{k}:</strong> {v}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
