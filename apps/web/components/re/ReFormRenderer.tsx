"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { RE_TEXTO_MAX, lerGenograma, type ReCampo, type ReFormDef, type ReOpcao } from "@periscopio/shared";
import { GenogramaEditor } from "@/components/genograma/GenogramaEditor";
import { GenogramaDesenho } from "@/components/genograma/GenogramaDesenho";

type Payload = Record<string, any>;

export interface ProfessorOpcao {
  id: string;
  name: string;
}

/** Contexto do formulário que vem da escola (professores cadastrados) e de quais campos destacar como "em branco". */
export interface ReContexto {
  professores?: ProfessorOpcao[];
  /** Chaves de campo (ou "campo|linha") a destacar depois que o RE tentou concluir. */
  destacar?: Set<string>;
  /** Pede uma sugestão de redação (IA com trava) para as observações, a partir do formulário atual. */
  sugerirObservacoes?: (formId: string, payload: Record<string, any>) => Promise<{ texto: string; source: "ia" | "regras"; aviso: string }>;
}

const pill = (ativo: boolean, desabilitado: boolean) =>
  `min-h-[44px] rounded-xl border px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-roxo/50 ${
    ativo ? "border-roxo bg-roxo text-white shadow-sm" : "border-linha bg-white text-black hover:bg-roxo-50"
  } ${desabilitado ? "cursor-default opacity-80" : ""}`;

const inputCls =
  "w-full rounded-xl border border-linha bg-white px-3 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-roxo/40 disabled:bg-fundo disabled:text-neutral-800";

const faltaCls = "rounded-xl border-l-4 border-l-erro bg-erro/5 pl-3";

/** Botões grandes de escolha única. Clicar de novo na opção marcada desmarca (volta a ficar em branco). */
export function OpcoesUnica({
  opcoes,
  valor,
  onChange,
  desabilitado,
  nome,
}: {
  opcoes: ReOpcao[];
  valor: string | null | undefined;
  onChange: (v: string | null) => void;
  desabilitado?: boolean;
  nome: string;
}) {
  return (
    <div role="radiogroup" aria-label={nome} className="flex flex-wrap gap-2">
      {opcoes.map((op) => {
        const ativo = valor === op.value;
        return (
          <button
            key={op.value}
            type="button"
            role="radio"
            aria-checked={ativo}
            disabled={desabilitado}
            onClick={() => onChange(ativo ? null : op.value)}
            className={pill(ativo, !!desabilitado)}
          >
            {op.label}
          </button>
        );
      })}
    </div>
  );
}

/** Botões de várias respostas (liga/desliga cada opção). */
export function OpcoesMultipla({
  opcoes,
  valor,
  onChange,
  desabilitado,
  nome,
}: {
  opcoes: ReOpcao[];
  valor: string[];
  onChange: (v: string[]) => void;
  desabilitado?: boolean;
  nome: string;
}) {
  return (
    <div role="group" aria-label={nome} className="flex flex-wrap gap-2">
      {opcoes.map((op) => {
        const ativo = valor.includes(op.value);
        return (
          <button
            key={op.value}
            type="button"
            aria-pressed={ativo}
            disabled={desabilitado}
            onClick={() => onChange(ativo ? valor.filter((x) => x !== op.value) : [...valor, op.value])}
            className={pill(ativo, !!desabilitado)}
          >
            {op.label}
          </button>
        );
      })}
    </div>
  );
}

function ObsCampo({ id, valor, onChange, readOnly, rotulo = "Observação (opcional)" }: { id: string; valor: string; onChange: (v: string) => void; readOnly: boolean; rotulo?: string }) {
  return (
    <div className="mt-2">
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-neutral-800">{rotulo}</label>
      <textarea
        id={id}
        rows={2}
        maxLength={RE_TEXTO_MAX}
        disabled={readOnly}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} resize-y`}
        placeholder="Se quiser, explique o que observou nesta pergunta."
      />
    </div>
  );
}

function celulaComoLista(r: unknown): string[] {
  return Array.isArray(r) ? (r as string[]) : typeof r === "string" && r ? [r] : [];
}

/** Botão "Sugerir texto" para o campo de observações: mostra a sugestão numa caixa e a RE decide usar ou descartar. */
function SugestaoObservacao({ formId, value, onUsar, sugerir }: { formId: string; value: Payload; onUsar: (texto: string) => void; sugerir: NonNullable<ReContexto["sugerirObservacoes"]> }) {
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [sug, setSug] = useState<{ texto: string; source: "ia" | "regras"; aviso: string } | null>(null);
  async function pedir() {
    setBusy(true);
    setErro("");
    try {
      setSug(await sugerir(formId, value));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar a sugestão agora.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-2 space-y-2">
      <button type="button" onClick={pedir} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-roxo bg-roxo-50 px-3 py-1.5 text-xs font-semibold text-black hover:bg-roxo-100 disabled:opacity-60">
        <Sparkles className="h-3.5 w-3.5" aria-hidden /> {busy ? "Preparando…" : "Sugerir texto com base no que preenchi"}
      </button>
      {erro && <p role="alert" className="text-xs font-semibold text-erro">{erro}</p>}
      {sug && (
        <div className="space-y-2 rounded-xl border border-roxo/40 bg-roxo-50 p-3 text-sm text-black" role="status">
          <p className="text-[11px] font-semibold text-neutral-800">
            {sug.source === "ia" ? "Sugestão do assistente (conferida pelo sistema)" : "Sugestão montada pelas regras do sistema"}
          </p>
          <p className="whitespace-pre-wrap">{sug.texto}</p>
          <p className="text-[11px] text-neutral-800">{sug.aviso}</p>
          <div className="flex gap-2">
            <button type="button" className="rounded-lg bg-roxo px-3 py-1.5 text-xs font-semibold text-white" onClick={() => { onUsar(sug.texto); setSug(null); }}>
              Usar este texto
            </button>
            <button type="button" className="rounded-lg border border-linha bg-white px-3 py-1.5 text-xs font-semibold" onClick={() => setSug(null)}>
              Descartar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CampoView({
  campo,
  formId,
  value,
  onChange,
  readOnly,
  ctx,
}: {
  campo: ReCampo;
  formId: string;
  value: Payload;
  onChange: (patch: Payload) => void;
  readOnly: boolean;
  ctx: ReContexto;
}) {
  const id = `re-${formId}-${campo.key}`;
  const falta = ctx.destacar?.has(campo.key) ?? false;
  const wrap = (children: React.ReactNode) => (
    <div data-campo={`${formId}:${campo.key}`} className={`scroll-mt-28 ${falta ? faltaCls : ""}`}>
      {children}
      {falta && <p className="mt-1 text-xs font-semibold text-erro">Em branco</p>}
    </div>
  );
  const rotulo = (
    <div className="mb-1.5">
      <p id={`${id}-l`} className="text-sm font-semibold text-black">{campo.label}</p>
      {campo.ajuda && <p className="text-xs text-neutral-700">{campo.ajuda}</p>}
    </div>
  );

  if (campo.tipo === "texto") {
    const ehData = campo.key === "data_aplicacao";
    return wrap(
      <>
        <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-black">{campo.label}</label>
        {campo.ajuda && <p className="-mt-1 mb-1.5 text-xs text-neutral-700">{campo.ajuda}</p>}
        <input
          id={id}
          type={ehData ? "date" : "text"}
          maxLength={ehData ? undefined : RE_TEXTO_MAX}
          disabled={readOnly}
          value={value[campo.key] ?? ""}
          onChange={(e) => onChange({ [campo.key]: e.target.value })}
          className={ehData ? `${inputCls} max-w-xs` : inputCls}
        />
      </>
    );
  }

  if (campo.tipo === "texto_longo") {
    return wrap(
      <>
        <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-black">{campo.label}</label>
        {campo.ajuda && <p className="-mt-1 mb-1.5 text-xs text-neutral-700">{campo.ajuda}</p>}
        <textarea id={id} rows={3} maxLength={RE_TEXTO_MAX} disabled={readOnly} value={value[campo.key] ?? ""} onChange={(e) => onChange({ [campo.key]: e.target.value })} className={`${inputCls} resize-y`} />
        {campo.key === "observacoes" && !readOnly && ctx.sugerirObservacoes && (
          <SugestaoObservacao formId={formId} value={value} sugerir={ctx.sugerirObservacoes} onUsar={(texto) => onChange({ [campo.key]: texto.slice(0, RE_TEXTO_MAX) })} />
        )}
      </>
    );
  }

  if (campo.tipo === "genograma") {
    const bruto = value[campo.key];
    return wrap(
      <>
        <p className="mb-1.5 text-sm font-semibold text-black">{campo.label}</p>
        {campo.ajuda && <p className="-mt-1 mb-1.5 text-xs text-neutral-700">{campo.ajuda}</p>}
        <GenogramaEditor idBase={id} value={typeof bruto === "string" ? bruto : ""} onChange={(texto) => onChange({ [campo.key]: texto })} disabled={readOnly} />
      </>
    );
  }

  if (campo.tipo === "professor") {
    const atual = (value[campo.key] ?? {}) as { id?: string | null; nome?: string };
    const lista = ctx.professores ?? [];
    return wrap(
      <>
        {rotulo}
        {lista.length > 0 ? (
          <>
            <select
              aria-labelledby={`${id}-l`}
              disabled={readOnly}
              value={atual.id ?? ""}
              onChange={(e) => {
                const p = lista.find((x) => x.id === e.target.value);
                onChange({ [campo.key]: p ? { id: p.id, nome: p.name } : { id: null, nome: "" } });
              }}
              className={`${inputCls} max-w-md`}
            >
              <option value="">Escolha o(a) professor(a)</option>
              {lista.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-700">Lista de professores cadastrados nesta escola. Quando há um só, ele já vem escolhido.</p>
          </>
        ) : (
          <>
            <input
              id={id}
              type="text"
              maxLength={200}
              disabled={readOnly}
              value={atual.nome ?? ""}
              onChange={(e) => onChange({ [campo.key]: { nome: e.target.value } })}
              className={`${inputCls} max-w-md`}
              placeholder="Nome do(a) professor(a)"
            />
            <p className="mt-1 text-xs text-neutral-700">Nenhum professor cadastrado nesta escola ainda. Digite só o nome do(a) professor(a) entrevistado(a).</p>
          </>
        )}
      </>
    );
  }

  if (campo.tipo === "unica") {
    const atual: string | null = value[campo.key] ?? null;
    const comTexto = campo.opcoes.find((o) => o.value === atual && o.pedeTexto);
    return wrap(
      <>
        {rotulo}
        <OpcoesUnica nome={campo.label} opcoes={campo.opcoes} valor={atual} desabilitado={readOnly} onChange={(v) => onChange({ [campo.key]: v })} />
        {comTexto && (
          <div className="mt-2">
            <label htmlFor={`${id}-t`} className="mb-1 block text-xs font-semibold text-black">{comTexto.pedeTexto}</label>
            <input id={`${id}-t`} type="text" maxLength={RE_TEXTO_MAX} disabled={readOnly} value={value[`${campo.key}__texto`] ?? ""} onChange={(e) => onChange({ [`${campo.key}__texto`]: e.target.value })} className={inputCls} />
          </div>
        )}
        {campo.comObs && <ObsCampo id={`${id}-obs`} valor={value[`${campo.key}__obs`] ?? ""} onChange={(v) => onChange({ [`${campo.key}__obs`]: v })} readOnly={readOnly} />}
      </>
    );
  }

  if (campo.tipo === "multipla") {
    const marcados: string[] = celulaComoLista(value[campo.key]);
    return wrap(
      <>
        {rotulo}
        <OpcoesMultipla nome={campo.label} opcoes={campo.opcoes} valor={marcados} desabilitado={readOnly} onChange={(v) => onChange({ [campo.key]: v })} />
        {campo.outros && (
          <div className="mt-2">
            <label htmlFor={`${id}-o`} className="mb-1 block text-xs font-semibold text-black">{campo.outros}</label>
            <input id={`${id}-o`} type="text" maxLength={RE_TEXTO_MAX} disabled={readOnly} value={value[`${campo.key}__outros`] ?? ""} onChange={(e) => onChange({ [`${campo.key}__outros`]: e.target.value })} className={inputCls} />
          </div>
        )}
        {campo.comObs && <ObsCampo id={`${id}-obs`} valor={value[`${campo.key}__obs`] ?? ""} onChange={(v) => onChange({ [`${campo.key}__obs`]: v })} readOnly={readOnly} />}
      </>
    );
  }

  // matriz
  const dados: Record<string, { r?: string | string[] | null; obs?: string; n?: number | null }> = value[campo.key] ?? {};
  const setLinha = (k: string, patch: Record<string, unknown>) => {
    const atualLinha = dados[k] ?? {};
    onChange({ [campo.key]: { ...dados, [k]: { ...atualLinha, ...patch } } });
  };
  return (
    <div data-campo={`${formId}:${campo.key}`} className="scroll-mt-28">
      {rotulo}
      <ul className="divide-y divide-linha overflow-hidden rounded-xl border border-linha bg-white">
        {campo.linhas.map((l) => {
          const cel = dados[l.key] ?? {};
          const faltaLinha = ctx.destacar?.has(`${campo.key}|${l.key}`) ?? false;
          return (
            <li key={l.key} data-campo={`${formId}:${campo.key}|${l.key}`} className={`scroll-mt-28 space-y-2 px-3 py-3 ${faltaLinha ? "border-l-4 border-l-erro bg-erro/5" : ""}`}>
              <p className="text-sm text-black">{l.label}</p>
              <div className="flex flex-wrap items-center gap-2">
                {campo.multipla ? (
                  <OpcoesMultipla nome={l.label} opcoes={campo.opcoes} valor={celulaComoLista(cel.r)} desabilitado={readOnly} onChange={(v) => setLinha(l.key, { r: v })} />
                ) : (
                  <OpcoesUnica nome={l.label} opcoes={campo.opcoes} valor={typeof cel.r === "string" ? cel.r : null} desabilitado={readOnly} onChange={(v) => setLinha(l.key, { r: v })} />
                )}
                {campo.comNumero && (
                  <label className="flex items-center gap-2 text-xs font-semibold text-black">
                    {campo.comNumero}
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={1000}
                      disabled={readOnly}
                      value={cel.n ?? ""}
                      onChange={(e) => setLinha(l.key, { n: e.target.value === "" ? null : Number(e.target.value) })}
                      className="w-24 rounded-xl border border-linha px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-roxo/40 disabled:bg-fundo"
                    />
                  </label>
                )}
              </div>
              {campo.comObs && (
                <input
                  type="text"
                  aria-label={`Observação: ${l.label}`}
                  placeholder="Observação (opcional)"
                  maxLength={RE_TEXTO_MAX}
                  disabled={readOnly}
                  value={cel.obs ?? ""}
                  onChange={(e) => setLinha(l.key, { obs: e.target.value })}
                  className={inputCls}
                />
              )}
              {faltaLinha && <p className="text-xs font-semibold text-erro">Em branco</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Formulário A–F do catálogo, em uma coluna, com botões grandes. Sem nenhum padrão preenchido.
 * `continuo`: sem moldura por seção, para encaixar no formulário único do RE.
 */
export function ReFormRenderer({
  form,
  value,
  onChange,
  readOnly = false,
  continuo = false,
  contexto = {},
}: {
  form: ReFormDef;
  value: Payload;
  onChange: (next: Payload) => void;
  readOnly?: boolean;
  continuo?: boolean;
  contexto?: ReContexto;
}) {
  const patch = (p: Payload) => onChange({ ...value, ...p });
  return (
    <div className={continuo ? "space-y-8" : "space-y-6"}>
      {form.secoes.map((s) => (
        <section
          key={s.id}
          aria-labelledby={`sec-${form.id}-${s.id}`}
          className={continuo ? "" : "rounded-2xl border border-linha bg-white p-4 shadow-suave sm:p-5"}
        >
          <h3 id={`sec-${form.id}-${s.id}`} className={continuo ? "border-b border-linha pb-1.5 text-base font-bold text-black" : "text-base font-bold text-black"}>
            {s.titulo}
          </h3>
          {s.descricao && <p className="mt-0.5 text-xs text-neutral-700">{s.descricao}</p>}
          <div className="mt-4 space-y-5">
            {s.campos.map((c) => (
              <CampoView key={c.key} campo={c} formId={form.id} value={value} onChange={patch} readOnly={readOnly} ctx={contexto} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function textoDaOpcao(opcoes: ReOpcao[], v: unknown): string {
  return opcoes.find((o) => o.value === v)?.label ?? "";
}

function rotulosDe(opcoes: ReOpcao[], r: unknown): string {
  return celulaComoLista(r).map((v) => textoDaOpcao(opcoes, v)).filter(Boolean).join(", ");
}

/** Leitura (médico / depois do envio): só o que foi respondido, em lista simples. */
export function ReFormLeitura({ form, value }: { form: ReFormDef; value: Payload }) {
  const vazio = <span className="italic text-neutral-600">não informado</span>;
  const obs = (chave: string) => (value[chave] ? <span className="mt-0.5 block text-neutral-800">Observação: {String(value[chave])}</span> : null);
  return (
    <div className="space-y-4">
      {form.secoes.map((s) => (
        <section key={s.id} className="overflow-hidden rounded-xl border border-linha bg-white">
          <h4 className="border-b border-linha bg-roxo-50 px-3 py-2 text-xs font-bold text-black">{s.titulo}</h4>
          <dl>
            {s.campos.map((c) => {
              let conteudo: React.ReactNode = vazio;
              if (c.tipo === "texto" || c.tipo === "texto_longo") {
                conteudo = value[c.key] ? <span className="whitespace-pre-wrap">{String(value[c.key])}</span> : vazio;
              } else if (c.tipo === "genograma") {
                const g = lerGenograma(value[c.key]);
                conteudo = g ? <GenogramaDesenho genograma={g} /> : vazio;
              } else if (c.tipo === "professor") {
                const nome = (value[c.key] as { nome?: string } | undefined)?.nome;
                conteudo = nome ? <span>{nome}</span> : vazio;
              } else if (c.tipo === "unica") {
                const t = textoDaOpcao(c.opcoes, value[c.key]);
                const extra = value[`${c.key}__texto`];
                conteudo = t ? (
                  <>
                    <span>{t}{extra ? ` — ${extra}` : ""}</span>
                    {obs(`${c.key}__obs`)}
                  </>
                ) : (
                  vazio
                );
              } else if (c.tipo === "multipla") {
                const labels = celulaComoLista(value[c.key]).map((v) => textoDaOpcao(c.opcoes, v)).filter(Boolean);
                const outros = value[`${c.key}__outros`];
                const todos = [...labels, ...(outros ? [`Outros: ${outros}`] : [])];
                conteudo = todos.length ? (
                  <>
                    <span>{todos.join("; ")}</span>
                    {obs(`${c.key}__obs`)}
                  </>
                ) : (
                  vazio
                );
              } else {
                const dados = (value[c.key] ?? {}) as Record<string, any>;
                const respondidas = c.linhas.filter((l) => {
                  const d = dados[l.key];
                  return d && (celulaComoLista(d.r).length > 0 || d.n != null || d.obs);
                });
                conteudo = respondidas.length ? (
                  <ul className="space-y-0.5">
                    {respondidas.map((l) => {
                      const d = dados[l.key];
                      return (
                        <li key={l.key}>
                          {l.label}: <strong>{rotulosDe(c.opcoes, d.r) || "—"}</strong>
                          {d.n != null ? ` · ${c.comNumero}: ${d.n}` : ""}
                          {d.obs ? ` · ${d.obs}` : ""}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  vazio
                );
              }
              return (
                <div key={c.key} className="grid grid-cols-1 gap-1 border-b border-linha px-3 py-2 text-xs last:border-b-0 sm:grid-cols-[220px_1fr] sm:gap-2">
                  <dt className="font-semibold text-black">{c.label}</dt>
                  <dd className="min-w-0 break-words text-black">{conteudo}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
