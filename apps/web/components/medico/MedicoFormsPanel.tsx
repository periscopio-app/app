"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, Lock, Pencil, RotateCcw, Save } from "lucide-react";
import { MD_FORMS, MD_TEXTO_MAX, type MdFormId } from "@periscopio/shared";
import { api, ApiError } from "@/lib/api";
import { GenogramaEditor } from "@/components/genograma/GenogramaEditor";

type Status = "nao_iniciado" | "rascunho" | "concluido";
interface FormRow {
  id: MdFormId;
  titulo: string;
  status: Status;
  payload: Record<string, string>;
  updatedAt: string | null;
  completedAt: string | null;
  reaberturas: number;
}
interface Resp {
  version: string;
  caseState: string;
  editavel: boolean;
  instrumentosExternos: { id: string; nome: string; motivo: string }[];
  forms: FormRow[];
}

const ROTULO: Record<Status, string> = { nao_iniciado: "Não iniciado", rascunho: "Rascunho", concluido: "Concluído" };
const COR: Record<Status, string> = {
  nao_iniciado: "bg-linha text-black",
  rascunho: "bg-ouro-100 text-black",
  concluido: "bg-sucesso/10 text-black",
};

/**
 * Formulários do médico: anamnese, exame, genograma, hipótese e conduta, encaminhamentos, seguimento e sumário.
 * Estrutura provisória (texto livre curto) até a validação clínica. O sistema não sugere nem preenche nada.
 */
export function MedicoFormsPanel({ caseId }: { caseId: string }) {
  const [d, setD] = useState<Resp | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [rascunhos, setRascunhos] = useState<Record<string, Record<string, string>>>({});
  const [msg, setMsg] = useState<Record<string, { tom: "ok" | "erro"; texto: string }>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<Record<string, string>>({});
  const [reabrindo, setReabrindo] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await api.get<Resp>(`/api/cases/${caseId}/medical-forms`);
      setD(r);
      setRascunhos(Object.fromEntries(r.forms.map((f) => [f.id, { ...f.payload }])));
      setErro(null);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os formulários do médico.");
    }
  }, [caseId]);

  useEffect(() => {
    setD(null);
    setMsg({});
    void carregar();
  }, [carregar]);

  const aviso = (id: string, tom: "ok" | "erro", texto: string) => setMsg((m) => ({ ...m, [id]: { tom, texto } }));

  async function salvar(id: MdFormId) {
    setOcupado(id);
    try {
      await api.put(`/api/cases/${caseId}/medical-forms/${id}`, { payload: rascunhos[id] ?? {} });
      aviso(id, "ok", "Rascunho salvo.");
      await carregar();
    } catch (e) {
      aviso(id, "erro", e instanceof ApiError ? e.message : "Não foi possível salvar.");
    } finally {
      setOcupado(null);
    }
  }

  async function concluir(id: MdFormId) {
    setOcupado(id);
    try {
      await api.put(`/api/cases/${caseId}/medical-forms/${id}`, { payload: rascunhos[id] ?? {} });
      await api.post(`/api/cases/${caseId}/medical-forms/${id}/complete`, {});
      aviso(id, "ok", "Seção concluída. Para alterar, reabra com o motivo.");
      await carregar();
    } catch (e) {
      aviso(id, "erro", e instanceof ApiError ? e.message : "Não foi possível concluir.");
    } finally {
      setOcupado(null);
    }
  }

  async function reabrir(id: MdFormId) {
    setOcupado(id);
    try {
      await api.post(`/api/cases/${caseId}/medical-forms/${id}/reopen`, { reason: motivo[id] ?? "" });
      setReabrindo(null);
      setMotivo((m) => ({ ...m, [id]: "" }));
      aviso(id, "ok", "Seção reaberta. A versão anterior ficou guardada no histórico.");
      await carregar();
    } catch (e) {
      aviso(id, "erro", e instanceof ApiError ? e.message : "Não foi possível reabrir.");
    } finally {
      setOcupado(null);
    }
  }

  if (erro) return <p role="alert" className="rounded-xl border border-erro/20 bg-erro/5 px-4 py-3 text-sm text-black">{erro}</p>;
  if (!d) return <p className="text-sm text-neutral-800">Carregando formulários do médico…</p>;

  const concluidos = d.forms.filter((f) => f.status === "concluido").length;

  return (
    <section aria-label="Formulários do médico" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-black">
          <ClipboardList className="h-4 w-4 text-roxo" aria-hidden /> Avaliação médica
        </h3>
        <span className="text-xs text-neutral-800">{concluidos} de {d.forms.length} seções concluídas</span>
      </div>

      <p className="rounded-xl border border-ceu-300 bg-ceu-50 px-3 py-2 text-xs text-black">
        Estrutura provisória ({d.version}): cada seção é um registro em texto livre. As perguntas exatas do capítulo médico entram depois da validação clínica.
        O sistema <strong>não sugere, não classifica e não preenche</strong> hipótese, conduta, prescrição ou alta: tudo é decisão do médico.
        Não escreva nome, telefone ou endereço: use o código do aluno.
      </p>

      {!d.editavel && (
        <p className="flex items-center gap-2 rounded-xl border border-linha bg-fundo px-3 py-2 text-xs text-black">
          <Lock className="h-3.5 w-3.5" aria-hidden /> Este caso está fora da fase médica ({d.caseState}): as seções ficam somente para consulta.
        </p>
      )}

      {d.forms.map((f) => {
        const def = MD_FORMS[f.id];
        const travado = !d.editavel || f.status === "concluido";
        const valores = rascunhos[f.id] ?? {};
        const preenchido = def.campos.some((c) => (valores[c.id] ?? "").trim().length > 0);
        const m = msg[f.id];
        return (
          <details key={f.id} open={f.status !== "concluido"} className="rounded-xl border border-linha bg-white">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-black">
              <span>{f.titulo}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${COR[f.status]}`}>{ROTULO[f.status]}</span>
            </summary>
            <div className="space-y-2 border-t border-linha p-3">
              <p className="text-xs text-neutral-800">{def.descricao}</p>
              {def.campos.map((campo) => {
                const texto = valores[campo.id] ?? "";
                const idCampo = `md-${f.id}-${campo.id}`;
                const mudar = (v: string) => setRascunhos((r) => ({ ...r, [f.id]: { ...(r[f.id] ?? {}), [campo.id]: v } }));
                return (
                  <div key={campo.id} className="space-y-1">
                    <label className="block text-xs font-semibold text-black" htmlFor={campo.tipo === "genograma" ? undefined : idCampo}>
                      {campo.rotulo}
                    </label>
                    {campo.ajuda && <p className="text-[11px] text-neutral-700">{campo.ajuda}</p>}
                    {campo.tipo === "genograma" ? (
                      <GenogramaEditor idBase={idCampo} value={texto} onChange={mudar} disabled={travado} />
                    ) : (
                      <>
                        <textarea
                          id={idCampo}
                          rows={6}
                          maxLength={MD_TEXTO_MAX}
                          value={texto}
                          disabled={travado}
                          onChange={(e) => mudar(e.target.value)}
                          className="w-full rounded-xl border border-linha px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-roxo/40 disabled:bg-fundo"
                        />
                        <span className="block text-[11px] text-neutral-700">{texto.length}/{MD_TEXTO_MAX}</span>
                      </>
                    )}
                  </div>
                );
              })}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-neutral-700">
                  {f.completedAt && `Concluída em ${new Date(f.completedAt).toLocaleDateString("pt-BR")}`}
                  {f.reaberturas > 0 && `${f.completedAt ? " · " : ""}reaberta ${f.reaberturas}×`}
                </span>
                <div className="flex flex-wrap gap-2">
                  {!travado && (
                    <>
                      <button
                        type="button"
                        onClick={() => void salvar(f.id)}
                        disabled={ocupado === f.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-linha bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-fundo disabled:opacity-60"
                      >
                        <Save className="h-3.5 w-3.5" aria-hidden /> Salvar rascunho
                      </button>
                      <button
                        type="button"
                        onClick={() => void concluir(f.id)}
                        disabled={ocupado === f.id || !preenchido}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-roxo bg-roxo-100 px-3 py-1.5 text-xs font-semibold text-black hover:bg-roxo-200 disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Concluir seção
                      </button>
                    </>
                  )}
                  {d.editavel && f.status === "concluido" && reabrindo !== f.id && (
                    <button
                      type="button"
                      onClick={() => setReabrindo(f.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-ouro-400 bg-ouro-50 px-3 py-1.5 text-xs font-semibold text-black hover:bg-ouro-100"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden /> Reabrir para retificar
                    </button>
                  )}
                </div>
              </div>
              {reabrindo === f.id && (
                <div className="space-y-2 rounded-xl border border-ouro-300 bg-ouro-50 p-3">
                  <label htmlFor={`md-motivo-${f.id}`} className="block text-xs font-semibold text-black">
                    Motivo da reabertura (fica na trilha do caso)
                  </label>
                  <input
                    id={`md-motivo-${f.id}`}
                    value={motivo[f.id] ?? ""}
                    onChange={(e) => setMotivo((x) => ({ ...x, [f.id]: e.target.value }))}
                    maxLength={500}
                    className="w-full rounded-lg border border-linha bg-white px-3 py-2 text-sm text-black"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void reabrir(f.id)}
                      disabled={ocupado === f.id || (motivo[f.id] ?? "").trim().length < 3}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-ouro-400 bg-white px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-60"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Confirmar reabertura
                    </button>
                    <button type="button" onClick={() => setReabrindo(null)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-black hover:bg-white">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
              {m && (
                <p role={m.tom === "erro" ? "alert" : "status"} className={`text-xs ${m.tom === "erro" ? "text-erro" : "text-black"}`}>
                  {m.texto}
                </p>
              )}
            </div>
          </details>
        );
      })}

      <div className="rounded-xl border border-linha bg-white p-3">
        <p className="text-xs font-semibold text-black">Instrumentos externos</p>
        <ul className="mt-1 space-y-1 text-[11px] text-neutral-800">
          {d.instrumentosExternos.map((i) => (
            <li key={i.id}>
              <strong>{i.nome}:</strong> {i.motivo}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
