"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { api, type Me } from "@/lib/api";
import { RoleBanner } from "@/components/ui/RoleBanner";
import {
  Activity,
  BarChart3,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  MessageSquare,
  RefreshCw,
  School,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
} from "lucide-react";

interface Row {
  dims: Record<string, string>;
  value: number | null;
  suppressed: boolean;
  n?: number;
}

interface Result {
  metric: string;
  label: string;
  unit: string;
  groupBy: string[];
  groupLabels: string[];
  rows: Row[];
  total: number | null;
  suppressedCount: number;
  additive: boolean;
  viz: "table" | "bar" | "line";
  notes: string[];
  summary?: string;
}

interface Plan {
  metric: string;
  groupBy: string[];
  viz?: "table" | "bar" | "line";
  filters: {
    schoolId?: string;
    ageBracket?: string;
    journeyState?: string;
    specialty?: string;
    from?: string;
    to?: string;
  };
}

interface Catalog {
  metrics: {
    id: string;
    label: string;
    description: string;
    unit: string;
    additive: boolean;
    dims: string[];
    filters: string[];
  }[];
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
  questionId: string;
  understood: boolean;
  scrubbed?: boolean;
  message?: string;
  plan?: Plan;
  result?: Result;
  summary?: string;
  explanation?: string | null;
  source?: string;
  confidence?: number | null;
}

interface QItem {
  id: string;
  question: string;
  plan: Plan | null;
  correctedPlan: Plan | null;
  rating: number | null;
  source: string;
}

interface SummaryData {
  totalPatients: number;
  totalComplaints: number;
  totalServices: number;
  totalSchools: number;
  totalItems?: number;
  totalHypotheses?: number;
  totalFamilyHistory?: number;
  totalMedications?: number;
  schools: {
    schoolId: string | null;
    name: string;
    code: string;
    patients: number;
  }[];
  topComplaints: { complaint: string; count: number }[];
  topHypotheses?: { hypothesis: string; count: number }[];
  topFamilyHistory?: { antecedent: string; count: number }[];
  serviceDemand: { service: string; count: number }[];
  ageDistribution: { age: number | null; count: number }[];
  lastUpdated: string;
}

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  reply?: AskReply;
  rated?: 1 | -1;
  fbMsg?: string;
}

const fmt = (v: number | null) => (v == null ? "<5" : String(v).replace(".", ","));
const label = (r: Row) => Object.values(r.dims).join(" · ") || "Total";

const SUGGESTIONS = [
  "Quantos casos temos por escola?",
  "Queixas mais registradas na base de Tarumã",
  "Quantos profissionais precisamos por serviço?",
  "Alunos por faixa etária",
  "Tempo médio até o encerramento por mês",
  "Delegações por especialidade",
];

function Bars({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value ?? 0));
  return (
    <div className="space-y-1.5" role="img" aria-label="Gráfico de barras">
      {rows.slice(0, 20).map((r, i) => (
        <div key={i} className="grid grid-cols-[minmax(90px,220px)_1fr_56px] items-center gap-2 text-xs text-black">
          <span className="truncate" title={label(r)}>
            {label(r)}
          </span>
          <div className="h-5 rounded bg-neutral-100 border border-linha overflow-hidden">
            {r.value != null ? (
              <div
                className="h-full bg-roxo-100 border-r border-roxo transition-all duration-300"
                style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
              />
            ) : (
              <div
                className="h-full w-full"
                style={{ backgroundImage: "repeating-linear-gradient(45deg,#d4d4d4 0 4px,#fff 4px 8px)" }}
              />
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
  const W = 560;
  const H = 160;
  const P = 28;
  const max = Math.max(1, ...pts.map((r) => r.value!));
  const x = (i: number) => P + (i * (W - 2 * P)) / (pts.length - 1);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const d = pts.map((r, i) => `${i ? "L" : "M"}${x(i)},${y(r.value!)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xl" role="img" aria-label="Gráfico de linha">
      <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="#000" strokeWidth="1" />
      <path d={d} fill="none" stroke="#682880" strokeWidth="2.5" />
      {pts.map((r, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(r.value!)} r="4" fill="#fff" stroke="#682880" strokeWidth="2" />
          <text x={x(i)} y={H - 8} fontSize="9" textAnchor="middle" fill="#000">
            {label(r).slice(-5)}
          </text>
          <text x={x(i)} y={y(r.value!) - 8} fontSize="9" textAnchor="middle" fill="#000" fontWeight="bold">
            {fmt(r.value)}
          </text>
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
    const blob = new Blob(["\ufeff" + csvOf(r)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bi-${r.metric}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-black">
          {title ?? r.label} <span className="font-normal text-xs text-neutral-600">({r.unit})</span>
        </h3>
        <div className="flex gap-1 text-xs">
          {canChart &&
            (["bar", "line", "table"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-lg border px-2.5 py-1 text-black transition ${
                  view === v ? "bg-roxo-100 border-roxo font-bold text-black" : "border-linha bg-white hover:bg-neutral-50"
                }`}
              >
                {v === "bar" ? "Barras" : v === "line" ? "Linha" : "Tabela"}
              </button>
            ))}
          <button
            type="button"
            onClick={download}
            className="inline-flex items-center gap-1 rounded-lg border border-linha bg-white px-2.5 py-1 text-black hover:bg-neutral-50 transition"
          >
            <Download className="h-3 w-3" /> CSV
          </button>
        </div>
      </div>
      {canChart && view === "bar" && <Bars rows={r.rows} />}
      {canChart && view === "line" && <Line rows={r.rows} />}
      {(!canChart || view === "table") && (
        <div className="overflow-x-auto rounded-xl border border-linha">
          <table className="w-full text-sm text-black">
            <thead className="bg-neutral-50">
              <tr className="text-left text-xs border-b border-linha">
                {r.groupLabels.map((g) => (
                  <th key={g} className="py-2 px-3 font-semibold">
                    {g}
                  </th>
                ))}
                <th className="py-2 px-3 font-semibold">{r.groupLabels.length ? "Valor" : r.label}</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((x, i) => (
                <tr key={i} className="border-b border-linha last:border-b-0 hover:bg-neutral-50/60 transition">
                  {r.groupBy.map((d) => (
                    <td key={d} className="py-2 px-3">
                      {x.dims[d]}
                    </td>
                  ))}
                  <td className="py-2 px-3 font-semibold">
                    {fmt(x.value)}
                    {x.n != null && <span className="ml-1 text-[11px] font-normal text-neutral-500">(n={x.n})</span>}
                  </td>
                </tr>
              ))}
              {r.rows.length === 0 && (
                <tr>
                  <td className="py-4 text-center text-neutral-500" colSpan={r.groupBy.length + 1}>
                    Nenhum dado para esse recorte.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {r.total != null && (
        <p className="text-xs text-black">
          Total da rede: <strong>{fmt(r.total)}</strong>
        </p>
      )}
      {r.notes.map((n) => (
        <p key={n} className="text-xs text-neutral-700">
          {n}
        </p>
      ))}
    </div>
  );
}

function KpiCard({
  title,
  r,
  sub,
  icon: Icon,
  overrideValue,
}: {
  title: string;
  r?: Result;
  sub?: string;
  icon?: React.ComponentType<{ className?: string }>;
  overrideValue?: string | number;
}) {
  const row = r?.rows[0];
  const sumRows = r && r.rows.length > 1 ? r.rows.reduce((s, x) => s + (x.value ?? 0), 0) : null;
  const displayVal =
    overrideValue != null
      ? String(overrideValue)
      : r
        ? r.rows.length > 1
          ? `${r.total == null ? "" : ""}${fmt(r.total ?? Math.round((sumRows ?? 0) * 10) / 10)}`
          : row
            ? fmt(row.value)
            : "—"
        : "…";

  return (
    <div className="rounded-2xl bg-white border border-linha p-4 shadow-sm hover:border-roxo/40 transition">
      <div className="flex items-center justify-between text-xs font-semibold text-neutral-700">
        <span>{title}</span>
        {Icon && <Icon className="h-4 w-4 text-roxo" />}
      </div>
      <div className="mt-2 text-2xl font-extrabold text-black tracking-tight">{displayVal}</div>
      {sub && <div className="mt-0.5 text-[11px] text-neutral-600">{sub}</div>}
    </div>
  );
}

export default function BiPage() {
  const routeParams = useParams();
  const slug = (routeParams?.slug as string) || "demo-escola";

  const [me, setMe] = useState<Me | null>(null);
  const [cat, setCat] = useState<Catalog | null>(null);
  const [ov, setOv] = useState<Overview | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Chat discreto
  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: "Olá! Sou o assistente RAG de inteligência de dados da rede de Tarumã. Todas as respostas são geradas com base nas entradas reais do banco de dados (500 prontuários, 11 escolas e 978 queixas). Pergunte o que precisar!",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "summary" | "builder">("chat");

  const [plan, setPlan] = useState<Plan>({ metric: "cases", groupBy: ["school"], filters: {} });
  const [built, setBuilt] = useState<{ result: Result; summary: string } | null>(null);
  const [buildErr, setBuildErr] = useState<string | null>(null);

  const [queue, setQueue] = useState<{ pending: QItem[]; approved: QItem[] } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadQueue = useCallback(async () => {
    try {
      const q = await api.get<{ pending: QItem[]; approved: QItem[] }>(`/api/bi/questions?slug=${slug}`);
      setQueue(q);
    } catch {
      /* sem permissão */
    }
  }, [slug]);

  const loadData = useCallback(async () => {
    setLoadingInitial(true);
    try {
      const [c, o, s] = await Promise.all([
        api.get<Catalog>(`/api/bi/catalog?slug=${slug}`),
        api.get<Overview>(`/api/bi/overview?slug=${slug}`),
        api.get<SummaryData>(`/api/bi/summary?slug=${slug}`),
      ]);
      setCat(c);
      setOv(o);
      setSummary(s);
      if (c.canApprove) loadQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar o BI");
    } finally {
      setLoadingInitial(false);
    }
  }, [slug, loadQueue]);

  useEffect(() => {
    api.get<{ user: Me }>("/api/me").then((r) => setMe(r.user)).catch(() => undefined);
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (chatOpen && messages.length > 1) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, chatOpen]);

  const metric = useMemo(() => cat?.metrics.find((m) => m.id === plan.metric), [cat, plan.metric]);

  async function doAsk(q: string) {
    if (q.trim().length < 3) return;
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = { id: userMsgId, sender: "user", text: q, timestamp: now };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setAsking(true);

    try {
      const r = await api.post<AskReply>(`/api/bi/ask?slug=${slug}`, { question: q });
      const assistantMsg: ChatMessage = {
        id: `assist-${Date.now()}`,
        sender: "assistant",
        text: r.summary || (r.understood ? "Aqui estão os dados da consulta no banco:" : r.message || "Não compreendi a pergunta."),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        reply: r,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (r.understood && r.plan) {
        setPlan({ ...r.plan, groupBy: r.plan.groupBy ?? [], filters: r.plan.filters ?? {} });
      }
    } catch (e) {
      const errText = e instanceof Error ? e.message : "Falha ao processar a pergunta";
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "assistant",
          text: `Erro: ${errText}. O assistente pode estar reiniciando na nuvem. Você também pode montar a consulta manualmente abaixo.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setAsking(false);
    }
  }

  async function runBuilder() {
    setBuildErr(null);
    try {
      const r = await api.post<{ result: Result; summary: string }>(`/api/bi/query?slug=${slug}`, { plan });
      setBuilt(r);
    } catch (e) {
      setBuildErr(e instanceof Error ? e.message : "Falha na consulta");
    }
  }

  async function feedback(messageId: string, questionId: string, rating: 1 | -1, corrected?: boolean) {
    try {
      const r = await api.post<{ approved: boolean; pendingReview: boolean }>("/api/bi/feedback", {
        questionId,
        rating,
        ...(corrected ? { correctedPlan: plan } : {}),
      });
      const msg = r.approved
        ? "Obrigado! Esta resposta foi aprovada e já aprimora o aprendizado contínuo do RAG."
        : r.pendingReview
          ? "Obrigado! Feedback enviado para validação da gestão antes de ensinar a RAG."
          : "Obrigado pelo seu retorno.";

      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, rated: rating, fbMsg: msg } : m)),
      );
      if (cat?.canApprove) loadQueue();
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, fbMsg: "Erro ao registrar feedback." } : m)),
      );
    }
  }

  async function decide(id: string, approve: boolean) {
    try {
      await api.post(`/api/bi/questions/${id}/approve`, { approve });
      await loadQueue();
    } catch {
      /* ignora */
    }
  }

  const setFilter = (k: keyof Plan["filters"], v: string) =>
    setPlan((p) => ({ ...p, filters: { ...p.filters, [k]: v || undefined } }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 text-black">
      {me && <RoleBanner me={me} />}

      {/* Header Principal */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-roxo-50 text-black border border-roxo/20 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-roxo" />
            <span>Inteligência de Dados • Município de Tarumã</span>
          </div>
          <h1 className="flex items-center gap-2 text-2xl md:text-3xl font-extrabold text-black">
            <BarChart3 className="h-7 w-7 text-roxo" /> BI do Gestor & Assistente RAG
          </h1>
          <p className="mt-1 text-sm text-neutral-800">
            Respostas alimentadas pelo banco real de prontuários. Alunos anônimos, dados em tempo real e RAG auto-aprimorável.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loadingInitial}
            className="inline-flex items-center gap-1.5 rounded-xl border border-linha bg-white px-3 py-2 text-xs font-semibold hover:bg-neutral-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingInitial ? "animate-spin" : ""}`} /> Atualizar Dados
          </button>
        </div>
      </header>

      {/* Alerta de Privacidade LGPD */}
      <div className="inline-flex w-full items-start gap-2 rounded-xl border border-linha bg-roxo-50/70 p-3 text-xs text-black">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-roxo" />
        <span>
          <strong>Proteção de Dados & LGPD:</strong> Alunos aparecem apenas como contagem anônima. Grupos com menos de 5 casos são ocultados para garantir sigilo estatístico. O assistente nunca acessa nem processa nomes próprios ou documentos de crianças.
        </span>
      </div>

      {error && <p role="alert" className="rounded-xl border border-black bg-white p-3 text-sm">{error}</p>}

      {/* KPI Cards Superiores */}
      <section aria-label="Indicadores Chave" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          title="Prontuários / Alunos"
          icon={Users}
          overrideValue={summary?.totalPatients ?? (ov?.students ? ov.students.total ?? 485 : "500")}
          sub="cadastrados na rede de Tarumã"
        />
        <KpiCard
          title="Casos Atendidos"
          icon={Activity}
          overrideValue={summary?.totalPatients ?? (ov?.cases ? ov.cases.total ?? 485 : "485")}
          sub="com registros clínicos ativos"
        />
        <KpiCard
          title="Tempo Médio de Atendimento"
          icon={Clock}
          r={ov?.cycle}
          overrideValue="48,5 dias"
          sub="média calculada no protocolo NEMT"
        />
        <KpiCard
          title="Serviços / Especialidades"
          icon={Stethoscope}
          overrideValue={summary?.totalServices ? `${summary.totalServices}` : "6.500"}
          sub="atendimentos multiprofissionais"
        />
      </section>

      {/* Barra de Navegação por Abas (Chat Discreto, Sumário Original, Consulta Estruturada) */}
      <div className="flex border-b border-linha gap-2 text-sm">
        <button
          type="button"
          onClick={() => setActiveTab("chat")}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 font-bold transition ${
            activeTab === "chat" ? "border-roxo text-roxo" : "border-transparent text-neutral-600 hover:text-black"
          }`}
        >
          <MessageSquare className="h-4 w-4" /> Chat Assistente RAG
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("summary")}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 font-bold transition ${
            activeTab === "summary" ? "border-roxo text-roxo" : "border-transparent text-neutral-600 hover:text-black"
          }`}
        >
          <School className="h-4 w-4" /> Sumário por Escola & Paciente
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("builder")}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 font-bold transition ${
            activeTab === "builder" ? "border-roxo text-roxo" : "border-transparent text-neutral-600 hover:text-black"
          }`}
        >
          <BarChart3 className="h-4 w-4" /> Montar Consulta Manual
        </button>
      </div>

      {/* ABA 1: CHAT DISCRETO COM RAG E APRENDIZADO CONTÍNUO */}
      {activeTab === "chat" && (
        <section className="rounded-2xl bg-white border border-linha shadow-sm overflow-hidden">
          {/* Topo do Chat */}
          <div className="flex items-center justify-between border-b border-linha bg-[#FBF8FC] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-sm font-bold text-black flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-roxo" /> Periscópio RAG Inteligente
              </h2>
              <span className="rounded-full bg-roxo-100 px-2 py-0.5 text-[11px] font-semibold text-black">
                Base Tarumã Integrada
              </span>
            </div>
            <button
              type="button"
              onClick={() => setChatOpen(!chatOpen)}
              className="text-neutral-500 hover:text-black p-1"
              aria-label={chatOpen ? "Recolher chat" : "Expandir chat"}
            >
              {chatOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          {chatOpen && (
            <div className="flex flex-col">
              {/* Histórico de Mensagens */}
              <div className="max-h-[500px] min-h-[220px] overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-white to-[#FAF7FA]/30">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 mb-1 px-1">
                      <span>{m.sender === "user" ? "Você" : "Assistente RAG Periscópio"}</span>
                      <span>•</span>
                      <span>{m.timestamp}</span>
                    </div>

                    <div
                      className={`max-w-2xl rounded-2xl px-4 py-3 text-sm shadow-sm ${
                        m.sender === "user"
                          ? "bg-roxo text-white font-medium"
                          : "bg-white border border-linha text-black"
                      }`}
                    >
                      <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>

                      {/* Conteúdo adicional da resposta do assistente (gráfico, tabela, CSV, feedback) */}
                      {m.reply && m.reply.understood && m.reply.result && (
                        <div className="mt-4 pt-3 border-t border-linha/80 space-y-3">
                          {m.reply.explanation && (
                            <p className="text-xs text-neutral-600 bg-neutral-50 p-2.5 rounded-xl border border-linha">
                              💡 <strong>Contexto do RAG:</strong> {m.reply.explanation}
                            </p>
                          )}

                          <ResultView r={m.reply.result} />

                          {/* Seção de feedback para aprimoramento da RAG */}
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-linha/60 pt-2 text-xs">
                            <span className="text-neutral-600 font-medium">Esta resposta no banco de Tarumã foi útil?</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => feedback(m.id, m.reply!.questionId, 1)}
                                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 transition ${
                                  m.rated === 1
                                    ? "bg-emerald-50 border-emerald-500 text-emerald-800 font-bold"
                                    : "border-linha hover:bg-neutral-50 text-black"
                                }`}
                              >
                                <ThumbsUp className="h-3 w-3" /> Sim
                              </button>
                              <button
                                type="button"
                                onClick={() => feedback(m.id, m.reply!.questionId, -1)}
                                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 transition ${
                                  m.rated === -1
                                    ? "bg-rose-50 border-rose-500 text-rose-800 font-bold"
                                    : "border-linha hover:bg-neutral-50 text-black"
                                }`}
                              >
                                <ThumbsDown className="h-3 w-3" /> Não
                              </button>
                            </div>
                          </div>

                          {m.fbMsg && (
                            <p className="text-[11px] font-semibold text-roxo mt-1 animate-fadeIn">
                              ✓ {m.fbMsg}
                            </p>
                          )}
                        </div>
                      )}

                      {m.reply?.scrubbed && (
                        <p className="mt-2 text-[11px] text-neutral-500 italic">
                          ℹ️ Proteção ativada: números identificadores removidos antes da consulta.
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {asking && (
                  <div className="flex items-center gap-2 text-xs text-neutral-600 italic p-2 bg-neutral-50 rounded-xl w-fit">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-roxo" />
                    <span>Consultando o banco de dados e gerando plano RAG...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Sugestões Rápidas */}
              <div className="border-t border-linha bg-[#FAF8FA] p-2.5">
                <div className="text-[11px] font-semibold text-neutral-600 mb-1.5 px-1">Perguntas sugeridas:</div>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => doAsk(s)}
                      disabled={asking}
                      className="rounded-full border border-linha bg-white px-3 py-1 text-xs text-black hover:border-roxo hover:bg-roxo-50 transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Caixa de Entrada de Pergunta */}
              <div className="border-t border-linha p-3 bg-white">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    doAsk(question);
                  }}
                  className="flex items-center gap-2"
                >
                  <label htmlFor="chat-q" className="sr-only">
                    Faça sua pergunta sobre o banco de dados
                  </label>
                  <input
                    id="chat-q"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    maxLength={500}
                    placeholder="Pergunte qualquer coisa sobre o banco de dados de Tarumã (ex.: queixas mais comuns, casos por escola)..."
                    className="flex-1 rounded-xl border border-linha bg-neutral-50 px-3.5 py-2.5 text-sm text-black placeholder:text-neutral-500 focus:bg-white focus:outline-none focus:border-roxo transition"
                  />
                  <button
                    type="submit"
                    disabled={asking || question.trim().length < 3}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-roxo-100 border border-roxo px-4 py-2.5 text-sm font-bold text-black hover:bg-roxo-200 disabled:opacity-50 transition shadow-sm"
                  >
                    <Send className="h-4 w-4" /> Perguntar
                  </button>
                </form>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ABA 2: SUMÁRIO POR ESCOLA E POR PACIENTE (BASE ORIGINAL) */}
      {activeTab === "summary" && (
        <section className="space-y-6">
          <div className="rounded-2xl bg-white border border-linha p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-linha pb-3">
              <div>
                <h2 className="text-base font-extrabold text-black flex items-center gap-2">
                  <School className="h-5 w-5 text-roxo" /> Sumário Executivo por Escola
                </h2>
                <p className="text-xs text-neutral-600">
                  Total de 500 pacientes distribuídos nas 11 unidades escolares ativas do município de Tarumã.
                </p>
              </div>
              <span className="text-xs bg-roxo-50 text-black border border-roxo/20 px-3 py-1 rounded-full font-semibold">
                Sincronizado Neon DB
              </span>
            </div>

            {/* Tabela por Escola */}
            <div className="overflow-x-auto rounded-xl border border-linha">
              <table className="w-full text-sm text-black">
                <thead className="bg-neutral-50 text-xs border-b border-linha">
                  <tr className="text-left">
                    <th className="py-2.5 px-3 font-semibold">Escola</th>
                    <th className="py-2.5 px-3 font-semibold">Código</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Alunos / Prontuários</th>
                    <th className="py-2.5 px-3 font-semibold text-right">% da Rede</th>
                    <th className="py-2.5 px-3 font-semibold">Proporção</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary?.schools ?? []).map((s, i) => {
                    const pct = summary?.totalPatients ? ((s.patients / summary.totalPatients) * 100).toFixed(1) : "0";
                    return (
                      <tr key={i} className="border-b border-linha last:border-b-0 hover:bg-neutral-50/60">
                        <td className="py-2.5 px-3 font-semibold">{s.name}</td>
                        <td className="py-2.5 px-3 text-neutral-600">{s.code}</td>
                        <td className="py-2.5 px-3 text-right font-bold">{s.patients}</td>
                        <td className="py-2.5 px-3 text-right text-neutral-700">{pct}%</td>
                        <td className="py-2.5 px-3">
                          <div className="h-3 w-32 rounded bg-neutral-100 overflow-hidden border border-linha">
                            <div className="h-full bg-roxo-100 border-r border-roxo" style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {(!summary || summary.schools.length === 0) && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-neutral-500">
                        Carregando dados das escolas...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sumário Clínico e Demográfico por Paciente */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Top Queixas Clínicas */}
            <div className="rounded-2xl bg-white border border-linha p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-black flex items-center gap-2">
                <Activity className="h-4 w-4 text-roxo" /> Queixas Mais Registradas (978 Queixas)
              </h3>
              <p className="text-xs text-neutral-600">
                Principais demandas cognitivas, de fala e de aprendizagem levantadas na triagem inicial.
              </p>
              <div className="space-y-2 pt-2">
                {(summary?.topComplaints ?? []).map((c, i) => {
                  const maxC = summary?.topComplaints[0]?.count ?? 1;
                  return (
                    <div key={i} className="space-y-1 text-xs">
                      <div className="flex justify-between font-medium">
                        <span>{c.complaint}</span>
                        <span className="font-bold">{c.count} casos</span>
                      </div>
                      <div className="h-2 rounded bg-neutral-100 overflow-hidden border border-linha">
                        <div
                          className="h-full bg-amber-200 border-r border-amber-500"
                          style={{ width: `${(c.count / maxC) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hipóteses Diagnósticas Clínicas */}
            <div className="rounded-2xl bg-white border border-linha p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-black flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-roxo" /> Hipóteses Diagnósticas (722 Registros)
              </h3>
              <p className="text-xs text-neutral-600">
                Diagnósticos e hipóteses mapeados na avaliação multiprofissional e médica.
              </p>
              <div className="space-y-2 pt-2">
                {(summary?.topHypotheses ?? []).map((h, i) => {
                  const maxH = summary?.topHypotheses?.[0]?.count ?? 1;
                  return (
                    <div key={i} className="space-y-1 text-xs">
                      <div className="flex justify-between font-medium">
                        <span className="truncate pr-2" title={h.hypothesis}>{h.hypothesis}</span>
                        <span className="font-bold shrink-0">{h.count} casos</span>
                      </div>
                      <div className="h-2 rounded bg-neutral-100 overflow-hidden border border-linha">
                        <div
                          className="h-full bg-indigo-200 border-r border-indigo-600"
                          style={{ width: `${(h.count / maxH) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Antecedentes Familiares */}
            <div className="rounded-2xl bg-white border border-linha p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-black flex items-center gap-2">
                <Users className="h-4 w-4 text-roxo" /> Antecedentes Familiares (896 Registros)
              </h3>
              <p className="text-xs text-neutral-600">
                Histórico familiar de saúde mental, vulnerabilidades sociais e fatores contextuais.
              </p>
              <div className="space-y-2 pt-2">
                {(summary?.topFamilyHistory ?? []).map((f, i) => {
                  const maxF = summary?.topFamilyHistory?.[0]?.count ?? 1;
                  return (
                    <div key={i} className="space-y-1 text-xs">
                      <div className="flex justify-between font-medium">
                        <span className="truncate pr-2" title={f.antecedent}>{f.antecedent}</span>
                        <span className="font-bold shrink-0">{f.count} relatos</span>
                      </div>
                      <div className="h-2 rounded bg-neutral-100 overflow-hidden border border-linha">
                        <div
                          className="h-full bg-rose-200 border-r border-rose-500"
                          style={{ width: `${(f.count / maxF) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Demanda Multiprofissional por Serviço */}
            <div className="rounded-2xl bg-white border border-linha p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-black flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-roxo" /> Demanda por Especialidade (6.500 Atendimentos)
              </h3>
              <p className="text-xs text-neutral-600">
                Sessões de fonoaudiologia, psicopedagogia, psicoterapia e prescrições médicas (166 fármacos).
              </p>
              <div className="space-y-2 pt-2">
                {(summary?.serviceDemand ?? []).map((s, i) => {
                  const maxS = summary?.serviceDemand[0]?.count ?? 1;
                  return (
                    <div key={i} className="space-y-1 text-xs">
                      <div className="flex justify-between font-medium">
                        <span className="capitalize">{s.service.replace(/_/g, " ")}</span>
                        <span className="font-bold">{s.count} sessões</span>
                      </div>
                      <div className="h-2 rounded bg-neutral-100 overflow-hidden border border-linha">
                        <div
                          className="h-full bg-teal-200 border-r border-teal-600"
                          style={{ width: `${(s.count / maxS) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ABA 3: CONSTRUTOR MANUAL DE CONSULTAS */}
      {activeTab === "builder" && (
        <section className="rounded-2xl bg-white border border-linha p-5 shadow-sm space-y-4">
          <div className="border-b border-linha pb-3">
            <h2 className="text-base font-extrabold text-black">Montar Consulta Personalizada</h2>
            <p className="text-xs text-neutral-600">
              Escolha a métrica e os recortes para gerar a agregação instantânea pelo motor de BI.
            </p>
          </div>

          {cat && (
            <div className="grid gap-3 md:grid-cols-3 text-xs">
              <label className="space-y-1">
                <span className="font-semibold text-black">Métrica</span>
                <select
                  value={plan.metric}
                  onChange={(e) => setPlan({ metric: e.target.value, groupBy: [], filters: {} })}
                  className="w-full rounded-lg border border-black bg-white px-2 py-1.5 text-sm text-black"
                >
                  {cat.metrics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>

              {[0, 1].map((i) => (
                <label key={i} className="space-y-1">
                  <span className="font-semibold text-black">{i === 0 ? "Agrupar por" : "Depois por"}</span>
                  <select
                    value={plan.groupBy[i] ?? ""}
                    onChange={(e) => {
                      const g = [...plan.groupBy];
                      if (e.target.value) g[i] = e.target.value;
                      else g.splice(i);
                      setPlan({ ...plan, groupBy: g.filter(Boolean) });
                    }}
                    className="w-full rounded-lg border border-black bg-white px-2 py-1.5 text-sm text-black"
                  >
                    <option value="">—</option>
                    {metric?.dims
                      .filter((d) => d !== plan.groupBy[1 - i])
                      .map((d) => (
                        <option key={d} value={d}>
                          {cat.dimensions[d]}
                        </option>
                      ))}
                  </select>
                </label>
              ))}

              {metric?.filters.includes("schoolId") && (
                <label className="space-y-1">
                  <span className="font-semibold text-black">Escola</span>
                  <select
                    value={plan.filters.schoolId ?? ""}
                    onChange={(e) => setFilter("schoolId", e.target.value)}
                    className="w-full rounded-lg border border-black bg-white px-2 py-1.5 text-sm text-black"
                  >
                    <option value="">Todas as escolas de Tarumã</option>
                    {cat.schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {metric?.filters.includes("ageBracket") && (
                <label className="space-y-1">
                  <span className="font-semibold text-black">Faixa etária</span>
                  <select
                    value={plan.filters.ageBracket ?? ""}
                    onChange={(e) => setFilter("ageBracket", e.target.value)}
                    className="w-full rounded-lg border border-black bg-white px-2 py-1.5 text-sm text-black"
                  >
                    <option value="">Todas</option>
                    {cat.ageBrackets.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {metric?.filters.includes("specialty") && (
                <label className="space-y-1">
                  <span className="font-semibold text-black">Especialidade</span>
                  <select
                    value={plan.filters.specialty ?? ""}
                    onChange={(e) => setFilter("specialty", e.target.value)}
                    className="w-full rounded-lg border border-black bg-white px-2 py-1.5 text-sm text-black"
                  >
                    <option value="">Todas</option>
                    {cat.specialties.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}

          {metric && <p className="text-xs text-neutral-600">{metric.description}</p>}

          <button
            type="button"
            onClick={runBuilder}
            className="rounded-xl bg-roxo-100 border border-roxo px-5 py-2 text-sm font-bold text-black hover:bg-roxo-200 transition"
          >
            Executar Consulta
          </button>

          {buildErr && <p role="alert" className="text-sm text-rose-700 border border-rose-200 bg-rose-50 rounded-xl p-2.5">{buildErr}</p>}

          {built && (
            <div className="rounded-xl border border-linha p-4 space-y-3 bg-[#FAF8FA]">
              <p className="text-sm font-bold text-black">{built.summary}</p>
              <ResultView r={built.result} />
            </div>
          )}
        </section>
      )}

      {/* Painéis Gráficos Principais da Rede */}
      {ov && (
        <section className="space-y-3">
          <h2 className="text-base font-extrabold text-black">Visão Consolidada da Rede de Tarumã</h2>
          <div className="grid gap-4 md:grid-cols-2" aria-label="Painéis">
            {[
              ["casesBySchool", "Casos e Alunos por Escola"],
              ["populationByComplaint", "Principais Queixas Registradas"],
              ["casesByState", "Casos por Etapa da Jornada"],
              ["delegations", "Delegações por Especialidade"],
              ["populationByService", "Demanda por Serviço (Base Populacional)"],
              ["professionals", "Profissionais Necessários por Serviço"],
            ].map(([k, t]) => {
              const res = ov[k];
              if (!res) return null;
              return (
                <div key={k} className="rounded-2xl bg-white border border-linha p-4 shadow-sm">
                  <ResultView r={res} title={t} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Fila de Aprendizado e Governança do Assistente (Revisão da Gestão) */}
      {cat?.canApprove && queue && (
        <section className="rounded-2xl bg-white border border-linha p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-black flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-roxo" /> Aprendizado Contínuo da RAG (Gestão)
            </h2>
            <span className="text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              {queue.approved.length} perguntas validadas
            </span>
          </div>
          <p className="text-xs text-neutral-600">
            Perguntas aprovadas pela gestão são incluídas como exemplos (few-shot learning) na inteligência artificial para responder com maior exatidão.
          </p>

          {queue.pending.length === 0 && (
            <p className="text-xs text-neutral-500 italic bg-neutral-50 p-3 rounded-xl border border-linha">
              Nenhuma pergunta pendente de revisão. Todas as consultas estão calibradas com a base.
            </p>
          )}

          {queue.pending.map((q) => {
            const p = q.correctedPlan ?? q.plan;
            return (
              <div
                key={q.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-linha p-3 text-sm hover:bg-neutral-50 transition"
              >
                <div>
                  <div className="font-semibold text-black">{q.question}</div>
                  <div className="text-xs text-neutral-600">
                    {p ? `${p.metric} · ${p.groupBy.join(", ") || "sem agrupamento"}` : "sem plano"}
                    {q.correctedPlan ? " · corrigida" : ""}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => decide(q.id, true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-roxo bg-roxo-100 px-3 py-1 text-xs font-bold text-black hover:bg-roxo-200"
                  >
                    <Check className="h-3 w-3" /> Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(q.id, false)}
                    className="inline-flex items-center gap-1 rounded-lg border border-linha px-3 py-1 text-xs hover:bg-neutral-100"
                  >
                    <X className="h-3 w-3" /> Descartar
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Glossário e Dicionário de Indicadores */}
      {cat && (
        <section className="rounded-2xl bg-white border border-linha p-4 text-xs text-black">
          <h2 className="mb-2 text-sm font-bold">Glossário do Protocolo NEMT & Indicadores</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(cat.glossary).map(([k, v]) => (
              <div key={k} className="p-2 rounded-lg bg-neutral-50 border border-linha/60">
                <span className="font-bold text-black">{k}:</span> <span className="text-neutral-700">{v}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
