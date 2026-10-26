"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, CheckCircle, Clock, Lock, RotateCcw, Send, SkipForward } from "lucide-react";
import {
  DIFICULDADES_PERSISTENTES_OPCOES,
  FOGAP_DESTINOS,
  RE_FORMS,
  RE_PASSOS,
  SNAP4_FORM_CODE,
  SNAP4_ITENS,
  SNAP4_CRITERIOS_TEXTO,
  SNAP4_FONTE_VERSAO,
  calcularContagem,
  SNAP4_OPCOES,
  SUMARIO_TEXTO_MAX,
  encaminhadosVazio,
  faixaEmUso,
  faixaPadraoPorMeses,
  itensDaFaixa,
  isReFormId,
  lacunasDoSumario,
  makeSnap4PayloadVazio,
  situacaoDaJornada,
  sumarioComPadroes,
  type FaixaFogap,
  type FogapSecaoSumario,
  type JornadaSituacao,
  type Lacuna,
  type ReFormId,
  type RePassoEstado,
  type RePassoId,
  type ReJornadaMeta,
  type Snap4Payload,
  type EscalasSumario,
} from "@periscopio/shared";
import { ApiError, api } from "@/lib/api";
import { ConfirmDialog, Modal, buttonClass } from "@/components/ui";
import { TeaScreeningPanel } from "@/components/dashboard/TeaScreeningPanel";
import { SumarioFormularioI } from "@/components/dashboard/SumarioFormularioI";
import { ProntuarioHeaderCard } from "@/components/dashboard/ProntuarioHeaderCard";
import { useNomeDoAluno } from "@/lib/nome-aluno";
import { OpcoesUnica, ReFormLeitura, ReFormRenderer, type ProfessorOpcao } from "./ReFormRenderer";
import { AlunoEdicaoModal } from "./AlunoEdicaoModal";
import { FogapDesenvolvimento, type RespostasDesenvolvimento } from "./FogapDesenvolvimento";

type Payload = Record<string, any>;
interface Linha {
  status: string;
  payload: unknown;
  updatedAt: string;
}
interface AlunoJornada {
  id: string;
  studentCode: string;
  birthYear: number | null;
  birthMonth: number | null;
  grade: string | null;
  schoolName: string | null;
}
interface Jornada {
  caseState: string;
  meta: ReJornadaMeta;
  situacao: JornadaSituacao;
  ata: { existe: boolean; enviada: boolean; status: string | null };
  escalas?: EscalasSumario | null;
  forms: Partial<Record<RePassoId, Linha | null>>;
  student: AlunoJornada;
  professores: ProfessorOpcao[];
  professorSugerido: ProfessorOpcao | null;
}

interface Props {
  caseId: string;
  professionalName?: string | null;
  professionalRole?: string | null;
  /** Chamado depois que o envio ao médico deu certo (para a lista de casos atualizar o estado). */
  onSent?: (summary: string) => void;
  /** Chamado depois de editar os dados do aluno (para as listas da página atualizarem série/nascimento). */
  onStudentChanged?: (aluno: { studentId: string; birthYear: number | null; birthMonth: number | null; grade: string | null }) => void;
  /** Abre o pedido de acesso ao nome civil no Cofre (auditado). */
  onVerNome?: () => void;
  /** Médico que recebeu o caso: vê tudo o que a escola registrou, sem editar, enviar ou salvar nada. */
  somenteLeitura?: boolean;
}

const errText = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível concluir agora. Tente de novo.");
const hora = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const ROTULO_ESTADO: Record<RePassoEstado, string> = {
  vazio: "Em branco",
  parcial: "Em andamento",
  completo: "Completo",
  pulado: "Não aplicado",
  aguardando_responsavel: "Aguardando o responsável",
};

const COR_ESTADO: Record<RePassoEstado, string> = {
  vazio: "bg-fundo text-black",
  parcial: "bg-ouro-100 text-black",
  completo: "bg-emerald-600 text-white",
  pulado: "bg-ouro-300 text-black",
  aguardando_responsavel: "bg-ouro-300 text-black",
};

const inputCls =
  "w-full rounded-xl border border-linha bg-white px-3 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-roxo/40 disabled:bg-fundo disabled:text-neutral-800";

const btnPrimario = buttonClass("primary", "md", "min-h-[44px]");
const btnSecundario = buttonClass("outline", "md", "min-h-[44px]");

/** Rola até o campo em branco (A–F) ou até o bloco (G, H, I). */
function irParaLacuna(l: Lacuna) {
  const seletor = isReFormId(l.passo) && l.campo ? `[data-campo="${l.passo}:${l.campo}${l.linha ? `|${l.linha}` : ""}"]` : `#passo-${l.passo}`;
  const el = document.querySelector<HTMLElement>(seletor) ?? document.getElementById(`passo-${l.passo}`);
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
}

/**
 * Tempo ativo de preenchimento por bloco (A–I): conta só segundos com a aba visível e com alguma interação nos últimos
 * 60 s, no bloco que está na tela. Envia só segundos (nenhum conteúdo) para a mediana do gestor.
 */
function useTempoAtivo(caseId: string, ativo: boolean) {
  const atual = useRef<RePassoId | null>(null);
  const acumulado = useRef<Partial<Record<RePassoId, number>>>({});
  const iniciados = useRef<Set<RePassoId>>(new Set());
  const ultimaAcao = useRef(Date.now());

  const enviar = useCallback(async () => {
    const pendentes = Object.entries(acumulado.current).filter(([, v]) => (v ?? 0) > 0) as [RePassoId, number][];
    for (const [step, seconds] of pendentes) {
      acumulado.current[step] = 0;
      const novaSessao = !iniciados.current.has(step);
      iniciados.current.add(step);
      try {
        await api.post(`/api/cases/${caseId}/re-journey/timings`, { step, seconds: Math.min(3600, seconds), novaSessao });
      } catch {
        acumulado.current[step] = (acumulado.current[step] ?? 0) + seconds; // tenta de novo no próximo envio
        iniciados.current.delete(step);
      }
    }
  }, [caseId]);

  useEffect(() => {
    if (!ativo) return;
    const marcar = () => {
      ultimaAcao.current = Date.now();
    };
    const eventos = ["pointerdown", "keydown", "scroll", "input"] as const;
    eventos.forEach((e) => window.addEventListener(e, marcar, { passive: true, capture: true }));
    const tique = setInterval(() => {
      const passo = atual.current;
      if (passo && document.visibilityState === "visible" && Date.now() - ultimaAcao.current < 60_000) {
        acumulado.current[passo] = (acumulado.current[passo] ?? 0) + 1;
      }
    }, 1000);
    const envio = setInterval(() => void enviar(), 20_000);
    const aoOcultar = () => {
      if (document.visibilityState === "hidden") void enviar();
    };
    document.addEventListener("visibilitychange", aoOcultar);

    const observador = new IntersectionObserver(
      (itens) => {
        for (const it of itens) {
          if (it.isIntersecting) atual.current = (it.target as HTMLElement).dataset.passo as RePassoId;
        }
      },
      { rootMargin: "-35% 0px -45% 0px" }
    );
    document.querySelectorAll<HTMLElement>("[data-passo]").forEach((el) => observador.observe(el));

    return () => {
      eventos.forEach((e) => window.removeEventListener(e, marcar, { capture: true }));
      clearInterval(tique);
      clearInterval(envio);
      document.removeEventListener("visibilitychange", aoOcultar);
      observador.disconnect();
      void enviar();
    };
  }, [ativo, enviar]);

  return { definirAtual: (id: RePassoId) => (atual.current = id) };
}

export function ReJourneyPanel({ caseId, professionalName, professionalRole, onSent, onStudentChanged, onVerNome, somenteLeitura = false }: Props) {
  const base = `/api/cases/${caseId}`;
  const nomeAluno = useNomeDoAluno(caseId);
  const [j, setJ] = useState<Jornada | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<ReFormId, Payload>>>({});
  const [snap, setSnap] = useState<Snap4Payload>(makeSnap4PayloadVazio());
  const [sum, setSum] = useState<FogapSecaoSumario>(sumarioComPadroes(null));
  const [dev, setDev] = useState<{ faixa: FaixaFogap | null; respostas: RespostasDesenvolvimento }>({ faixa: null, respostas: {} });
  const devAlterado = useRef(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [returnReason, setReturnReason] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [lacunasAberto, setLacunasAberto] = useState(false);
  const [lacunasServidor, setLacunasServidor] = useState<Lacuna[] | null>(null);
  const [mostrarFaltas, setMostrarFaltas] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentSummary, setSentSummary] = useState<string | null>(null);
  const [editandoAluno, setEditandoAluno] = useState(false);
  const [, forcar] = useState(0);

  const dirty = useRef<Set<RePassoId>>(new Set());
  const latest = useRef({ drafts, snap, sum, j, dev });
  latest.current = { drafts, snap, sum, j, dev };
  const topo = useRef<HTMLDivElement>(null);

  const readOnly = somenteLeitura || (j ? j.caseState !== "rascunho" : true);
  const tempo = useTempoAtivo(caseId, !readOnly && !loading && !!j);

  const hidratar = useCallback((d: Jornada, inicial: boolean) => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const id of ["a", "b", "c", "d", "e", "f"] as ReFormId[]) {
        if (!dirty.current.has(id)) next[id] = ((d.forms[id]?.payload as Payload) ?? {}) as Payload;
      }
      // Formulário B: com um só professor na escola, já nasce com o nome dele (o RE só confere).
      if (inicial && d.caseState === "rascunho" && d.professorSugerido && !(next.b as Payload | undefined)?.professor) {
        next.b = { ...(next.b ?? {}), professor: { id: d.professorSugerido.id, nome: d.professorSugerido.name } };
        dirty.current.add("b");
      }
      return next;
    });
    if (!dirty.current.has("g")) {
      const p = d.forms.g?.payload as Partial<Snap4Payload> | undefined;
      setSnap(p && typeof p === "object" && "respostas" in p ? ({ ...makeSnap4PayloadVazio(), ...p } as Snap4Payload) : makeSnap4PayloadVazio());
    }
    if (!dirty.current.has("i")) {
      const p = d.forms.i?.payload as { secao_sumario?: unknown } | undefined;
      setSum(sumarioComPadroes((p?.secao_sumario as Partial<FogapSecaoSumario>) ?? null));
    }
    if (!devAlterado.current) {
      const p = d.forms.i?.payload as { faixa_fogap?: FaixaFogap | null; respostas_desenvolvimento?: RespostasDesenvolvimento } | undefined;
      setDev({ faixa: p?.faixa_fogap ?? null, respostas: p?.respostas_desenvolvimento ?? {} });
    }
  }, []);

  const carregar = useCallback(
    async (inicial: boolean) => {
      try {
        const d = await api.get<Jornada>(`${base}/re-journey`);
        setJ(d);
        hidratar(d, inicial);
        setLoadErr(null);
        const devolvido = Object.values(d.forms).some((f) => f?.status === "devolvido");
        if (devolvido) {
          const r = await api.get<{ returnReason?: string | null }>(`${base}/re-assessment`).catch(() => null);
          setReturnReason(r?.returnReason ?? null);
        } else {
          setReturnReason(null);
        }
      } catch (e) {
        setLoadErr(errText(e));
      } finally {
        setLoading(false);
      }
    },
    [base, hidratar]
  );

  useEffect(() => {
    void carregar(true);
  }, [carregar]);

  // Situação ao vivo (mesma regra do servidor): atualiza a cada tecla, sem esperar o salvamento.
  const situacao = useMemo<JornadaSituacao | null>(() => {
    if (!j) return null;
    return situacaoDaJornada({
      meta: j.meta,
      payloads: drafts,
      snap4: snap,
      sumario: sum,
      ata: { existe: j.ata.existe, enviada: j.ata.enviada },
      serieDoAluno: j.student.grade,
    });
  }, [j, drafts, snap, sum]);

  const estadoDe = (id: RePassoId): RePassoEstado => situacao?.passos.find((p) => p.id === id)?.estado ?? "vazio";

  const destacarPorForm = useMemo(() => {
    const out: Partial<Record<ReFormId, Set<string>>> = {};
    if (!mostrarFaltas || !situacao) return out;
    for (const l of situacao.lacunas) {
      if (!isReFormId(l.passo) || !l.campo) continue;
      (out[l.passo] ??= new Set()).add(l.linha ? `${l.campo}|${l.linha}` : l.campo);
    }
    return out;
  }, [mostrarFaltas, situacao]);

  // ── Salvar ───────────────────────────────────────────────────────────────

  const salvar = useCallback(
    async (id: RePassoId, forcarSalvar = false): Promise<boolean> => {
      const { drafts: dr, snap: sn, sum: su, j: jj, dev: dv } = latest.current;
      if (!jj || jj.caseState !== "rascunho") return true;
      if (!forcarSalvar && !dirty.current.has(id)) return true;
      if (id === "h") return true;
      try {
        if (isReFormId(id)) {
          await api.put(`${base}/re-journey/forms/${id}`, { payload: dr[id] ?? {} });
        } else if (id === "g") {
          if (jj.forms.g) await api.put(`${base}/re-assessment?formCode=${SNAP4_FORM_CODE}`, { payload: sn });
          else await api.post(`${base}/re-assessment?formCode=${SNAP4_FORM_CODE}`, { payload: sn });
          setJ((cur) => (cur ? { ...cur, forms: { ...cur.forms, g: { status: "rascunho", payload: sn, updatedAt: new Date().toISOString() } } } : cur));
        } else if (id === "i") {
          await api.put(`${base}/re-journey/sumario`, { secao_sumario: su });
          if (devAlterado.current) {
            const meses = jj.student.birthYear ? new Date().getFullYear() * 12 + new Date().getMonth() + 1 - (jj.student.birthYear * 12 + (jj.student.birthMonth ?? 1)) : null;
            const faixa = faixaEmUso({ faixa_fogap: dv.faixa, total_meses: meses });
            if (faixa) {
              const ids = new Set(itensDaFaixa(faixa).map((i) => i.id));
              const respostas = Object.fromEntries(Object.entries(dv.respostas).filter(([k]) => ids.has(k)));
              await api.put(`${base}/re-journey/fogap-desenvolvimento`, { faixa, respostas });
            }
            devAlterado.current = false;
          }
        }
        dirty.current.delete(id);
        return true;
      } catch (e) {
        setMsg({ ok: false, text: errText(e) });
        return false;
      }
    },
    [base]
  );

  const salvarTudo = useCallback(
    async (forcarSalvar = false): Promise<boolean> => {
      setSaving(true);
      let ok = true;
      try {
        for (const id of RE_PASSOS.map((p) => p.id)) {
          if (dirty.current.has(id) || forcarSalvar) {
            if (!(await salvar(id, forcarSalvar))) ok = false;
          }
        }
        if (ok) setSavedAt(hora());
      } finally {
        setSaving(false);
      }
      return ok;
    },
    [salvar]
  );

  // Salvamento automático: 1,5 s depois da última alteração, em qualquer parte do formulário.
  useEffect(() => {
    if (readOnly || dirty.current.size === 0) return;
    const t = setTimeout(() => void salvarTudo(), 1500);
    return () => clearTimeout(t);
  }, [drafts, snap, sum, dev, readOnly, salvarTudo]);

  const marcarAlterado = (id: RePassoId) => {
    dirty.current.add(id);
    setSavedAt(null);
    setMsg(null);
    forcar((n) => n + 1);
  };

  function editarForm(id: ReFormId, next: Payload) {
    marcarAlterado(id);
    setDrafts((d) => ({ ...d, [id]: next }));
  }

  async function alternar(passo: "g/skip" | "h/await", valor: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      if (!(await salvarTudo())) return;
      await api.post(`${base}/re-journey/steps/${passo}`, { valor });
      await carregar(false);
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  }

  // ── Concluir / enviar ────────────────────────────────────────────────────

  async function aoClicarEnviar() {
    setMsg(null);
    if (!(await salvarTudo())) return;
    if (situacao && situacao.lacunas.length > 0) {
      setMostrarFaltas(true);
      setLacunasServidor(null);
      setLacunasAberto(true);
    } else {
      setConfirmSend(true);
    }
  }

  async function enviarAoMedico(confirmarLacunas: boolean) {
    setSending(true);
    try {
      const r = await api.post<{ summary?: string }>(`${base}/re-assessment/submit`, confirmarLacunas ? { confirmarLacunas: true } : {});
      setConfirmSend(false);
      setLacunasAberto(false);
      const resumo = r.summary ?? `Caso ${j?.student.studentCode ?? ""} encaminhado ao médico.`;
      setSentSummary(resumo);
      await carregar(false);
      onSent?.(resumo);
    } catch (e) {
      setConfirmSend(false);
      const corpo = e instanceof ApiError ? (e.body as { code?: string; lacunas?: Lacuna[] } | undefined) : undefined;
      if ((corpo?.code === "LACUNAS" || corpo?.code === "LACUNAS_BLOQUEANTES") && Array.isArray(corpo.lacunas)) {
        setLacunasServidor(corpo.lacunas);
        setMostrarFaltas(true);
        setLacunasAberto(true);
      } else {
        setLacunasAberto(false);
        setMsg({ ok: false, text: errText(e) });
      }
    } finally {
      setSending(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="rounded-2xl border border-linha bg-white p-8 text-center text-sm text-neutral-800">Carregando a avaliação do RE…</div>;
  }
  if (loadErr || !j || !situacao) {
    return (
      <div role="alert" className="flex items-center gap-2 rounded-2xl border border-erro/30 bg-erro/5 p-4 text-sm text-black">
        <AlertCircle className="h-4 w-4 shrink-0" /> {loadErr ?? "Não foi possível abrir a avaliação."}
        <button type="button" onClick={() => void carregar(true)} className="ml-auto underline">Tentar de novo</button>
      </div>
    );
  }

  const aluno = j.student;
  const nasc = aluno.birthYear ? `${aluno.birthMonth ? `${MESES[aluno.birthMonth - 1]}/` : ""}${aluno.birthYear}` : "";
  const lacunasMostradas = lacunasServidor ?? situacao.lacunas;
  const temBloqueante = lacunasMostradas.some((l) => l.bloqueante);
  const totalLacunas = situacao.lacunas.length;
  const respondidosForms = situacao.passos.reduce((acc, p) => acc + p.respondidos, 0);
  const totalForms = situacao.passos.reduce((acc, p) => acc + p.total, 0);
  const porPasso = (id: RePassoId) => situacao.lacunas.filter((l) => l.passo === id).length;
  const idadeMeses = aluno.birthYear
    ? new Date().getFullYear() * 12 + new Date().getMonth() + 1 - (aluno.birthYear * 12 + (aluno.birthMonth ?? 1))
    : null;
  const faixaSugerida = faixaPadraoPorMeses(idadeMeses);
  const faixaAtual = faixaEmUso({ faixa_fogap: dev.faixa, total_meses: idadeMeses });
  const idade = (() => {
    if (!aluno.birthYear) return "—";
    const hoje = new Date();
    const m = hoje.getFullYear() * 12 + hoje.getMonth() + 1 - (aluno.birthYear * 12 + (aluno.birthMonth ?? 1));
    return `${Math.floor(m / 12)} anos${m % 12 ? ` e ${m % 12}m` : ""}`;
  })();

  return (
    <div ref={topo} className="space-y-4 scroll-mt-4" data-testid="re-jornada">
      <ProntuarioHeaderCard
        studentCode={aluno.studentCode}
        nomeCompleto={nomeAluno.fullName}
        schoolName={aluno.schoolName ?? ""}
        ageText={idade}
        birthText={nasc}
        grade={aluno.grade}
        professionalName={professionalName || "Responsável Escolar"}
        professionalRole={professionalRole || "ppi"}
        journeyState={j.caseState}
        onVerNome={onVerNome}
        onEditar={readOnly ? undefined : () => setEditandoAluno(true)}
        queixaEscola={sum.queixa_professor ?? ""}
      />

      {returnReason !== null && !readOnly && (
        <div role="status" className="flex flex-col gap-1.5 rounded-xl border border-ouro-300 bg-ouro-50 px-4 py-3 text-sm text-black">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 shrink-0 text-amber-700" />
            <strong>O médico devolveu o caso para ajustes.</strong> Revise o que precisar e envie de novo.
          </div>
          {returnReason && (
            <p className="rounded-lg border border-amber-200 bg-amber-100/70 p-2.5 text-xs text-amber-950">Motivo informado pelo médico: &ldquo;{returnReason}&rdquo;</p>
          )}
        </div>
      )}
      {readOnly && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-ceu-300 bg-ceu-50 px-4 py-3 text-sm text-black">
          <Lock className="h-4 w-4 shrink-0" /> {somenteLeitura ? "Registro da escola — somente leitura." : "Avaliação enviada ao médico — somente leitura até uma devolução."}
        </div>
      )}

      {/* Barra fixa: progresso e atalhos para cada parte (nada fica travado) */}
      <nav aria-label="Partes da avaliação" className="sticky top-0 z-20 rounded-2xl border border-linha bg-white/95 p-3 shadow-suave backdrop-blur">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-black">Formulário único A a I</p>
          <p className="text-xs text-neutral-800" aria-live="polite">
            {respondidosForms} de {totalForms} respostas
            {totalLacunas > 0 ? ` · ${totalLacunas} em branco` : " · tudo respondido"}
            {!readOnly && (saving ? " · Salvando…" : savedAt ? ` · Salvo às ${savedAt}` : dirty.current.size > 0 ? " · Alterações ainda não salvas" : "")}
          </p>
        </div>
        <div className="mb-2 h-2 overflow-hidden rounded-full bg-fundo" aria-hidden>
          <div className="h-full rounded-full bg-roxo transition-all" style={{ width: `${totalForms ? (respondidosForms / totalForms) * 100 : 0}%` }} />
        </div>
        <ol className="flex gap-1.5 overflow-x-auto pb-0.5">
          {RE_PASSOS.map((p) => {
            const e = estadoDe(p.id);
            const faltam = porPasso(p.id);
            return (
              <li key={p.id} className="shrink-0">
                <button
                  type="button"
                  title={`${p.titulo} — ${ROTULO_ESTADO[e]}`}
                  data-testid={`re-passo-${p.id}`}
                  onClick={() => document.getElementById(`passo-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="flex items-center gap-1.5 rounded-xl border border-linha bg-white px-2.5 py-1.5 text-xs font-bold text-black transition hover:bg-roxo-50"
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${COR_ESTADO[e]}`}>
                    {e === "completo" ? <Check className="h-3.5 w-3.5" aria-hidden /> : e === "pulado" ? <SkipForward className="h-3.5 w-3.5" aria-hidden /> : e === "aguardando_responsavel" ? <Clock className="h-3.5 w-3.5" aria-hidden /> : p.letra}
                  </span>
                  <span className="hidden sm:inline">{p.tituloCurto}</span>
                  {faltam > 0 && !readOnly && <span className="rounded-full bg-erro/10 px-1.5 text-[10px] text-erro">{faltam}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {msg && (
        <div role={msg.ok ? "status" : "alert"} className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sucesso/10 text-black" : "bg-erro/10 text-black"}`}>
          {msg.text}
        </div>
      )}

      {/* Formulário único, contínuo: A → I na mesma página, sem trava entre as partes */}
      <div className="space-y-10 rounded-2xl border border-linha bg-white p-4 shadow-suave sm:p-6">
        {RE_PASSOS.map((passo) => {
          const e = estadoDe(passo.id);
          const emEdicao = !readOnly;
          return (
            <section key={passo.id} id={`passo-${passo.id}`} data-passo={passo.id} aria-labelledby={`titulo-${passo.id}`} className="scroll-mt-32" onFocusCapture={() => tempo.definirAtual(passo.id)}>
              <header className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b-2 border-roxo/30 pb-2">
                <div>
                  <h2 id={`titulo-${passo.id}`} className="text-lg font-bold text-black">{passo.titulo}</h2>
                  {isReFormId(passo.id) && <p className="mt-0.5 text-sm text-neutral-800">{RE_FORMS[passo.id].dica}</p>}
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${COR_ESTADO[e]}`}>{ROTULO_ESTADO[e]}</span>
              </header>

              {isReFormId(passo.id) &&
                (readOnly ? (
                  <ReFormLeitura form={RE_FORMS[passo.id]} value={(drafts[passo.id] ?? {}) as Payload} />
                ) : (
                  <ReFormRenderer
                    continuo
                    form={RE_FORMS[passo.id]}
                    value={(drafts[passo.id] ?? {}) as Payload}
                    onChange={(n) => editarForm(passo.id as ReFormId, n)}
                    contexto={{
                      professores: j.professores,
                      destacar: destacarPorForm[passo.id as ReFormId],
                      sugerirObservacoes: (fid, payload) =>
                        api.post(`/api/cases/${caseId}/re-journey/forms/${fid}/observacoes-sugestao`, { payload }),
                    }}
                  />
                ))}

              {passo.id === "g" && (
                <Snap4Passo
                  snap={snap}
                  readOnly={!emEdicao}
                  pulado={j.meta.g_pulado}
                  onChange={(n) => {
                    marcarAlterado("g");
                    setSnap(n);
                  }}
                  onPular={(v) => void alternar("g/skip", v)}
                  busy={busy}
                />
              )}

              {passo.id === "h" && (
                <AtaPasso
                  estado={e}
                  ataEnviada={j.ata.enviada}
                  caseId={caseId}
                  readOnly={readOnly}
                  busy={busy}
                  onAguardar={(v) => void alternar("h/await", v)}
                  onMudou={() => void carregar(false)}
                />
              )}

              {passo.id === "i" && (
                <div className="mb-4">
                  {faixaAtual ? (
                    <FogapDesenvolvimento
                      faixa={faixaAtual}
                      faixaSugerida={faixaSugerida}
                      respostas={dev.respostas}
                      readOnly={!emEdicao}
                      onFaixa={(f) => {
                        devAlterado.current = true;
                        marcarAlterado("i");
                        setDev((d) => ({ ...d, faixa: f }));
                      }}
                      onResponder={(id, valor) => {
                        devAlterado.current = true;
                        marcarAlterado("i");
                        setDev((d) => ({ ...d, faixa: d.faixa ?? faixaAtual, respostas: { ...d.respostas, [id]: valor } }));
                      }}
                    />
                  ) : (
                    <p className="rounded-xl border border-linha bg-fundo p-3 text-xs text-neutral-800" role="status" data-testid="fogap-fora-do-piloto">
                      Os itens de desenvolvimento do FOGAP cobrem alunos de 4 a 9 anos. Confira o nascimento do aluno nos dados do cadastro.
                    </p>
                  )}
                </div>
              )}
              {passo.id === "i" && (
                <SumarioPasso
                  sum={sum}
                  aluno={aluno}
                  readOnly={!emEdicao}
                  destacar={mostrarFaltas ? new Set(lacunasDoSumario(sum, aluno.grade).map((l) => l.campo)) : undefined}
                  onChange={(n) => {
                    marcarAlterado("i");
                    setSum(n);
                  }}
                  preview={
                    <SumarioFormularioI
                      studentCode={aluno.studentCode}
                      birthYear={aluno.birthYear}
                      birthMonth={aluno.birthMonth}
                      grade={aluno.grade}
                      schoolName={aluno.schoolName}
                      payload={{ ...((j.forms.i?.payload as object) ?? {}), secao_sumario: sum }}
                      professionalName={professionalName}
                      modo={readOnly ? "enviado" : "rascunho"}
                      escalas={j.escalas}
                    />
                  }
                />
              )}
            </section>
          );
        })}
      </div>

      {/* Envio ao médico */}
      {!readOnly && (
        <section aria-labelledby="re-envio" className="rounded-2xl border border-roxo/30 bg-roxo-50 p-4 sm:p-5">
          <h3 id="re-envio" className="text-sm font-bold text-black">Concluir e enviar ao médico</h3>
          <p className="mt-1 text-sm text-black">
            {totalLacunas === 0
              ? "Tudo respondido. Depois do envio, a avaliação fica somente para leitura até o médico devolver."
              : `Ao concluir, o sistema mostra os ${totalLacunas} campo(s) em branco para você conferir. Em branco é permitido, mas só vale como “não informado”.`}
          </p>
          <button type="button" className={`${btnPrimario} mt-3`} disabled={sending || saving} onClick={() => void aoClicarEnviar()} data-testid="re-enviar">
            <Send className="h-4 w-4" aria-hidden /> Concluir e enviar ao médico
          </button>
        </section>
      )}

      <AlunoEdicaoModal
        open={editandoAluno}
        onClose={() => setEditandoAluno(false)}
        studentId={aluno.id}
        studentCode={aluno.studentCode}
        birthYear={aluno.birthYear}
        birthMonth={aluno.birthMonth}
        grade={aluno.grade}
        onSaved={(novo) => {
          setJ((cur) => (cur ? { ...cur, student: { ...cur.student, ...novo } } : cur));
          onStudentChanged?.({ studentId: aluno.id, ...novo });
          setMsg({ ok: true, text: "Dados do aluno atualizados e registrados no histórico." });
        }}
      />

      {/* Conferência dos campos em branco */}
      <Modal
        open={lacunasAberto}
        onClose={() => setLacunasAberto(false)}
        title={temBloqueante ? `Faltam ${lacunasMostradas.filter((l) => l.bloqueante).length} campo(s) obrigatório(s)` : `Faltam ${lacunasMostradas.length} campo(s) sem resposta`}
        description={
          temBloqueante
            ? "Estes campos são obrigatórios para enviar ao médico: Formulário I completo (com o mínimo de caracteres nos textos) e a ATA enviada. Preencha e tente de novo."
            : "Confira a lista. Você pode voltar e preencher ou enviar assim mesmo: o que ficar em branco chega ao médico como “não informado”."
        }
        maxWidth="lg"
      >
        <div className="space-y-4">
          <ul className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-linha bg-fundo p-2 text-sm text-black" data-testid="lista-lacunas">
            {[...lacunasMostradas].sort((a, b) => Number(Boolean(b.bloqueante)) - Number(Boolean(a.bloqueante))).map((l, i) => (
              <li key={`${l.passo}-${l.campo}-${l.linha ?? ""}-${i}`}>
                <button
                  type="button"
                  onClick={() => {
                    setLacunasAberto(false);
                    setTimeout(() => irParaLacuna(l), 150);
                  }}
                  className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-white"
                >
                  {l.bloqueante ? <span className="mr-1.5 rounded bg-erro/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-erro">obrigatório</span> : null}
                  {l.rotulo}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={btnSecundario} onClick={() => { setLacunasAberto(false); if (lacunasMostradas[0]) setTimeout(() => irParaLacuna(lacunasMostradas[0]), 150); }}>
              Voltar e preencher
            </button>
            {!temBloqueante && (
              <button type="button" className={btnPrimario} disabled={sending} onClick={() => void enviarAoMedico(true)} data-testid="re-enviar-assim-mesmo">
                <Send className="h-4 w-4" aria-hidden /> {sending ? "Enviando…" : "Enviar assim mesmo"}
              </button>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmSend}
        onClose={() => setConfirmSend(false)}
        onConfirm={() => enviarAoMedico(false)}
        title="Enviar a avaliação ao médico?"
        description="O caso será sumarizado e ficará na fila do Médico. O médico lê apenas o sumário (Formulário I); as entrevistas A a H ficam com você. Os formulários A a I ficam bloqueados para edição até uma devolução."
        confirmText="Confirmar e enviar"
        cancelText="Continuar editando"
        tone="send"
        isLoading={sending}
      >
        <ul className="space-y-1 rounded-xl border border-linha bg-fundo p-3 text-xs text-black">
          {RE_PASSOS.map((p) => (
            <li key={p.id}>
              <strong>{p.letra}</strong> · {p.tituloCurto}: {ROTULO_ESTADO[estadoDe(p.id)]}
            </li>
          ))}
        </ul>
      </ConfirmDialog>

      <Modal open={!!sentSummary} onClose={() => setSentSummary(null)} title="Avaliação enviada ao médico" description="O caso foi sumarizado e encaminhado." maxWidth="lg">
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-950">
            <p className="mb-2 flex items-center gap-2 text-sm font-bold"><CheckCircle className="h-5 w-5 text-emerald-600" aria-hidden /> Sumário que o médico recebeu</p>
            <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-xl border border-emerald-200 bg-white p-3 font-sans leading-relaxed text-neutral-800">{sentSummary}</pre>
          </div>
          <div className="flex justify-end">
            <button type="button" className={btnPrimario} onClick={() => setSentSummary(null)}>Fechar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── G — SNAP-IV (opcional) ────────────────────────────────────────────────

function Snap4Passo({
  snap,
  readOnly,
  pulado,
  onChange,
  onPular,
  busy,
}: {
  snap: Snap4Payload;
  readOnly: boolean;
  pulado: boolean;
  onChange: (n: Snap4Payload) => void;
  onPular: (v: boolean) => void;
  busy: boolean;
}) {
  const opcoes = SNAP4_OPCOES.map((o) => ({ value: o.valor as string, label: o.rotulo }));
  const rodape = snap.rodape ?? {};
  const contagem = calcularContagem(snap);
  const setRodape = (patch: Record<string, string | null>) => onChange({ ...snap, rodape: { ...rodape, ...patch } });

  if (pulado) {
    return (
      <div className="rounded-2xl border border-ouro-300 bg-ouro-50 p-4 text-sm text-black">
        <p className="flex items-center gap-2"><Lock className="h-4 w-4 shrink-0" aria-hidden /> <span><strong>SNAP-IV não aplicado.</strong> O Formulário G é opcional: o bloco ficou travado e a decisão está registrada.</span></p>
        {!readOnly && (
          <button type="button" className={`${btnSecundario} mt-3`} disabled={busy} onClick={() => onPular(false)}>
            Quero aplicar o SNAP-IV
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-black">Marque a opção que melhor descreve o aluno.</p>
      <ul className="space-y-3">
        {SNAP4_ITENS.map((item) => (
          <li key={item.id} className="rounded-2xl border border-linha bg-white p-4 shadow-suave">
            <p className="mb-2 text-sm font-semibold text-black">{item.n}. {item.texto}</p>
            <OpcoesUnica
              nome={`Item ${item.n}`}
              opcoes={opcoes}
              valor={snap.respostas[item.id] ?? null}
              desabilitado={readOnly}
              onChange={(v) => onChange({ ...snap, respostas: { ...snap.respostas, [item.id]: (v as Snap4Payload["respostas"][string]) ?? null } })}
            />
          </li>
        ))}
      </ul>
      <div className="rounded-2xl border border-linha bg-fundo p-4 text-xs text-black" data-testid="snap4-contagem">
        <p className="font-semibold">Contagem de “Bastante” ou “Demais” (só números, sem classificação)</p>
        <p className="mt-1">Itens 1 a 9: {contagem.c1.contagem} de {contagem.c1.total} · Itens 10 a 18: {contagem.c2.contagem} de {contagem.c2.total}</p>
        <p className="mt-2 font-semibold">Critérios do formulário-fonte (lembrete para o profissional)</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {SNAP4_CRITERIOS_TEXTO.map((c) => (
            <li key={c.id}><strong>{c.id}:</strong> {c.texto}</li>
          ))}
        </ul>
        <p className="mt-2 text-neutral-800">{SNAP4_FONTE_VERSAO}</p>
      </div>
      <fieldset disabled={readOnly} className="space-y-4 rounded-2xl border border-linha bg-white p-4 shadow-suave">
        <legend className="px-1 text-sm font-bold text-black">Rodapé</legend>
        <div>
          <p className="mb-1.5 text-sm font-semibold text-black">O SNAP foi distribuído para pais, avós ou outros adultos que convivem com a criança, toda semana?</p>
          <OpcoesUnica
            nome="SNAP distribuído"
            opcoes={[{ value: "nao", label: "Não" }, { value: "sim", label: "Sim" }]}
            valor={rodape["distribuido"] ?? null}
            desabilitado={readOnly}
            onChange={(v) => setRodape({ distribuido: v, ...(v !== "sim" ? { quem_respondeu: null } : {}) })}
          />
        </div>
        {rodape["distribuido"] === "sim" && (
          <div>
            <label htmlFor="snap-quem" className="mb-1 block text-sm font-semibold text-black">Quem respondeu?</label>
            <input id="snap-quem" type="text" className={inputCls} placeholder="Ex.: mãe, avó (sem nomes)" value={rodape["quem_respondeu"] ?? ""} onChange={(e) => setRodape({ quem_respondeu: e.target.value || null })} />
          </div>
        )}
        <div>
          <label htmlFor="snap-qtd" className="mb-1 block text-sm font-semibold text-black">Quantos SNAPs foram aplicados no mesmo período (30 dias)?</label>
          <input id="snap-qtd" type="number" min={0} className={`${inputCls} max-w-[10rem]`} value={rodape["quantos_snaps_30d"] ?? ""} onChange={(e) => setRodape({ quantos_snaps_30d: e.target.value || null })} />
        </div>
        <div>
          <label htmlFor="snap-obs" className="mb-1 block text-sm font-semibold text-black">Observações</label>
          <textarea id="snap-obs" rows={3} className={`${inputCls} resize-y`} value={rodape["obs"] ?? ""} onChange={(e) => setRodape({ obs: e.target.value || null })} />
        </div>
      </fieldset>
      {!readOnly && (
        <div className="rounded-2xl border border-dashed border-linha p-4">
          <p className="text-sm text-black">Não vai aplicar o SNAP-IV agora? Ele é opcional. Ao clicar, o bloco trava, a jornada segue e o uso desta opção fica registrado para auditoria.</p>
          <button type="button" className={`${btnSecundario} mt-2`} disabled={busy} onClick={() => onPular(true)}>
            <SkipForward className="h-4 w-4" aria-hidden /> Não vou aplicar o SNAP-IV (travar este bloco)
          </button>
        </div>
      )}
    </div>
  );
}

// ── H — ATA respondida pelo responsável ──────────────────────────────────

function AtaPasso({
  estado,
  ataEnviada,
  caseId,
  readOnly,
  busy,
  onAguardar,
  onMudou,
}: {
  estado: RePassoEstado;
  ataEnviada: boolean;
  caseId: string;
  readOnly: boolean;
  busy: boolean;
  onAguardar: (v: boolean) => void;
  onMudou: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-linha bg-white p-4 text-sm text-black shadow-suave">
        <p>
          A <strong>ATA</strong> (Escala de Traços Autísticos) é respondida pelo <strong>pai, mãe ou responsável</strong>. Você pode registrar as respostas dele agora, junto com ele,
          ou marcar que está aguardando e seguir adiante.
        </p>
        {ataEnviada && <p className="mt-2 flex items-center gap-2 font-semibold text-emerald-800"><CheckCircle className="h-4 w-4" aria-hidden /> ATA enviada — este formulário está concluído.</p>}
        {estado === "aguardando_responsavel" && !ataEnviada && (
          <p className="mt-2 flex items-center gap-2 font-semibold text-amber-900"><Clock className="h-4 w-4" aria-hidden /> Aguardando o responsável responder. Você pode seguir e enviar ao médico; a ATA pode ser registrada depois.</p>
        )}
      </div>

      <TeaScreeningPanel caseId={caseId} onChanged={onMudou} />

      {!readOnly && !ataEnviada && (
        <div className="rounded-2xl border border-dashed border-linha p-4">
          {estado === "aguardando_responsavel" ? (
            <button type="button" className={btnSecundario} disabled={busy} onClick={() => onAguardar(false)}>
              O responsável já respondeu — quero registrar agora
            </button>
          ) : (
            <>
              <p className="text-sm text-black">O responsável ainda não respondeu?</p>
              <button type="button" className={`${btnSecundario} mt-2`} disabled={busy} onClick={() => onAguardar(true)} data-testid="re-h-aguardar">
                <Clock className="h-4 w-4" aria-hidden /> Aguardando o responsável
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── I — Sumário da avaliação do RE ───────────────────────────────────────

function SumarioPasso({
  sum,
  aluno,
  readOnly,
  destacar,
  onChange,
  preview,
}: {
  sum: FogapSecaoSumario;
  aluno: AlunoJornada;
  readOnly: boolean;
  destacar?: Set<string>;
  onChange: (n: FogapSecaoSumario) => void;
  preview: React.ReactNode;
}) {
  const falta = (campo: string) => (destacar?.has(campo) ? "rounded-xl border-l-4 border-l-erro bg-erro/5 pl-3" : "");
  const set = (patch: Partial<FogapSecaoSumario>) => onChange({ ...sum, ...patch });
  const enc = { ...encaminhadosVazio(), ...(sum.encaminhado ?? {}) };
  const setEnc = (patch: Partial<typeof enc>) => set({ encaminhado: { ...enc, ...patch } });
  const toggle = (opt: string) =>
    set({
      dificuldades_persistentes: sum.dificuldades_persistentes.includes(opt)
        ? sum.dificuldades_persistentes.filter((x) => x !== opt)
        : [...sum.dificuldades_persistentes, opt],
    });

  return (
    <div className="space-y-4">
      {!readOnly && (
        <fieldset className="space-y-5 rounded-2xl border border-linha bg-white p-4 shadow-suave sm:p-5">
          <legend className="px-1 text-sm font-bold text-black">Preencha o sumário</legend>
          <p className="text-xs text-neutral-800">Aluno, nascimento, série e escola já vêm do cadastro e vão sozinhos para o médico. Use linguagem observável, sem nomes e sem diagnóstico.</p>
          <dl className="grid grid-cols-2 gap-2 rounded-xl border border-linha bg-fundo p-3 text-xs sm:grid-cols-4" data-testid="sumario-dados-aluno">
            <div><dt className="font-semibold text-neutral-700">Aluno</dt><dd className="font-mono font-bold text-black">{aluno.studentCode}</dd></div>
            <div><dt className="font-semibold text-neutral-700">Nascimento</dt><dd className="text-black">{aluno.birthYear ? `${aluno.birthMonth ? `${String(aluno.birthMonth).padStart(2, "0")}/` : ""}${aluno.birthYear}` : "—"}</dd></div>
            <div className={falta("serie")}><dt className="font-semibold text-neutral-700">Série</dt><dd className="text-black">{aluno.grade?.trim() || <span className="font-semibold text-erro">não informada (edite os dados do aluno)</span>}</dd></div>
            <div><dt className="font-semibold text-neutral-700">Escola</dt><dd className="text-black">{aluno.schoolName || "—"}</dd></div>
          </dl>
          <div className={falta("queixa_professor")}>
            <label htmlFor="i-queixa" className="mb-1 block text-sm font-semibold text-black">Queixa do professor</label>
            <textarea id="i-queixa" rows={3} maxLength={SUMARIO_TEXTO_MAX} className={`${inputCls} resize-y`} value={sum.queixa_professor ?? ""} onChange={(e) => set({ queixa_professor: e.target.value })} />
          </div>
          <div className={falta("hipotese_espectro")}>
            <label htmlFor="i-hipotese" className="mb-1 block text-sm font-semibold text-black">Hipótese diagnóstica do espectro (dimensão)</label>
            <textarea id="i-hipotese" rows={2} maxLength={SUMARIO_TEXTO_MAX} className={`${inputCls} resize-y`} value={sum.hipotese_espectro ?? ""} onChange={(e) => set({ hipotese_espectro: e.target.value })} />
            <p className="mt-1 text-[11px] text-neutral-700">Registro do profissional. O sistema não diagnostica.</p>
          </div>
          <div className={falta("dificuldades_persistentes")}>
            <p className="mb-1.5 text-sm font-semibold text-black">Dificuldades persistentes (pode marcar várias)</p>
            <div role="group" aria-label="Dificuldades persistentes" className="flex flex-wrap gap-2">
              {DIFICULDADES_PERSISTENTES_OPCOES.map((opt) => {
                const ativo = sum.dificuldades_persistentes.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => toggle(opt)}
                    className={`min-h-[44px] rounded-xl border px-4 py-2 text-sm font-semibold transition ${ativo ? "border-roxo bg-roxo text-white" : "border-linha bg-white text-black hover:bg-roxo-50"}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
          <div className={`space-y-3 rounded-xl border border-linha p-4 ${falta("conduta") || falta("qual") ? "border-l-4 border-l-erro bg-erro/5" : ""}`}>
            <p className="text-sm font-bold text-black">Intervenção do PpI</p>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-black">Houve conduta?</p>
              <OpcoesUnica nome="Houve conduta" opcoes={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }]} valor={sum.conduta} onChange={(v) => set({ conduta: (v as "sim" | "nao" | null) })} />
            </div>
            {sum.conduta === "sim" &&
              (
                [
                  ["qual", "Qual?"],
                  ["tempo", "Por quanto tempo?"],
                  ["resultado", "Resultado"],
                ] as const
              ).map(([k, rot]) => (
                <div key={k}>
                  <label htmlFor={`i-${k}`} className="mb-1 block text-sm font-semibold text-black">{rot}</label>
                  <input id={`i-${k}`} type="text" maxLength={SUMARIO_TEXTO_MAX} className={inputCls} value={sum[k]} onChange={(e) => set({ [k]: e.target.value })} />
                </div>
              ))}
          </div>
          <div className="space-y-3 rounded-xl border border-linha p-4">
            <p className="text-sm font-bold text-black">Encaminhado em (deixe em branco o que não se aplica; pode ser data futura, se já está agendado)</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FOGAP_DESTINOS.map((d) => (
                <div key={d.key}>
                  <label htmlFor={`i-enc-${d.key}`} className="mb-1 block text-sm font-semibold text-black">{d.label}</label>
                  <input id={`i-enc-${d.key}`} type="date" className={inputCls} value={enc[d.key] ?? ""} onChange={(e) => setEnc({ [d.key]: e.target.value || null })} />
                </div>
              ))}
              <div>
                <label htmlFor="i-enc-outro-nome" className="mb-1 block text-sm font-semibold text-black">Outro (para quem)</label>
                <input id="i-enc-outro-nome" type="text" maxLength={120} className={inputCls} value={enc.outro_nome ?? ""} onChange={(e) => setEnc({ outro_nome: e.target.value })} />
              </div>
              <div>
                <label htmlFor="i-enc-outro" className="mb-1 block text-sm font-semibold text-black">Outro — data</label>
                <input id="i-enc-outro" type="date" className={inputCls} value={enc.outro ?? ""} onChange={(e) => setEnc({ outro: e.target.value || null })} />
              </div>
            </div>
          </div>
        </fieldset>
      )}
      {preview}
    </div>
  );
}
