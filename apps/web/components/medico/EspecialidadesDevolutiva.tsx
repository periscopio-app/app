"use client";

import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { formDaEspecialidade, type EspecialidadeId, ESPECIALIDADE_NOMES, isEspecialidadeId } from "@periscopio/shared";
import { api, ApiError } from "@/lib/api";
import { ResumoVisual } from "@/components/formularios/ResumoVisual";
import { ReFormLeitura } from "@/components/re/ReFormRenderer";
import { Button } from "@/components/ui";

interface Resp {
  version: string;
  sections: {
    sectionId: string;
    specialty: string;
    completedAt: string | null;
    sumarioPreenchido: boolean;
    forms: { id: string; status: string; payload: Record<string, any>; completedAt: string | null }[];
  }[];
}

/**
 * Sumário executivo de cada especialidade, depois que o especialista conclui a seção. É só o sumário: as anamneses,
 * os instrumentos e os planos ficam no bloco de notas do profissional, que os traz para a discussão do caso.
 * Por padrão mostra o resumo visual neutro (sem peso); a folha do sumário fica a um clique.
 */
export function EspecialidadesDevolutiva({ caseId }: { caseId: string }) {
  const [d, setD] = useState<Resp | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [folha, setFolha] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setD(null);
    setErro(null);
    api
      .get<Resp>(`/api/cases/${caseId}/specialty-forms`)
      .then(setD)
      .catch((e) => setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os sumários dos especialistas."));
  }, [caseId]);

  if (erro) return <p role="alert" className="text-xs font-semibold text-erro">{erro}</p>;
  if (!d) return <p className="text-xs text-neutral-800">Carregando sumários dos especialistas…</p>;

  return (
    <section aria-label="Sumários dos especialistas" className="space-y-3">
      <h4 className="flex items-center gap-2 text-sm font-bold text-black">
        <ClipboardList className="h-4 w-4 text-roxo" aria-hidden /> Sumário de cada especialidade
      </h4>
      <p className="text-[11px] text-neutral-700">
        Você recebe só o sumário, quando o especialista conclui a seção. As demais anotações ficam com ele, que as traz para a discussão do caso.
      </p>
      {d.sections.length === 0 ? (
        <p className="text-xs text-neutral-800">Nenhum especialista concluiu a seção ainda. O sumário aparece aqui depois da conclusão.</p>
      ) : (
        d.sections.map((s) => {
          const nome = isEspecialidadeId(s.specialty) ? ESPECIALIDADE_NOMES[s.specialty as EspecialidadeId] : s.specialty;
          return (
            <div key={s.sectionId} className="space-y-2 rounded-xl border border-linha bg-white p-3">
              <p className="text-sm font-semibold text-black">
                {nome}
                {s.completedAt && <span className="ml-2 text-[11px] font-normal text-neutral-700">concluída em {new Date(s.completedAt).toLocaleDateString("pt-BR")}</span>}
              </p>
              {!s.sumarioPreenchido && (
                <p className="rounded-lg border border-ouro-300 bg-ouro-50 px-3 py-2 text-xs text-black">
                  Seção concluída, mas o formulário de sumário desta especialidade não foi preenchido. O parecer, se houver, está na lista acima.
                </p>
              )}
              {s.forms.map((f) => {
                const def = formDaEspecialidade(s.specialty, f.id);
                if (!def) return null;
                const chave = `${s.sectionId}:${f.id}`;
                return (
                  <div key={f.id} className="space-y-2 rounded-xl border border-linha p-3">
                    <p className="text-xs font-semibold text-black">
                      {def.letra} · {def.titulo}
                      {f.status !== "concluido" && <span className="ml-2 font-normal text-neutral-700">· o especialista não marcou este formulário como concluído</span>}
                    </p>
                    <Button
                      type="button"
                      onClick={() => setFolha((x) => ({ ...x, [chave]: !x[chave] }))}
                      variant="outline" size="sm"
                    >
                      {folha[chave] ? "Ver resumo visual" : "Ver folha do sumário"}
                    </Button>
                    {folha[chave] ? <ReFormLeitura form={def} value={f.payload} /> : <ResumoVisual form={def} value={f.payload} />}
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </section>
  );
}
