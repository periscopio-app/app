"use client";

import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { formDaEspecialidade, type EspecialidadeId, ESPECIALIDADE_NOMES, isEspecialidadeId } from "@periscopio/shared";
import { api, ApiError } from "@/lib/api";
import { ResumoVisual } from "@/components/formularios/ResumoVisual";
import { ReFormLeitura } from "@/components/re/ReFormRenderer";

interface Resp {
  version: string;
  sections: {
    sectionId: string;
    specialty: string;
    completedAt: string | null;
    forms: { id: string; status: string; payload: Record<string, any>; completedAt: string | null }[];
  }[];
}

/**
 * Formulários que os especialistas preencheram e devolveram (seção concluída). Somente leitura para o médico.
 * Por padrão mostra o resumo visual neutro (sem peso); a folha completa fica a um clique.
 */
export function EspecialidadesDevolutiva({ caseId }: { caseId: string }) {
  const [d, setD] = useState<Resp | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [folha, setFolha] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setD(null);
    api
      .get<Resp>(`/api/cases/${caseId}/specialty-forms`)
      .then(setD)
      .catch((e) => setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os formulários dos especialistas."));
  }, [caseId]);

  if (erro) return <p role="alert" className="text-xs font-semibold text-erro">{erro}</p>;
  if (!d) return <p className="text-xs text-neutral-800">Carregando formulários dos especialistas…</p>;

  return (
    <section aria-label="Formulários dos especialistas" className="space-y-3">
      <h4 className="flex items-center gap-2 text-sm font-bold text-black">
        <ClipboardList className="h-4 w-4 text-roxo" aria-hidden /> Formulários dos especialistas
      </h4>
      {d.sections.length === 0 ? (
        <p className="text-xs text-neutral-800">Nenhum especialista devolveu formulários ainda. Eles aparecem aqui quando a seção é concluída.</p>
      ) : (
        d.sections.map((s) => (
          <div key={s.sectionId} className="space-y-2 rounded-xl border border-linha bg-white p-3">
            <p className="text-sm font-semibold text-black">
              {isEspecialidadeId(s.specialty) ? ESPECIALIDADE_NOMES[s.specialty as EspecialidadeId] : s.specialty}
              {s.completedAt && <span className="ml-2 text-[11px] font-normal text-neutral-700">concluída em {new Date(s.completedAt).toLocaleDateString("pt-BR")}</span>}
            </p>
            {s.forms.map((f) => {
              const def = formDaEspecialidade(s.specialty, f.id);
              if (!def) return null;
              const chave = `${s.sectionId}:${f.id}`;
              return (
                <details key={f.id} className="rounded-xl border border-linha">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-black">{def.letra} · {def.titulo}</summary>
                  <div className="space-y-2 border-t border-linha p-3">
                    <button
                      type="button"
                      onClick={() => setFolha((x) => ({ ...x, [chave]: !x[chave] }))}
                      className="rounded-lg border border-linha bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-fundo"
                    >
                      {folha[chave] ? "Ver resumo visual" : "Ver folha completa"}
                    </button>
                    {folha[chave] ? <ReFormLeitura form={def} value={f.payload} /> : <ResumoVisual form={def} value={f.payload} />}
                  </div>
                </details>
              );
            })}
          </div>
        ))
      )}
    </section>
  );
}
