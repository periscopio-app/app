"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle, Clock, Lock, RotateCcw, Save, Send, SkipForward } from "lucide-react";
import {
  DIFICULDADES_PERSISTENTES_OPCOES,
  FOGAP_DESTINOS,
  RE_FORMS,
  RE_PASSOS,
  SNAP4_FORM_CODE,
  SNAP4_ITENS,
  SNAP4_OPCOES,
  SUMARIO_TEXTO_MAX,
  encaminhadosVazio,
  hojeBrasilia,
  isReFormId,
  makeSnap4PayloadVazio,
  progressoReForm,
  sumarioComPadroes,
  type FogapSecaoSumario,
  type JornadaSituacao,
  type ReFormId,
  type RePassoEstado,
  type RePassoId,
  type ReJornadaMeta,
  type Snap4Payload,
} from "@periscopio/shared";
import { api } from "@/lib/api";
import { ConfirmDialog, Modal } from "@/components/ui";
import { TeaScreeningPanel } from "@/components/dashboard/TeaScreeningPanel";
import { SumarioFormularioI } from "@/components/dashboard/SumarioFormularioI";
import { OpcoesUnica, ReFormLeitura, ReFormRenderer } from "./ReFormRenderer";

type Payload = Record<string, any>;
interface Linha {
  status: string;
  payload: unknown;
  updatedAt: string;
}
interface Jornada {
  caseState: string;
  meta: ReJornadaMeta;
  situacao: JornadaSituacao;
  ata: { existe: boolean; enviada: boolean; status: string | null };
  forms: Partial<Record<RePassoId, Linha | null>>;
}

interface Props {
  caseId: string;
  studentCode: string;
  birthYear?: number | null;
  birthMonth?: number | null;
  schoolName?: string | null;
  professionalName?: string | null;
  /** Chamado depois que o envio ao médico deu certo (para a lista de casos atualizar o estado). */
  onSent?: (summary: string) => void;
}

const errText = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível concluir agora. Tente de novo.");
const hora = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const ROTULO_ESTADO: Record<RePassoEstado, string> = {
  bloqueado: "Bloqueado",
  disponivel: "Em andamento",
  concluido: "Concluído",
  pulado: "Não aplicado",
  aguardando_responsavel: "Aguardando o responsável",
};

const inputCls =
  "w-full rounded-xl border border-linha bg-white px-3 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-roxo/40 disabled:bg-fundo disabled:text-neutral-800";

const btnPrimario =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-roxo px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-roxo-800 disabled:cursor-not-allowed disabled:opacity-50";
const btnSecundario =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-linha bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-roxo-50 disabled:cursor-not-allowed disabled:opacity-50";

export function ReJourneyPanel({ caseId, studentCode, birthYear, birthMonth, schoolName, professionalName, onSent }: Props) {
  const base = `/api/cases/${caseId}`;
  const [j, setJ] = useState<Jornada | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [sel, setSel] = useState<RePassoId>("a");
  const [drafts, setDrafts] = useState<Partial<Record<ReFormId, Payload>>>({});
  const [snap, setSnap] = useState<Snap4Payload>(makeSnap4PayloadVazio());
  const [sum, setSum] = useState<FogapSecaoSumario>(sumarioComPadroes(null));
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [returnReason, setReturnReason] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentSummary, setSentSummary] = useState<string | null>(null);

  const dirty = useRef<Set<RePassoId>>(new Set());
  const latest = useRef({ drafts, snap, sum, j });
  latest.current = { drafts, snap, sum, j };
  const topo = useRef<HTMLDivElement>(null);

  const readOnly = j ? j.caseState !== "rascunho" : true;

  const hidratar = useCallback((d: Jornada) => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const id of ["a", "b", "c", "d", "e", "f"] as ReFormId[]) {
        if (!dirty.current.has(id)) next[id] = ((d.forms[id]?.payload as Payload) ?? {}) as Payload;
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
  }, []);

  const carregar = useCallback(
    async (inicial: boolean) => {
      try {
        const d = await api.get<Jornada>(`${base}/re-journey`);
        setJ(d);
        hidratar(d);
        if (inicial) setSel(d.situacao.atual ?? "i");
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

  const estadoDe = (id: RePassoId): RePassoEstado => j?.situacao.passos.find((p) => p.id === id)?.estado ?? "bloqueado";
  const editavel = (id: RePassoId) => !readOnly && estadoDe(id) !== "bloqueado";

  // ── Salvar ───────────────────────────────────────────────────────────────

  const salvar = useCallback(
    async (id: RePassoId, forcar = false): Promise<boolean> => {
      const { drafts: dr, snap: sn, sum: su, j: jj } = latest.current;
      if (!jj || jj.caseState !== "rascunho") return true;
      if (!forcar && !dirty.current.has(id)) return true;
      if (id === "h") return true;
      setSaving(true);
      try {
        if (isReFormId(id)) {
          await api.put(`${base}/re-journey/forms/${id}`, { payload: dr[id] ?? {} });
        } else if (id === "g") {
          if (jj.forms.g) await api.put(`${base}/re-assessment?formCode=${SNAP4_FORM_CODE}`, { payload: sn });
          else await api.post(`${base}/re-assessment?formCode=${SNAP4_FORM_CODE}`, { payload: sn });
        } else if (id === "i") {
          await api.put(`${base}/re-journey/sumario`, { secao_sumario: su });
        }
        dirty.current.delete(id);
        setSavedAt(hora());
        setJ((cur) =>
          cur ? { ...cur, forms: { ...cur.forms, [id]: { status: "rascunho", payload: cur.forms[id]?.payload ?? {}, updatedAt: new Date().toISOString() } } } : cur
        );
        return true;
      } catch (e) {
        setMsg({ ok: false, text: errText(e) });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [base]
  );

  // Salvamento automático: 1,5 s depois da última alteração do passo aberto.
  useEffect(() => {
    if (readOnly || !dirty.current.has(sel)) return;
    const t = setTimeout(() => void salvar(sel), 1500);
    return () => clearTimeout(t);
  }, [drafts, snap, sum, sel, readOnly, salvar]);

  const marcarAlterado = (id: RePassoId) => {
    dirty.current.add(id);
    setSavedAt(null);
    setMsg(null);
  };

  function editarForm(id: ReFormId, next: Payload) {
    marcarAlterado(id);
    setDrafts((d) => ({ ...d, [id]: next }));
  }

  // ── Navegação ────────────────────────────────────────────────────────────

  async function irPara(id: RePassoId) {
    if (estadoDe(id) === "bloqueado") return;
    if (!(await salvar(sel))) return;
    setSel(id);
    setMsg(null);
    topo.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function concluir(id: RePassoId) {
    setBusy(true);
    setMsg(null);
    try {
      const existe = Boolean(latest.current.j?.forms[id]);
      if (id !== "h" && !(await salvar(id, !existe))) return;
      const r = await api.post<{ situacao: JornadaSituacao }>(`${base}/re-journey/steps/${id}/conclude`, {});
      await carregar(false);
      const idx = RE_PASSOS.findIndex((p) => p.id === id);
      const proximo = RE_PASSOS[idx + 1];
      if (proximo) setSel(proximo.id);
      else setSel("i");
      setMsg({ ok: true, text: `Formulário ${RE_PASSOS[idx].letra} concluído.` });
      if (r.situacao.podeEnviar && id === "i") setMsg({ ok: true, text: "Tudo pronto: você já pode enviar ao médico." });
      topo.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  }

  async function alternar(passo: "g/skip" | "h/await", valor: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      await api.post(`${base}/re-journey/steps/${passo}`, { valor });
      await carregar(false);
      if (valor) setSel(passo === "g/skip" ? "h" : "i");
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  }

  async function enviarAoMedico() {
    setSending(true);
    try {
      const r = await api.post<{ summary?: string }>(`${base}/re-assessment/submit`, {});
      setConfirmSend(false);
      const resumo = r.summary ?? `Caso ${studentCode} encaminhado ao médico.`;
      setSentSummary(resumo);
      await carregar(false);
      onSent?.(resumo);
    } catch (e) {
      setConfirmSend(false);
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setSending(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="rounded-2xl border border-linha bg-white p-8 text-center text-sm text-neutral-800">Carregando a jornada do RE…</div>;
  }
  if (loadErr || !j) {
    return (
      <div role="alert" className="flex items-center gap-2 rounded-2xl border border-erro/30 bg-erro/5 p-4 text-sm text-black">
        <AlertCircle className="h-4 w-4 shrink-0" /> {loadErr ?? "Não foi possível abrir a jornada."}
        <button type="button" onClick={() => void carregar(true)} className="ml-auto underline">Tentar de novo</button>
      </div>
    );
  }

  const passo = RE_PASSOS.find((p) => p.id === sel)!;
  const idxSel = RE_PASSOS.findIndex((p) => p.id === sel);
  const resolvidos = j.situacao.passos.filter((p) => p.estado !== "bloqueado" && p.estado !== "disponivel").length;
  const estadoSel = estadoDe(sel);
  const emEdicao = editavel(sel);

  return (
    <div ref={topo} className="space-y-4 scroll-mt-4" data-testid="re-jornada">
      {returnReason !== null && !readOnly && (
        <div role="status" className="flex flex-col gap-1.5 rounded-xl border border-ouro-300 bg-ouro-50 px-4 py-3 text-sm text-black">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 shrink-0 text-amber-700" />
            <strong>O médico devolveu o caso para ajustes.</strong> Revise os formulários e envie de novo.
          </div>
          {returnReason && (
            <p className="rounded-lg border border-amber-200 bg-amber-100/70 p-2.5 text-xs text-amber-950">Motivo informado pelo médico: &ldquo;{returnReason}&rdquo;</p>
          )}
        </div>
      )}
      {readOnly && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-ceu-300 bg-ceu-50 px-4 py-3 text-sm text-black">
          <Lock className="h-4 w-4 shrink-0" /> Avaliação enviada ao médico — somente leitura até uma devolução.
        </div>
      )}

      {/* Passo a passo */}
      <nav aria-label="Sequência de formulários do RE" className="rounded-2xl border border-linha bg-white p-3 shadow-suave sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-black">
            Passo {idxSel + 1} de {RE_PASSOS.length} · Formulário {passo.letra}
          </p>
          <p className="text-xs text-neutral-800">{resolvidos} de {RE_PASSOS.length} etapas resolvidas</p>
        </div>
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-fundo" aria-hidden>
          <div className="h-full rounded-full bg-roxo transition-all" style={{ width: `${(resolvidos / RE_PASSOS.length) * 100}%` }} />
        </div>
        <ol className="flex gap-2 overflow-x-auto pb-1">
          {RE_PASSOS.map((p) => {
            const e = estadoDe(p.id);
            const ativo = p.id === sel;
            const bloqueado = e === "bloqueado";
            return (
              <li key={p.id} className="shrink-0">
                <button
                  type="button"
                  disabled={bloqueado}
                  aria-current={ativo ? "step" : undefined}
                  title={`${p.titulo} — ${ROTULO_ESTADO[e]}`}
                  onClick={() => void irPara(p.id)}
                  data-testid={`re-passo-${p.id}`}
                  className={`flex w-[104px] flex-col items-center gap-1 rounded-xl border px-2 py-2 text-center transition ${
                    ativo ? "border-roxo bg-roxo-50" : "border-linha bg-white hover:bg-roxo-50"
                  } ${bloqueado ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      e === "concluido" ? "bg-emerald-600 text-white" : e === "pulado" || e === "aguardando_responsavel" ? "bg-ouro-300 text-black" : ativo ? "bg-roxo text-white" : "bg-fundo text-black"
                    }`}
                  >
                    {e === "concluido" ? <Check className="h-4 w-4" aria-hidden /> : e === "bloqueado" ? <Lock className="h-3.5 w-3.5" aria-hidden /> : e === "aguardando_responsavel" ? <Clock className="h-4 w-4" aria-hidden /> : e === "pulado" ? <SkipForward className="h-4 w-4" aria-hidden /> : p.letra}
                  </span>
                  <span className="text-[11px] font-bold leading-tight text-black">{p.letra} · {p.tituloCurto}</span>
                  <span className="text-[10px] leading-tight text-neutral-700">{ROTULO_ESTADO[e]}</span>
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

      {/* Conteúdo do passo */}
      <section aria-labelledby="re-passo-titulo" className="space-y-4">
        <header>
          <h2 id="re-passo-titulo" className="text-lg font-bold text-black">{passo.titulo}</h2>
          {isReFormId(sel) && <p className="mt-0.5 text-sm text-neutral-800">{RE_FORMS[sel].dica}</p>}
        </header>

        {isReFormId(sel) && (
          <>
            {emEdicao && (
              <p className="text-xs text-neutral-800">
                Respondidos: {progressoReForm(sel, drafts[sel] ?? {}).respondidos} de {progressoReForm(sel, drafts[sel] ?? {}).total}. Pode deixar em branco o que não observou: em branco não vale como &ldquo;não&rdquo;.
              </p>
            )}
            {readOnly || estadoSel === "bloqueado" ? (
              <ReFormLeitura form={RE_FORMS[sel]} value={(drafts[sel] ?? {}) as Payload} />
            ) : (
              <ReFormRenderer form={RE_FORMS[sel]} value={(drafts[sel] ?? {}) as Payload} onChange={(n) => editarForm(sel, n)} />
            )}
          </>
        )}

        {sel === "g" && (
          <Snap4Passo
            snap={snap}
            readOnly={!emEdicao}
            pulado={estadoSel === "pulado"}
            onChange={(n) => {
              marcarAlterado("g");
              setSnap(n);
            }}
            onPular={(v) => void alternar("g/skip", v)}
            busy={busy}
          />
        )}

        {sel === "h" && (
          <AtaPasso
            estado={estadoSel}
            ataEnviada={j.ata.enviada}
            caseId={caseId}
            readOnly={readOnly}
            busy={busy}
            onAguardar={(v) => void alternar("h/await", v)}
            onMudou={() => void carregar(false)}
          />
        )}

        {sel === "i" && (
          <SumarioPasso
            sum={sum}
            readOnly={!emEdicao}
            onChange={(n) => {
              marcarAlterado("i");
              setSum(n);
            }}
            preview={
              <SumarioFormularioI
                studentCode={studentCode}
                birthYear={birthYear}
                birthMonth={birthMonth}
                schoolName={schoolName}
                payload={{ ...((j.forms.i?.payload as object) ?? {}), secao_sumario: sum }}
                professionalName={professionalName}
                modo={readOnly ? "enviado" : "rascunho"}
              />
            }
          />
        )}
      </section>

      {/* Rodapé de navegação */}
      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-linha bg-white/95 p-3 shadow-suave backdrop-blur">
        <button type="button" className={btnSecundario} disabled={idxSel === 0} onClick={() => void irPara(RE_PASSOS[idxSel - 1].id)}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Anterior
        </button>
        <span className="text-xs text-neutral-800" aria-live="polite">
          {saving ? "Salvando…" : savedAt ? `Salvo às ${savedAt}` : emEdicao && dirty.current.has(sel) ? "Alterações ainda não salvas" : ""}
        </span>
        <div className="flex flex-wrap gap-2">
          {emEdicao && sel !== "h" && (
            <button type="button" className={btnSecundario} disabled={saving || busy} onClick={() => void salvar(sel, true).then((ok) => ok && setMsg({ ok: true, text: "Rascunho salvo." }))}>
              <Save className="h-4 w-4" aria-hidden /> Salvar rascunho
            </button>
          )}
          {emEdicao && sel !== "h" && (
            <button type="button" className={btnPrimario} disabled={busy || saving} onClick={() => void concluir(sel)} data-testid="re-concluir">
              <Check className="h-4 w-4" aria-hidden />
              {estadoSel === "concluido" ? "Salvar e continuar" : sel === "i" ? "Concluir Sumário" : "Concluir e ir para o próximo"}
              {sel !== "i" && <ArrowRight className="h-4 w-4" aria-hidden />}
            </button>
          )}
          {sel === "h" && !readOnly && (estadoSel === "concluido" || estadoSel === "aguardando_responsavel") && (
            <button type="button" className={btnPrimario} onClick={() => void irPara("i")}>
              Ir para o Sumário <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          )}
          {sel !== "i" && (readOnly || estadoSel === "pulado") && idxSel < RE_PASSOS.length - 1 && (
            <button type="button" className={btnSecundario} onClick={() => void irPara(RE_PASSOS[idxSel + 1].id)}>
              Próximo <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Envio ao médico */}
      {!readOnly && (
        <section aria-labelledby="re-envio" className="rounded-2xl border border-roxo/30 bg-roxo-50 p-4 sm:p-5">
          <h3 id="re-envio" className="text-sm font-bold text-black">Enviar ao médico</h3>
          {j.situacao.podeEnviar ? (
            <>
              <p className="mt-1 text-sm text-black">Todos os formulários foram resolvidos. Depois do envio, a avaliação fica somente para leitura até o médico devolver.</p>
              <button type="button" className={`${btnPrimario} mt-3`} onClick={() => setConfirmSend(true)} data-testid="re-enviar">
                <Send className="h-4 w-4" aria-hidden /> Enviar ao médico
              </button>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-black">O envio libera quando todos os passos estiverem resolvidos. Falta:</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-black">
                {j.situacao.pendencias.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <ConfirmDialog
        open={confirmSend}
        onClose={() => setConfirmSend(false)}
        onConfirm={enviarAoMedico}
        title="Enviar a avaliação ao médico?"
        description="O caso será sumarizado e ficará na fila do Médico. Os formulários A a I ficam bloqueados para edição até uma devolução."
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
  const setRodape = (patch: Record<string, string | null>) => onChange({ ...snap, rodape: { ...rodape, ...patch } });

  if (pulado) {
    return (
      <div className="rounded-2xl border border-ouro-300 bg-ouro-50 p-4 text-sm text-black">
        <p><strong>SNAP-IV não aplicado.</strong> O Formulário G é opcional; a jornada segue para o H.</p>
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
      <div className="flex items-start gap-2 rounded-xl border border-ouro-300 bg-ouro-50 px-4 py-3 text-xs text-black">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
        <span>
          <strong>Instrumento incompleto (11 de 18 itens).</strong> Os itens 12 a 18 não constam na fonte e aguardam validação clínica. O sistema só registra as respostas; não calcula nem classifica.
        </span>
      </div>
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
          <p className="text-sm text-black">Não vai aplicar o SNAP-IV agora? Ele é opcional.</p>
          <button type="button" className={`${btnSecundario} mt-2`} disabled={busy} onClick={() => onPular(true)}>
            <SkipForward className="h-4 w-4" aria-hidden /> Não vou aplicar — seguir para o H
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
          ou marcar que está aguardando e seguir para o Sumário.
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
                <Clock className="h-4 w-4" aria-hidden /> Aguardando o responsável — seguir para o Sumário
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
  readOnly,
  onChange,
  preview,
}: {
  sum: FogapSecaoSumario;
  readOnly: boolean;
  onChange: (n: FogapSecaoSumario) => void;
  preview: React.ReactNode;
}) {
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
          <p className="text-xs text-neutral-800">Aluno, nascimento e escola vêm do cadastro. Use linguagem observável, sem nomes e sem diagnóstico.</p>
          <div>
            <label htmlFor="i-serie" className="mb-1 block text-sm font-semibold text-black">Série / ano escolar</label>
            <input id="i-serie" type="text" maxLength={SUMARIO_TEXTO_MAX} className={`${inputCls} max-w-xs`} value={sum.serie ?? ""} onChange={(e) => set({ serie: e.target.value })} />
          </div>
          <div>
            <label htmlFor="i-queixa" className="mb-1 block text-sm font-semibold text-black">Queixa do professor</label>
            <textarea id="i-queixa" rows={3} maxLength={SUMARIO_TEXTO_MAX} className={`${inputCls} resize-y`} value={sum.queixa_professor ?? ""} onChange={(e) => set({ queixa_professor: e.target.value })} />
          </div>
          <div>
            <label htmlFor="i-hipotese" className="mb-1 block text-sm font-semibold text-black">Hipótese diagnóstica do espectro (dimensão)</label>
            <textarea id="i-hipotese" rows={2} maxLength={SUMARIO_TEXTO_MAX} className={`${inputCls} resize-y`} value={sum.hipotese_espectro ?? ""} onChange={(e) => set({ hipotese_espectro: e.target.value })} />
            <p className="mt-1 text-[11px] text-neutral-700">Registro do profissional. O sistema não diagnostica.</p>
          </div>
          <div>
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
          <div className="space-y-3 rounded-xl border border-linha p-4">
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
            <p className="text-sm font-bold text-black">Encaminhado em (deixe em branco o que não se aplica)</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FOGAP_DESTINOS.map((d) => (
                <div key={d.key}>
                  <label htmlFor={`i-enc-${d.key}`} className="mb-1 block text-sm font-semibold text-black">{d.label}</label>
                  <input id={`i-enc-${d.key}`} type="date" max={hojeBrasilia()} className={inputCls} value={enc[d.key] ?? ""} onChange={(e) => setEnc({ [d.key]: e.target.value || null })} />
                </div>
              ))}
              <div>
                <label htmlFor="i-enc-outro-nome" className="mb-1 block text-sm font-semibold text-black">Outro (para quem)</label>
                <input id="i-enc-outro-nome" type="text" maxLength={120} className={inputCls} value={enc.outro_nome ?? ""} onChange={(e) => setEnc({ outro_nome: e.target.value })} />
              </div>
              <div>
                <label htmlFor="i-enc-outro" className="mb-1 block text-sm font-semibold text-black">Outro — data</label>
                <input id="i-enc-outro" type="date" max={hojeBrasilia()} className={inputCls} value={enc.outro ?? ""} onChange={(e) => setEnc({ outro: e.target.value || null })} />
              </div>
            </div>
          </div>
        </fieldset>
      )}
      {preview}
    </div>
  );
}
