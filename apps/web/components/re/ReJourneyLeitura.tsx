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

/**
 * Formulários A a H do RE, somente leitura (médico e quem tiver acesso ao sumário do caso).
 * O Formulário I (Sumário/FOGAP) aparece logo acima, no visualizador do FOGAP. Abertos por padrão: o médico lê sem clicar em cada um.
 */
export function ReJourneyLeitura({ caseId }: { caseId: string }) {
  const [d, setD] = useState<Resp | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [abertos, setAbertos] = useState(true);

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
  const nomes: Record<string, string> = { a: "A", b: "B", c: "C", d: "D", e: "E", f: "F", g: "G (SNAP-IV)" };

  const algum = (["a", "b", "c", "d", "e", "f", "g"] as RePassoId[]).some((id) => d.forms[id]);
  const estado = (id: RePassoId) => d.situacao.passos.find((p) => p.id === id)?.estado;

  return (
    <section aria-label="Formulários A a H do RE" className="space-y-2 rounded-2xl border border-linha bg-white p-4 shadow-suave">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-bold text-black">
          <ClipboardList className="h-4 w-4 text-roxo" aria-hidden /> Formulários do RE (A a H)
        </h4>
        <button type="button" onClick={() => setAbertos((v) => !v)} className="text-xs font-bold text-roxo hover:underline">
          {abertos ? "Recolher todos" : "Abrir todos"}
        </button>
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label="Situação de cada formulário">
        {(["a", "b", "c", "d", "e", "f", "g"] as RePassoId[]).map((id) => (
          <li
            key={id}
            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
              d.forms[id] ? "border-sucesso/40 bg-sucesso/10 text-black" : estado(id) === "pulado" ? "border-linha bg-fundo text-neutral-800" : "border-ouro-300 bg-ouro-50 text-black"
            }`}
          >
            {nomes[id]}: {d.forms[id] ? "preenchido" : estado(id) === "pulado" ? "não aplicado" : "em branco"}
          </li>
        ))}
        <li className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${d.ata.enviada ? "border-sucesso/40 bg-sucesso/10 text-black" : "border-ouro-300 bg-ouro-50 text-black"}`}>
          H (ATA): {d.ata.enviada ? "enviada" : "pendente"}
        </li>
        <li className="rounded-full border border-sucesso/40 bg-sucesso/10 px-2 py-0.5 text-[11px] font-semibold text-black">I (Sumário/FOGAP): acima</li>
      </ul>
      {!algum && (
        <p className="text-xs text-neutral-800">Este caso foi enviado antes dos formulários A a H existirem no sistema; só o Formulário I (Sumário) está disponível.</p>
      )}
      {(["a", "b", "c", "d", "e", "f"] as ReFormId[]).map((id) => (
        <details key={`${id}-${abertos}`} open={abertos} className="rounded-xl border border-linha">
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-black">
            {RE_FORMS[id].titulo} {d.forms[id] ? "" : <span className="font-normal text-neutral-700">· não preenchido</span>}
          </summary>
          <div className="p-3">
            <ReFormLeitura form={RE_FORMS[id]} value={(d.forms[id]?.payload ?? {}) as Record<string, any>} />
          </div>
        </details>
      ))}
      <details key={`g-${abertos}`} open={abertos} className="rounded-xl border border-linha">
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
