"use client";

import { RE_TEXTO_MAX, type ReCampo, type ReFormDef, type ReOpcao } from "@periscopio/shared";

type Payload = Record<string, any>;

const pill = (ativo: boolean, desabilitado: boolean) =>
  `min-h-[44px] rounded-xl border px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-roxo/50 ${
    ativo ? "border-roxo bg-roxo text-white shadow-sm" : "border-linha bg-white text-black hover:bg-roxo-50"
  } ${desabilitado ? "cursor-default opacity-80" : ""}`;

const inputCls =
  "w-full rounded-xl border border-linha bg-white px-3 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-roxo/40 disabled:bg-fundo disabled:text-neutral-800";

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

function CampoView({ campo, value, onChange, readOnly }: { campo: ReCampo; value: Payload; onChange: (patch: Payload) => void; readOnly: boolean }) {
  const id = `re-${campo.key}`;
  const rotulo = (
    <div className="mb-1.5">
      <p id={`${id}-l`} className="text-sm font-semibold text-black">{campo.label}</p>
      {campo.ajuda && <p className="text-xs text-neutral-700">{campo.ajuda}</p>}
    </div>
  );

  if (campo.tipo === "texto") {
    return (
      <div>
        <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-black">{campo.label}</label>
        {campo.ajuda && <p className="-mt-1 mb-1.5 text-xs text-neutral-700">{campo.ajuda}</p>}
        <input id={id} type="text" maxLength={RE_TEXTO_MAX} disabled={readOnly} value={value[campo.key] ?? ""} onChange={(e) => onChange({ [campo.key]: e.target.value })} className={inputCls} />
      </div>
    );
  }

  if (campo.tipo === "texto_longo") {
    return (
      <div>
        <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-black">{campo.label}</label>
        {campo.ajuda && <p className="-mt-1 mb-1.5 text-xs text-neutral-700">{campo.ajuda}</p>}
        <textarea id={id} rows={3} maxLength={RE_TEXTO_MAX} disabled={readOnly} value={value[campo.key] ?? ""} onChange={(e) => onChange({ [campo.key]: e.target.value })} className={`${inputCls} resize-y`} />
      </div>
    );
  }

  if (campo.tipo === "unica") {
    const atual: string | null = value[campo.key] ?? null;
    const comTexto = campo.opcoes.find((o) => o.value === atual && o.pedeTexto);
    return (
      <div>
        {rotulo}
        <OpcoesUnica nome={campo.label} opcoes={campo.opcoes} valor={atual} desabilitado={readOnly} onChange={(v) => onChange({ [campo.key]: v })} />
        {comTexto && (
          <div className="mt-2">
            <label htmlFor={`${id}-t`} className="mb-1 block text-xs font-semibold text-black">{comTexto.pedeTexto}</label>
            <input id={`${id}-t`} type="text" maxLength={RE_TEXTO_MAX} disabled={readOnly} value={value[`${campo.key}__texto`] ?? ""} onChange={(e) => onChange({ [`${campo.key}__texto`]: e.target.value })} className={inputCls} />
          </div>
        )}
      </div>
    );
  }

  if (campo.tipo === "multipla") {
    const marcados: string[] = Array.isArray(value[campo.key]) ? value[campo.key] : [];
    return (
      <div>
        {rotulo}
        <div role="group" aria-labelledby={`${id}-l`} className="flex flex-wrap gap-2">
          {campo.opcoes.map((op) => {
            const ativo = marcados.includes(op.value);
            return (
              <button
                key={op.value}
                type="button"
                aria-pressed={ativo}
                disabled={readOnly}
                onClick={() => onChange({ [campo.key]: ativo ? marcados.filter((x) => x !== op.value) : [...marcados, op.value] })}
                className={pill(ativo, readOnly)}
              >
                {op.label}
              </button>
            );
          })}
        </div>
        {campo.outros && (
          <div className="mt-2">
            <label htmlFor={`${id}-o`} className="mb-1 block text-xs font-semibold text-black">{campo.outros}</label>
            <input id={`${id}-o`} type="text" maxLength={RE_TEXTO_MAX} disabled={readOnly} value={value[`${campo.key}__outros`] ?? ""} onChange={(e) => onChange({ [`${campo.key}__outros`]: e.target.value })} className={inputCls} />
          </div>
        )}
      </div>
    );
  }

  // matriz
  const dados: Record<string, { r?: string | null; obs?: string; n?: number | null }> = value[campo.key] ?? {};
  const setLinha = (k: string, patch: Record<string, unknown>) => {
    const atualLinha = dados[k] ?? {};
    onChange({ [campo.key]: { ...dados, [k]: { ...atualLinha, ...patch } } });
  };
  return (
    <div>
      {rotulo}
      <ul className="divide-y divide-linha overflow-hidden rounded-xl border border-linha bg-white">
        {campo.linhas.map((l) => {
          const cel = dados[l.key] ?? {};
          return (
            <li key={l.key} className="space-y-2 px-3 py-3">
              <p className="text-sm text-black">{l.label}</p>
              <div className="flex flex-wrap items-center gap-2">
                <OpcoesUnica nome={l.label} opcoes={campo.opcoes} valor={cel.r ?? null} desabilitado={readOnly} onChange={(v) => setLinha(l.key, { r: v })} />
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Formulário A–F do catálogo, em uma coluna, com botões grandes. Sem nenhum padrão preenchido. */
export function ReFormRenderer({
  form,
  value,
  onChange,
  readOnly = false,
}: {
  form: ReFormDef;
  value: Payload;
  onChange: (next: Payload) => void;
  readOnly?: boolean;
}) {
  const patch = (p: Payload) => onChange({ ...value, ...p });
  return (
    <div className="space-y-6">
      {form.secoes.map((s) => (
        <section key={s.id} aria-labelledby={`sec-${form.id}-${s.id}`} className="rounded-2xl border border-linha bg-white p-4 shadow-suave sm:p-5">
          <h3 id={`sec-${form.id}-${s.id}`} className="text-base font-bold text-black">{s.titulo}</h3>
          {s.descricao && <p className="mt-0.5 text-xs text-neutral-700">{s.descricao}</p>}
          <div className="mt-4 space-y-5">
            {s.campos.map((c) => (
              <CampoView key={c.key} campo={c} value={value} onChange={patch} readOnly={readOnly} />
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

/** Leitura (médico / depois do envio): só o que foi respondido, em lista simples. */
export function ReFormLeitura({ form, value }: { form: ReFormDef; value: Payload }) {
  const vazio = <span className="italic text-neutral-600">não informado</span>;
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
              } else if (c.tipo === "unica") {
                const t = textoDaOpcao(c.opcoes, value[c.key]);
                const extra = value[`${c.key}__texto`];
                conteudo = t ? <span>{t}{extra ? ` — ${extra}` : ""}</span> : vazio;
              } else if (c.tipo === "multipla") {
                const labels = (Array.isArray(value[c.key]) ? value[c.key] : []).map((v: string) => textoDaOpcao(c.opcoes, v)).filter(Boolean);
                const outros = value[`${c.key}__outros`];
                const todos = [...labels, ...(outros ? [`Outros: ${outros}`] : [])];
                conteudo = todos.length ? <span>{todos.join("; ")}</span> : vazio;
              } else {
                const dados = (value[c.key] ?? {}) as Record<string, any>;
                const respondidas = c.linhas.filter((l) => dados[l.key] && (dados[l.key].r || dados[l.key].n != null || dados[l.key].obs));
                conteudo = respondidas.length ? (
                  <ul className="space-y-0.5">
                    {respondidas.map((l) => {
                      const d = dados[l.key];
                      return (
                        <li key={l.key}>
                          {l.label}: <strong>{textoDaOpcao(c.opcoes, d.r) || "—"}</strong>
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
