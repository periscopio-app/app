"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Me } from "@/lib/api";
import { RoleBanner } from "@/components/ui/RoleBanner";
import { BarChart3, Check, ShieldCheck, X } from "lucide-react";
import { AssistantChat } from "@/components/bi/AssistantChat";
import { ResultView, fmt, type Result } from "@/components/bi/ResultView";

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
interface QItem { id: string; question: string; plan: Plan | null; correctedPlan: Plan | null; rating: number | null; source: string }


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

  async function runBuilder() {
    setBuildErr(null);
    try {
      const r = await api.post<{ result: Result; summary: string }>("/api/bi/query", { plan });
      setBuilt(r);
    } catch (e) {
      setBuildErr(e instanceof Error ? e.message : "Falha na consulta");
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

      <AssistantChat
        currentPlan={plan}
        canApprove={!!cat?.canApprove}
        onPlan={(p) => setPlan(p)}
        onFeedbackSaved={loadQueue}
      />

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
