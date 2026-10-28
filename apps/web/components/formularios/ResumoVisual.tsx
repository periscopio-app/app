"use client";

import { Info } from "lucide-react";
import { lerGenograma, resumoVisualDef, type ResumoCampo, type FormDef } from "@periscopio/shared";
import { GenogramaDesenho } from "@/components/genograma/GenogramaDesenho";

/**
 * Resumo visual do que o profissional marcou.
 *
 * A Dra. informou que os formulários NÃO têm peso determinado. Por isso:
 *  - todas as respostas usam a MESMA cor neutra (nenhuma cor de alerta, nenhum verde/vermelho);
 *  - nada é somado, ponderado, classificado nem ordenado por gravidade;
 *  - o "andamento" mostra só quantos campos foram respondidos, não uma nota;
 *  - em branco continua em branco.
 */

function Andamento({ respondidos, total }: { respondidos: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((respondidos / total) * 100);
  return (
    <div className="flex items-center gap-2" aria-label={`${respondidos} de ${total} campos respondidos`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-linha" aria-hidden>
        <div className="h-full bg-roxo/60" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-neutral-800">{respondidos} de {total} respondidos</span>
    </div>
  );
}

const chip = "inline-flex max-w-full items-center gap-1 rounded-lg border border-roxo/30 bg-roxo-50 px-2 py-1 text-xs text-black";

function CampoResumo({ c, value }: { c: ResumoCampo; value: Record<string, unknown> }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-black">{c.label}</p>
      {c.tipo === "texto" && <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-xs text-black">{c.texto}</p>}

      {c.tipo === "escolha" && (
        <div className="flex flex-wrap gap-1.5">
          {c.escolhas?.map((e) => (
            <span key={e} className={chip}>{e}</span>
          ))}
          {c.obs && <p className="w-full text-[11px] text-neutral-800">Observação: {c.obs}</p>}
        </div>
      )}

      {c.tipo === "desenho" && (() => {
        const g = lerGenograma(value[c.key]);
        return g ? <GenogramaDesenho genograma={g} /> : null;
      })()}

      {c.tipo === "tabela" && (
        <div className="space-y-2">
          {c.grupos?.map((g) => (
            <div key={g.resposta} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[130px_1fr]">
              <span className="text-[11px] font-bold text-black">{g.resposta} <span className="font-normal text-neutral-700">({g.linhas.length})</span></span>
              <div className="flex flex-wrap gap-1.5">
                {g.linhas.map((l) => (
                  <span key={l.rotulo} className={chip}>
                    {l.rotulo}
                    {l.numero !== undefined && <strong>· {l.numero}</strong>}
                    {l.obs && <em className="text-neutral-800">· {l.obs}</em>}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {c.emBranco && c.emBranco.length > 0 && (
            <details className="text-[11px] text-neutral-800">
              <summary className="cursor-pointer">{c.emBranco.length} sem resposta</summary>
              <ul className="mt-1 list-disc pl-5">
                {c.emBranco.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export function ResumoVisual({ form, value }: { form: FormDef; value: Record<string, unknown> }) {
  const r = resumoVisualDef(form, value);
  const comConteudo = r.secoes.filter((s) => s.campos.length > 0);
  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 rounded-xl border border-linha bg-fundo px-3 py-2 text-[11px] text-black">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Resumo do que foi marcado. As cores <strong>não indicam gravidade</strong>: os formulários não têm peso determinado, e o sistema não soma, não classifica e não conclui.
          O que ficou em branco continua em branco.
        </span>
      </p>
      <Andamento respondidos={r.respondidos} total={r.total} />
      {comConteudo.length === 0 ? (
        <p className="text-xs italic text-neutral-700">Nada marcado ainda.</p>
      ) : (
        comConteudo.map((s) => (
          <section key={s.id} className="overflow-hidden rounded-xl border border-linha bg-white">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-linha bg-roxo-50 px-3 py-2">
              <h4 className="text-xs font-bold text-black">{s.titulo}</h4>
              <Andamento respondidos={s.respondidos} total={s.total} />
            </header>
            <div className="space-y-3 p-3">
              {s.campos.map((c) => (
                <CampoResumo key={c.key} c={c} value={value} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
