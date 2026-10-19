"use client";

import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { RE_FORMS, RE_PASSOS, SNAP4_ITENS, SNAP4_OPCOES, type JornadaSituacao, type ReFormId, type RePassoId } from "@periscopio/shared";
import { api } from "@/lib/api";
import { ReFormLeitura } from "./ReFormRenderer";

interface Resp {
  situacao: JornadaSituacao;
  ata: { existe: boolean; enviada: boolean };
  forms: Partial<Record<RePassoId, { status: string; payload: any } | null>>;
}

/** Formulários A a H do RE, somente leitura (médico e quem tiver acesso ao sumário do caso). */
export function ReJourneyLeitura({ caseId }: { caseId: string }) {
  const [d, setD] = useState<Resp | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api
      .get<Resp>(`/api/cases/${caseId}/re-journey`)
      .then((r) => vivo && setD(r))
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : "Não foi possível carregar os formulários do RE."));
    return () => {
      vivo = false;
    };
  }, [caseId]);

  if (erro) return <p className="text-sm text-neutral-800">{erro}</p>;
  if (!d) return <p className="text-sm text-neutral-800">Carregando formulários A a H do RE…</p>;

  const algum = (["a", "b", "c", "d", "e", "f", "g"] as RePassoId[]).some((id) => d.forms[id]);
  const estado = (id: RePassoId) => d.situacao.passos.find((p) => p.id === id)?.estado;

  return (
    <section aria-label="Formulários A a H do RE" className="space-y-2 rounded-2xl border border-linha bg-white p-4 shadow-suave">
      <h4 className="flex items-center gap-2 text-sm font-bold text-black">
        <ClipboardList className="h-4 w-4 text-roxo" aria-hidden /> Formulários do RE (A a H)
      </h4>
      {!algum && (
        <p className="text-xs text-neutral-800">Este caso foi enviado antes dos formulários A a H existirem no sistema; só o Formulário I (Sumário) está disponível.</p>
      )}
      {(["a", "b", "c", "d", "e", "f"] as ReFormId[]).map((id) => (
        <details key={id} className="rounded-xl border border-linha">
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-black">
            {RE_FORMS[id].titulo} {d.forms[id] ? "" : <span className="font-normal text-neutral-700">· não preenchido</span>}
          </summary>
          <div className="p-3">
            <ReFormLeitura form={RE_FORMS[id]} value={(d.forms[id]?.payload ?? {}) as Record<string, any>} />
          </div>
        </details>
      ))}
      <details className="rounded-xl border border-linha">
        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-black">
          Formulário G — SNAP-IV {estado("g") === "pulado" ? <span className="font-normal text-neutral-700">· não aplicado (opcional)</span> : !d.forms.g ? <span className="font-normal text-neutral-700">· não preenchido</span> : null}
        </summary>
        <ul className="space-y-1 p-3 text-xs text-black">
          {SNAP4_ITENS.map((i) => {
            const v = d.forms.g?.payload?.respostas?.[i.id];
            return (
              <li key={i.id}>
                {i.n}. {i.texto} <strong>{SNAP4_OPCOES.find((o) => o.valor === v)?.rotulo ?? "—"}</strong>
              </li>
            );
          })}
        </ul>
      </details>
      <p className="rounded-xl border border-linha px-3 py-2 text-sm text-black">
        <strong>Formulário H — ATA:</strong>{" "}
        {d.ata.enviada ? "enviada (veja na aba Triagem TEA)." : estado("h") === "aguardando_responsavel" ? "aguardando o responsável responder." : "ainda não enviada."}
      </p>
      <p className="text-[11px] text-neutral-700">O sistema registra as respostas; não calcula nem diagnostica. A decisão é do médico.</p>
    </section>
  );
}
