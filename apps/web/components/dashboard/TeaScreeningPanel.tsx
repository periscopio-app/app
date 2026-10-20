"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ClipboardList, Lock, Sparkles, Scale } from "lucide-react";
import { api, ApiError } from "@/lib/api";

/**
 * Triagem TEA (5 instrumentos). Um único painel para todos os papéis: o servidor devolve só os instrumentos
 * que a pessoa preenche ou pode ler (caixinhas do Administrador Master) e, para cada um, `canFill`/`canRead`.
 * Nada aqui diagnostica: mostra somas de formulário e, se a caixinha estiver ligada, o texto de referência do formulário.
 */

type Code = "ata" | "asq" | "mchat" | "srs2" | "abc";

interface Meta {
  code: Code;
  title: string;
  shortTitle: string;
  chapter: string;
  fillerLabel: string;
  audience: string;
  instruction: string;
  scoring: "calculado" | "somente_registro";
  scoringNote: string;
  itemCount: number;
  license: { status: "confirmar" | "restrito" | "atribuicao"; note: string };
  respondentRequired: boolean;
}
interface AtaGroup { n: number; name: string; help?: string; options: string[] }
interface PlainItem { n: number; text: string; domain?: string }
interface Catalog {
  version: string;
  instruments: Meta[];
  content: {
    ata: { groups: AtaGroup[]; onsetLabel: string };
    asq: { items: PlainItem[]; skippedWhenNonverbal: number[] };
    mchat: { items: PlainItem[] };
    srs2: { items: PlainItem[]; scale: { value: number; label: string }[] };
    abc: { items: PlainItem[]; domains: { code: string; label: string }[] };
  };
  respondents: { value: string; label: string }[];
}
interface Score {
  computed: boolean;
  total: number | null;
  max: number | null;
  parts: { key: string; label: string; points: number; max: number }[];
  answered: number;
  required: number;
  complete: boolean;
  notes: string[];
  reference?: { notes: string[]; reached?: { label: string; value: boolean }[] };
}
interface Screening {
  status: "rascunho" | "enviado";
  respondent: string | null;
  appliedOn: string | null;
  answers: any;
  score?: Score;
  submittedAt: string | null;
}
interface CaseTea {
  journeyState: string;
  canSummarize: boolean;
  instruments: { code: Code; canFill: boolean; canRead: boolean; screening: Screening | null }[];
}
interface SummaryOut {
  source: "ia" | "regras";
  notice: string;
  instruments: Code[];
  summary: {
    visaoGeral: string;
    porInstrumento: { instrumento: Code; titulo: string; pontos: string[] }[];
    lacunas: string[];
    perguntasAoProfissional: string[];
  };
}

const emptyAnswers = (c: Code) => (c === "ata" ? { marcados: {}, antes36meses: null } : { items: {} });
const today = () => new Date().toISOString().slice(0, 10);
const errText = (e: unknown) => (e instanceof ApiError ? e.message : "Não foi possível concluir. Tente novamente.");

const LICENSE_TEXT: Record<Meta["license"]["status"], string> = {
  restrito: "Instrumento com direitos reservados da editora. Use no piloto somente com licença confirmada.",
  confirmar: "Direitos de uso a confirmar antes de ampliar o uso.",
  atribuicao: "Uso com atribuição dos autores.",
};

export function TeaScreeningPanel({ caseId, onChanged }: { caseId: string; onChanged?: () => void }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [data, setData] = useState<CaseTea | null>(null);
  const [active, setActive] = useState<Code | null>(null);
  const [answers, setAnswers] = useState<any>(null);
  const [respondent, setRespondent] = useState("");
  const [appliedOn, setAppliedOn] = useState(today());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [summary, setSummary] = useState<SummaryOut | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const loadedFor = useRef<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    // só mostra "carregando" na primeira vez de cada caso; depois recarrega sem desmontar o formulário
    if (loadedFor.current !== caseId) setLoading(true);
    try {
      const [cat, tea] = await Promise.all([api.get<Catalog>("/api/tea/catalog"), api.get<CaseTea>(`/api/cases/${caseId}/tea`)]);
      setCatalog(cat);
      setData(tea);
      setDenied(false);
      loadedFor.current = caseId;
      setActive((cur) => (cur && tea.instruments.some((i) => i.code === cur) ? cur : (tea.instruments.find((i) => i.canFill) ?? tea.instruments[0])?.code ?? null));
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) setDenied(true);
      else setMsg({ kind: "erro", text: errText(e) });
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    setSummary(null);
    setMsg(null);
    void load();
  }, [load]);

  const current = useMemo(() => data?.instruments.find((i) => i.code === active) ?? null, [data, active]);
  const meta = useMemo(() => catalog?.instruments.find((i) => i.code === active) ?? null, [catalog, active]);

  // ao trocar de instrumento (ou depois de salvar), carrega as respostas guardadas
  useEffect(() => {
    if (!active) return;
    const s = current?.screening;
    setAnswers(s?.answers ?? emptyAnswers(active));
    setRespondent(s?.respondent ?? "");
    setAppliedOn(s?.appliedOn ?? today());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, current?.screening?.status, current?.screening?.submittedAt]);

  useEffect(() => {
    setMsg(null);
    setDirty(false);
    setSavedAt(null);
  }, [active]);

  // salva sozinho 20 s depois da última alteração (rascunho), para ninguém perder o que já marcou
  useEffect(() => {
    if (!dirty || busy || !active) return;
    const c = data?.instruments.find((i) => i.code === active);
    if (!c?.canFill || c.screening?.status === "enviado" || data?.journeyState === "encerrado") return;
    const t = setTimeout(() => void save(true), 20000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, answers, respondent, appliedOn, busy, active, data]);

  useEffect(() => {
    if (!dirty) return;
    const aviso = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [dirty]);

  if (loading) return <div className="rounded-2xl border border-linha bg-white p-4 text-xs text-neutral-800">Carregando triagem TEA…</div>;
  if (denied || !catalog || !data || data.instruments.length === 0) return null;

  const locked = !current?.canFill || current?.screening?.status === "enviado" || data.journeyState === "encerrado";
  const submitted = current?.screening?.status === "enviado";

  async function save(silent = false): Promise<boolean> {
    if (!active) return false;
    setBusy(true);
    if (!silent) setMsg(null);
    try {
      await api.put(`/api/cases/${caseId}/tea/${active}`, {
        answers,
        respondent: respondent || undefined,
        appliedOn: appliedOn || undefined,
      });
      await load();
      setDirty(false);
      setSavedAt(new Date());
      if (!silent) setMsg({ kind: "ok", text: "Rascunho salvo." });
      return true;
    } catch (e) {
      if (!silent) setMsg({ kind: "erro", text: errText(e) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!active) return;
    if (!window.confirm("Enviar o formulário? Depois do envio as respostas não podem mais ser alteradas.")) return;
    if (!(await save())) return;
    setBusy(true);
    try {
      await api.post(`/api/cases/${caseId}/tea/${active}/submit`, {});
      await load();
      setMsg({ kind: "ok", text: "Formulário enviado e travado." });
      onChanged?.();
    } catch (e) {
      setMsg({ kind: "erro", text: errText(e) });
    } finally {
      setBusy(false);
    }
  }

  async function summarize() {
    setSummarizing(true);
    setMsg(null);
    try {
      setSummary(await api.post<SummaryOut>(`/api/cases/${caseId}/tea/summary`, {}));
    } catch (e) {
      setMsg({ kind: "erro", text: errText(e) });
    } finally {
      setSummarizing(false);
    }
  }

  const editAnswers: typeof setAnswers = (u) => {
    setDirty(true);
    setAnswers(u);
  };
  const setItem = (n: number, v: unknown) => editAnswers((a: any) => ({ ...a, items: { ...a.items, [String(n)]: v } }));
  const clearItem = (n: number) =>
    editAnswers((a: any) => {
      const items = { ...a.items };
      delete items[String(n)];
      return { ...a, items };
    });

  function renderForm() {
    if (!active || !answers) return null;
    const dis = locked || busy;
    if (active === "ata") {
      const c = catalog!.content.ata;
      return (
        <div className="space-y-4">
          {c.groups.map((g) => {
            const marked: number[] = answers.marcados?.[String(g.n)] ?? [];
            return (
              <fieldset key={g.n} id={`ata-g-${g.n}`} className={`scroll-mt-28 rounded-xl border p-3 ${marked.length ? "border-roxo/50 bg-roxo-50/40" : "border-linha"}`}>
                <legend className="px-1 text-xs font-bold text-black">
                  {g.n}. {g.name}
                  {marked.length > 0 && <span className="ml-2 rounded-full bg-roxo-100 px-2 py-0.5 text-[10px] font-semibold">{marked.length} marcado(s)</span>}
                </legend>
                {g.help && <p className="mb-2 text-[11px] text-neutral-800">{g.help}</p>}
                <div className="space-y-1">
                  {g.options.map((o, i) => (
                    <label key={i} className="flex min-h-9 cursor-pointer items-start gap-2 rounded-lg px-1 py-1.5 text-sm text-black hover:bg-fundo">
                      <input
                        type="checkbox"
                        disabled={dis}
                        checked={marked.includes(i)}
                        onChange={(e) =>
                          editAnswers((a: any) => {
                            const cur: number[] = a.marcados?.[String(g.n)] ?? [];
                            const next = e.target.checked ? [...cur, i].sort((x, y) => x - y) : cur.filter((x) => x !== i);
                            const marcados = { ...a.marcados };
                            if (next.length) marcados[String(g.n)] = next;
                            else delete marcados[String(g.n)];
                            return { ...a, marcados };
                          })
                        }
                        className="mt-0.5"
                      />
                      <span>{o}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
          <fieldset className="rounded-xl border border-linha p-3">
            <legend className="px-1 text-xs font-bold text-black">{c.onsetLabel}</legend>
            <div className="flex gap-4 text-sm text-black">
              {[
                { v: true, l: "Sim" },
                { v: false, l: "Não" },
              ].map((o) => (
                <label key={o.l} className="flex items-center gap-1.5">
                  <input type="radio" name="ata-onset" disabled={dis} checked={answers.antes36meses === o.v} onChange={() => editAnswers((a: any) => ({ ...a, antes36meses: o.v }))} />
                  {o.l}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      );
    }

    if (active === "asq" || active === "mchat") {
      const items = active === "asq" ? catalog!.content.asq.items : catalog!.content.mchat.items;
      const skipped = active === "asq" ? catalog!.content.asq.skippedWhenNonverbal : [];
      const nonverbal = active === "asq" && answers.items?.["1"] === "nao";
      return (
        <div className="space-y-2">
          {items.map((it) => {
            const hidden = nonverbal && skipped.includes(it.n);
            if (hidden) {
              return (
                <div key={it.n} className="rounded-xl border border-dashed border-linha px-3 py-2 text-xs text-neutral-800">
                  {it.n}. Não se aplica (a criança não conversa com frases curtas).
                </div>
              );
            }
            return (
              <div key={it.n} className="rounded-xl border border-linha px-3 py-2">
                <p className="text-sm text-black">
                  <span className="font-semibold">{it.n}.</span> {it.text}
                </p>
                <div className="mt-1 flex gap-4 text-sm text-black">
                  {(["sim", "nao"] as const).map((v) => (
                    <label key={v} className="flex items-center gap-1.5">
                      <input type="radio" name={`${active}-${it.n}`} disabled={dis} checked={answers.items?.[String(it.n)] === v} onChange={() => setItem(it.n, v)} />
                      {v === "sim" ? "Sim" : "Não"}
                    </label>
                  ))}
                  {!dis && answers.items?.[String(it.n)] && (
                    <button type="button" className="text-[11px] text-neutral-800 underline" onClick={() => clearItem(it.n)}>
                      limpar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (active === "srs2") {
      const c = catalog!.content.srs2;
      return (
        <div className="space-y-2">
          {c.items.map((it) => (
            <div key={it.n} className="rounded-xl border border-linha px-3 py-2">
              <p className="text-sm text-black">
                <span className="font-semibold">{it.n}.</span> {it.text}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-black">
                {c.scale.map((s) => (
                  <label key={s.value} className="flex items-center gap-1.5">
                    <input type="radio" name={`srs2-${it.n}`} disabled={dis} checked={answers.items?.[String(it.n)] === s.value} onChange={() => setItem(it.n, s.value)} />
                    {s.value} · {s.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    // abc
    const c = catalog!.content.abc;
    return (
      <div className="space-y-4">
        {c.domains.map((d) => (
          <fieldset key={d.code} className="rounded-xl border border-linha p-3">
            <legend className="px-1 text-xs font-bold text-black">{d.label}</legend>
            <div className="space-y-1">
              {c.items
                .filter((i) => i.domain === d.code)
                .map((it) => (
                  <label key={it.n} className="flex items-start gap-2 text-sm text-black">
                    <input type="checkbox" disabled={dis} checked={answers.items?.[String(it.n)] === true} onChange={(e) => (e.target.checked ? setItem(it.n, true) : clearItem(it.n))} className="mt-0.5" />
                    <span>
                      {it.n}. {it.text}
                    </span>
                  </label>
                ))}
            </div>
          </fieldset>
        ))}
      </div>
    );
  }

  const score = current?.screening?.score;

  // andamento em linguagem simples (só conta; não interpreta)
  const progresso = (() => {
    if (!active || !answers || !catalog) return null;
    if (active === "ata") {
      const total = catalog.content.ata.groups.length;
      const feitos = Object.keys(answers.marcados ?? {}).length;
      return { feitos, total, rotulo: "grupos com algo marcado" };
    }
    if (active === "abc") return null;
    const lista = active === "asq" ? catalog.content.asq.items : active === "mchat" ? catalog.content.mchat.items : catalog.content.srs2.items;
    const feitos = Object.keys(answers.items ?? {}).length;
    return { feitos, total: lista.length, rotulo: "perguntas respondidas" };
  })();

  return (
    <section className="rounded-2xl border border-linha bg-white p-4 shadow-suave space-y-4" aria-label="Triagem TEA">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-black">
            <ClipboardList className="h-4 w-4" /> Triagem TEA — formulários
          </h3>
          <p className="text-[11px] text-neutral-800">Organiza o que a equipe marcou. Não é diagnóstico e não substitui a avaliação do profissional responsável.</p>
        </div>
        {data.canSummarize && (
          <button type="button" onClick={summarize} disabled={summarizing} className="flex items-center gap-1.5 rounded-xl border border-roxo bg-roxo-100 px-3 py-1.5 text-xs font-semibold text-black hover:bg-roxo-200 disabled:opacity-60">
            <Sparkles className="h-3.5 w-3.5" />
            {summarizing ? "Organizando…" : "Resumo organizado (IA)"}
          </button>
        )}
      </header>

      <div role="tablist" className="flex flex-wrap gap-1">
        {data.instruments.map((i) => {
          const m = catalog.instruments.find((x) => x.code === i.code);
          const st = i.screening?.status;
          return (
            <button
              key={i.code}
              role="tab"
              aria-selected={active === i.code}
              onClick={() => setActive(i.code)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${active === i.code ? "border-roxo bg-roxo-100 text-black" : "border-linha text-black hover:bg-fundo"}`}
            >
              {m?.shortTitle ?? i.code}
              {st === "enviado" ? " ✓" : st === "rascunho" ? " …" : ""}
            </button>
          );
        })}
      </div>

      {meta && (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-bold text-black">{meta.title}</p>
            <p className="text-[11px] text-neutral-800">
              {meta.chapter} · quem preenche: {meta.fillerLabel}
            </p>
            <p className="mt-1 text-xs text-black">{meta.instruction}</p>
          </div>

          {(meta.license.status !== "atribuicao" || meta.code === "mchat") && (
            <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] text-black ${meta.license.status === "restrito" ? "border-erro/30 bg-erro/5" : "border-amber-200 bg-amber-50"}`}>
              <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>Direitos de uso:</strong> {LICENSE_TEXT[meta.license.status]} {meta.license.note}
              </span>
            </div>
          )}

          {meta.scoring === "somente_registro" && <p className="text-[11px] text-neutral-800">{meta.scoringNote}</p>}

          {submitted && (
            <div className="flex items-center gap-2 rounded-xl border border-sucesso/20 bg-sucesso/5 px-3 py-2 text-xs text-black">
              <Lock className="h-3.5 w-3.5" /> Enviado e travado. As respostas não podem mais ser alteradas.
            </div>
          )}
          {!current?.canFill && !submitted && <p className="text-[11px] text-neutral-800">Você pode consultar este formulário, mas não preenchê-lo.</p>}
          {!current?.screening && !current?.canFill && <p className="text-xs text-neutral-800">Ainda não foi preenchido.</p>}

          {current?.canFill && !submitted && (
            <details className="rounded-xl border border-linha bg-fundo px-3 py-2 text-xs text-black" open={!current?.screening}>
              <summary className="cursor-pointer font-semibold">Como preencher (passo a passo)</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>{meta.audience}</li>
                <li>Marque só o que foi relatado. Se não souber, deixe em branco: o sistema não troca “em branco” por “não”.</li>
                <li>O rascunho é salvo sozinho a cada 20 segundos. Você pode sair e voltar depois.</li>
                <li>Quando terminar, use “Enviar e travar”. O sistema avisa se faltar algo obrigatório.</li>
              </ol>
            </details>
          )}

          {progresso && !submitted && (
            <div className="sticky top-0 z-10 -mx-1 rounded-xl border border-linha bg-white/95 px-3 py-2 backdrop-blur">
              <div className="flex items-center justify-between text-xs font-semibold text-black">
                <span>
                  {progresso.feitos} de {progresso.total} {progresso.rotulo}
                </span>
                <span className="font-normal text-neutral-700">
                  {busy ? "Salvando…" : dirty ? "Alterações ainda não salvas" : savedAt ? `Salvo às ${savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-linha" role="progressbar" aria-valuemin={0} aria-valuemax={progresso.total} aria-valuenow={progresso.feitos} aria-label="Andamento do preenchimento">
                <div className="h-full bg-roxo transition-all" style={{ width: `${Math.round((progresso.feitos / Math.max(1, progresso.total)) * 100)}%` }} />
              </div>
              {active === "ata" && (
                <nav aria-label="Ir para o grupo" className="mt-2 flex flex-wrap gap-1">
                  {catalog.content.ata.groups.map((g) => {
                    const marcado = (answers?.marcados?.[String(g.n)] ?? []).length > 0;
                    return (
                      <a
                        key={g.n}
                        href={`#ata-g-${g.n}`}
                        className={`flex h-6 min-w-6 items-center justify-center rounded-md border px-1 text-[11px] font-semibold ${marcado ? "border-roxo bg-roxo-100 text-black" : "border-linha text-neutral-800 hover:bg-fundo"}`}
                        aria-label={`Grupo ${g.n}${marcado ? ", com marcação" : ", sem marcação"}`}
                      >
                        {g.n}
                      </a>
                    );
                  })}
                </nav>
              )}
            </div>
          )}

          {(current?.canFill || current?.screening) && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-black">
                  Quem respondeu
                  <select disabled={locked || busy} value={respondent} onChange={(e) => { setDirty(true); setRespondent(e.target.value); }} className="mt-1 block w-full rounded-xl border border-linha px-3 py-2 text-sm font-normal text-black disabled:bg-fundo">
                    <option value="">Selecione…</option>
                    {catalog.respondents.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-black">
                  Data da aplicação
                  <input type="date" max={today()} disabled={locked || busy} value={appliedOn} onChange={(e) => { setDirty(true); setAppliedOn(e.target.value); }} className="mt-1 block w-full rounded-xl border border-linha px-3 py-2 text-sm font-normal text-black disabled:bg-fundo" />
                </label>
              </div>

              <div>{renderForm()}</div>
            </>
          )}

          {score && (
            <div className="rounded-xl border border-linha bg-fundo px-3 py-2 text-xs text-black space-y-1">
              <p className="font-semibold">
                {score.computed && score.total !== null
                  ? `Soma pela regra do formulário: ${score.total} de ${score.max} pontos`
                  : "O sistema não calcula pontuação para este instrumento"}
                {score.required > 0 && ` · ${score.answered} de ${score.required} respondidas`}
              </p>
              {score.parts.filter((p) => p.points > 0).length > 0 && (
                <p>
                  {score.parts
                    .filter((p) => p.points > 0)
                    .map((p) => `${p.label}: ${p.points}/${p.max}`)
                    .join(" · ")}
                </p>
              )}
              {score.notes.map((n, i) => (
                <p key={i} className="text-neutral-800">
                  {n}
                </p>
              ))}
              {score.reference && (
                <div className="mt-1 border-t border-linha pt-1 text-neutral-800">
                  <p className="font-semibold text-black">Texto de referência do formulário (não é diagnóstico)</p>
                  {score.reference.notes.map((n, i) => (
                    <p key={i}>{n}</p>
                  ))}
                  {score.reference.reached?.map((r, i) => (
                    <p key={i}>
                      {r.label}: {r.value ? "atingido" : "não atingido"}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {msg && (
            <div role="status" className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-black ${msg.kind === "ok" ? "bg-sucesso/10" : "bg-erro/10"}`}>
              {msg.kind === "ok" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              {msg.text}
            </div>
          )}

          {!locked && (
            <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 border-t border-linha bg-white/95 py-3 backdrop-blur">
              <button type="button" disabled={busy} onClick={() => void save()} className="rounded-xl border border-linha px-4 py-2 text-sm font-semibold text-black hover:bg-fundo disabled:opacity-60">
                Salvar rascunho
              </button>
              <button type="button" disabled={busy} onClick={() => void submit()} className="flex items-center gap-2 rounded-xl border border-roxo bg-roxo-100 px-5 py-2 text-sm font-semibold text-black hover:bg-roxo-200 disabled:opacity-60">
                <CheckCircle2 className="h-4 w-4" /> Enviar e travar
              </button>
            </div>
          )}
        </div>
      )}

      {summary && (
        <div className="space-y-2 rounded-xl border border-roxo/40 bg-roxo-50 p-3 text-xs text-black">
          <div className="flex items-center justify-between">
            <p className="font-bold">Resumo organizado — {summary.source === "ia" ? "assistente de IA (revalidado pelo sistema)" : "montado por regras do sistema"}</p>
            <button type="button" className="text-[11px] underline" onClick={() => setSummary(null)}>
              fechar
            </button>
          </div>
          <p>{summary.summary.visaoGeral}</p>
          {summary.summary.porInstrumento.map((p) => (
            <div key={p.instrumento}>
              <p className="font-semibold">{p.titulo}</p>
              <ul className="list-disc pl-5">
                {p.pontos.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
          {summary.summary.lacunas.length > 0 && (
            <div>
              <p className="font-semibold">Lacunas</p>
              <ul className="list-disc pl-5">
                {summary.summary.lacunas.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="font-semibold">Perguntas para o profissional</p>
            <ul className="list-disc pl-5">
              {summary.summary.perguntasAoProfissional.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
          <p className="border-t border-roxo/30 pt-1 text-[11px] text-neutral-800">{summary.notice}</p>
        </div>
      )}
    </section>
  );
}
