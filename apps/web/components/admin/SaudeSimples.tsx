"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Gauge, Loader2, MemoryStick, RefreshCw, ShieldAlert, Sparkles, Users } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Linha, type Point, type Resposta } from "@/components/admin/GrafanaHistoryCard";

type Periodo = "24h" | "7d";
const PERIODOS: { id: Periodo; label: string; texto: string }[] = [
  { id: "24h", label: "Últimas 24 horas", texto: "nas últimas 24 horas" },
  { id: "7d", label: "Últimos 7 dias", texto: "nos últimos 7 dias" },
];

interface Stats {
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
type RespostaStats =
  | { configured: false; reason?: string }
  | { configured: true; ok: true; range: Periodo; stats: Stats; pricing: { inputPerMtok: number | null; outputPerMtok: number | null; currency: string } }
  | { configured: true; ok: false; error: string };

type Nivel = "ok" | "atencao" | "problema" | "neutro";

const NOME_RECURSO: Record<string, string> = {
  assistente_bi: "Assistente de perguntas do BI",
  resumo_tea: "Resumo da triagem TEA",
  observacoes_re: "Sugestão de observações da RE",
  suporte: "Ajuda do suporte",
};

const n0 = (v: number) => v.toLocaleString("pt-BR");
function tempoLigado(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d} dia${d > 1 ? "s" : ""} e ${h} h` : h > 0 ? `${h} h e ${m} min` : `${m} min`;
}
const segundos = (ms: number) => (ms < 1000 ? `${(ms / 1000).toFixed(2).replace(".", ",")} s` : `${(ms / 1000).toFixed(1).replace(".", ",")} s`);

const ESTILO: Record<Nivel, { pill: string; borda: string; texto: string; Icone: typeof CheckCircle2 }> = {
  ok: { pill: "bg-emerald-50 text-emerald-800 border-emerald-200", borda: "border-[#E1E9ED]", texto: "Tudo certo", Icone: CheckCircle2 },
  atencao: { pill: "bg-amber-50 text-amber-900 border-amber-300", borda: "border-amber-300", texto: "Atenção", Icone: AlertTriangle },
  problema: { pill: "bg-red-50 text-red-800 border-red-300", borda: "border-red-300", texto: "Problema", Icone: ShieldAlert },
  neutro: { pill: "bg-slate-50 text-slate-700 border-slate-200", borda: "border-[#E1E9ED]", texto: "Informativo", Icone: Activity },
};

function Cartao({
  titulo, Icone, nivel, rotulo, valor, unidade, explicacao, children,
}: {
  titulo: string; Icone: typeof Users; nivel: Nivel; rotulo?: string; valor: string; unidade?: string; explicacao: string; children?: React.ReactNode;
}) {
  const e = ESTILO[nivel];
  const Sel = e.Icone;
  return (
    <article className={`rounded-xl border bg-white p-4 flex flex-col gap-2 ${e.borda}`}>
      <header className="flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Icone className="h-4 w-4 text-cyan-700" aria-hidden />{titulo}</h3>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${e.pill}`}>
          <Sel className="h-3 w-3" aria-hidden />{rotulo ?? e.texto}
        </span>
      </header>
      <p className="font-display text-3xl font-bold text-black leading-tight">
        {valor}{unidade && <span className="ml-1 text-sm font-normal text-slate-500">{unidade}</span>}
      </p>
      <p className="text-xs text-slate-600">{explicacao}</p>
      {children}
    </article>
  );
}

/** Painel em palavras simples para quem gere o sistema: o que está bom, o que pede atenção e quanto a IA consome. */
export function SaudeSimples() {
  const [periodo, setPeriodo] = useState<Periodo>("24h");
  const [resp, setResp] = useState<RespostaStats | null>(null);
  const [series, setSeries] = useState<Record<string, Point[]>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const stats = await api.get<RespostaStats>(`/api/admin/grafana/stats?range=${periodo}`);
      setResp(stats);
      if (stats.configured && stats.ok) {
        const alvo = ["requests_per_min", "latency_p95_ms", "memory_mb", "ai_tokens_per_hour"] as const;
        const r = await Promise.all(alvo.map((m) => api.get<Resposta>(`/api/admin/grafana/series?metric=${m}&range=${periodo}`)));
        const mapa: Record<string, Point[]> = {};
        r.forEach((x, i) => { if (x.configured && x.ok) mapa[alvo[i]] = x.points; });
        setSeries(mapa);
      }
    } catch (e) {
      setResp(null);
      setErro(e instanceof ApiError ? e.message : "Não foi possível carregar o resumo.");
    } finally {
      setCarregando(false);
    }
  }, [periodo]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const texto = PERIODOS.find((p) => p.id === periodo)!.texto;

  return (
    <section aria-label="Resumo da saúde do sistema">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Resumo para quem gere o sistema</h2>
          <p className="text-xs text-slate-500">Números do funcionamento da plataforma, sem dado de aluno. As faixas de &ldquo;Tudo certo&rdquo; e &ldquo;Atenção&rdquo; são referência de leitura da equipe técnica, não regra clínica.</p>
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Período do resumo" className="flex rounded-lg border border-[#E1E9ED] overflow-hidden">
            {PERIODOS.map((p) => (
              <button key={p.id} type="button" aria-pressed={periodo === p.id} onClick={() => setPeriodo(p.id)}
                className={`px-3 py-1.5 text-xs font-medium ${periodo === p.id ? "bg-cyan-700 text-white" : "bg-white text-slate-700"}`}>{p.label}</button>
            ))}
          </div>
          <button type="button" onClick={() => void carregar()} disabled={carregando} aria-label="Atualizar resumo" className="rounded-lg border border-[#E1E9ED] bg-white p-2 text-slate-700 disabled:opacity-50">
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>

      {erro && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}

      {!erro && resp && !resp.configured && (
        <div className="rounded-xl border border-[#E1E9ED] bg-white p-4 text-sm text-slate-600">
          O resumo ainda não está ligado. A equipe técnica precisa definir, no servidor (Render), <span className="font-mono">GRAFANA_PROM_URL</span>, <span className="font-mono">GRAFANA_PROM_USER</span> e <span className="font-mono">GRAFANA_PROM_TOKEN</span>.
          {resp.reason && <span className="mt-2 block font-semibold text-slate-800" data-testid="motivo-grafana">{resp.reason}</span>}
        </div>
      )}

      {!erro && resp && resp.configured && !resp.ok && (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Não foi possível ler os números agora.</p>
          <p className="mt-1">{resp.error}</p>
          <p className="mt-1 text-xs">Avise a equipe técnica com esta mensagem. O sistema continua funcionando normalmente.</p>
        </div>
      )}

      {!erro && resp && resp.configured && resp.ok && <Cartoes stats={resp.stats} pricing={resp.pricing} texto={texto} series={series} />}

      {!erro && !resp && carregando && <p className="text-sm text-slate-500">Carregando resumo…</p>}
    </section>
  );
}

function Cartoes({ stats, pricing, texto, series }: { stats: Stats; pricing: { inputPerMtok: number | null; outputPerMtok: number | null; currency: string }; texto: string; series: Record<string, Point[]> }) {
  const noAr = stats.uptimeSeconds !== null;
  const reqs = stats.requests;
  const erros = stats.errors5xx;
  const taxa = reqs && erros !== null ? (erros / reqs) * 100 : null;
  const nivelErros: Nivel = erros === null ? "neutro" : erros === 0 ? "ok" : taxa !== null && taxa >= 1 ? "problema" : "atencao";
  const p95 = stats.p95Ms;
  const nivelVel: Nivel = p95 === null ? "neutro" : p95 < 1000 ? "ok" : p95 < 3000 ? "atencao" : "problema";
  const rotuloVel = p95 === null ? "Sem dados" : p95 < 1000 ? "Rápido" : p95 < 3000 ? "Normal" : "Lento";

  const ai = stats.ai;
  const tokens = ai.inputTokens === null && ai.outputTokens === null ? null : (ai.inputTokens ?? 0) + (ai.outputTokens ?? 0);
  const custo =
    pricing.inputPerMtok !== null && pricing.outputPerMtok !== null && tokens !== null
      ? ((ai.inputTokens ?? 0) * pricing.inputPerMtok + (ai.outputTokens ?? 0) * pricing.outputPerMtok) / 1_000_000
      : null;
  const nivelIa: Nivel = ai.errors && ai.errors > 0 ? "atencao" : "neutro";

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Cartao titulo="O sistema está no ar?" Icone={Activity} nivel={noAr ? "ok" : "atencao"} rotulo={noAr ? "No ar" : "Sem sinal"}
        valor={noAr ? tempoLigado(stats.uptimeSeconds as number) : "Sem dados recentes"} unidade={noAr ? "sem reiniciar" : undefined}
        explicacao={noAr ? "Tempo desde a última vez que o servidor reiniciou. Reinícios acontecem a cada atualização do sistema." : "O servidor não enviou números nos últimos minutos. Se isso durar, avise a equipe técnica."} />

      <Cartao titulo="Uso do sistema" Icone={Users} nivel="neutro" rotulo="Informativo" valor={reqs === null ? "—" : n0(reqs)} unidade="pedidos"
        explicacao={`Quantas vezes as telas pediram informação ao sistema ${texto}. Mostra se o sistema está sendo usado, não quantas pessoas.`}>
        <Linha points={series.requests_per_min ?? []} label={`Pedidos por minuto ${texto}`} height="h-16" />
      </Cartao>

      <Cartao titulo="Falhas do sistema" Icone={ShieldAlert} nivel={nivelErros} valor={erros === null ? "—" : n0(erros)} unidade={erros === 1 ? "falha" : "falhas"}
        explicacao={erros === null ? "Ainda não há dados para este período." : erros === 0 ? `Nenhuma falha do servidor ${texto}.` : `São falhas do sistema, não de quem usa${taxa !== null ? ` (${taxa.toFixed(2).replace(".", ",")}% dos pedidos)` : ""}. Se aumentar, avise a equipe técnica.`} />

      <Cartao titulo="Velocidade das telas" Icone={Gauge} nivel={nivelVel} rotulo={rotuloVel} valor={p95 === null ? "—" : segundos(p95)}
        explicacao={p95 === null ? "Ainda não há dados para este período." : `9 em cada 10 pedidos respondem em até ${segundos(p95)}. Abaixo de 1 s é rápido; acima de 3 s é lento.`}>
        <Linha points={series.latency_p95_ms ?? []} label={`Tempo de resposta ${texto}`} height="h-16" />
      </Cartao>

      <Cartao titulo="Memória do servidor" Icone={MemoryStick} nivel="neutro" valor={stats.memoryMb === null ? "—" : n0(stats.memoryMb)} unidade="MB em uso"
        explicacao="Quanto da memória do servidor o sistema está usando agora. Se subir sem parar por vários dias, avise a equipe técnica.">
        <Linha points={series.memory_mb ?? []} label={`Memória usada ${texto}`} height="h-16" />
      </Cartao>

      <Cartao titulo="Uso de inteligência artificial" Icone={Sparkles} nivel={nivelIa} rotulo={nivelIa === "atencao" ? "Com falhas" : tokens === null || tokens === 0 ? "Sem uso" : "Informativo"}
        valor={tokens === null ? "0" : n0(tokens)} unidade="tokens"
        explicacao={tokens === null || tokens === 0 ? `Nenhuma chamada à IA ${texto}. Tokens são o “combustível” cobrado pelo provedor: quanto mais texto enviado e gerado, mais tokens.` : `Tokens gastos ${texto}: ${n0(ai.inputTokens ?? 0)} enviados e ${n0(ai.outputTokens ?? 0)} gerados, em ${n0(ai.calls ?? 0)} chamada${(ai.calls ?? 0) === 1 ? "" : "s"}${ai.errors ? ` (${n0(ai.errors)} com erro)` : ""}.`}>
        {custo !== null ? (
          <p className="text-sm font-semibold text-slate-800">Custo estimado: {pricing.currency} {custo.toFixed(2).replace(".", ",")}
            <span className="ml-1 text-[11px] font-normal text-slate-500">(com os preços definidos pela equipe técnica)</span></p>
        ) : (
          <p className="text-[11px] text-slate-500">Para ver o custo em dinheiro, a equipe técnica define o preço por milhão de tokens do provedor no servidor.</p>
        )}
        {ai.byFeature.length > 0 && (
          <ul className="text-xs text-slate-700 divide-y divide-[#E1E9ED]">
            {ai.byFeature.slice(0, 4).map((f) => (
              <li key={f.feature} className="flex justify-between gap-2 py-1"><span>{NOME_RECURSO[f.feature] ?? f.feature}</span><span className="tabular-nums font-medium">{n0(f.tokens)}</span></li>
            ))}
          </ul>
        )}
        {ai.byModel.length > 0 && (
          <p className="text-[11px] text-slate-500">Modelos: {ai.byModel.slice(0, 3).map((m) => `${m.provider} ${m.model} (${n0(m.tokens)})`).join("; ")}</p>
        )}
        <Linha points={series.ai_tokens_per_hour ?? []} label={`Tokens de IA por hora ${texto}`} height="h-16" />
      </Cartao>
    </div>
  );
}
