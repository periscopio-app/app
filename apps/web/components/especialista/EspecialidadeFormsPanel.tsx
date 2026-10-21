"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Eye, Lock, Pencil, RotateCcw, Save } from "lucide-react";
import { ESPECIALIDADE_FORMS, isEspecialidadeId, progressoDef, type FormDef } from "@periscopio/shared";
import { api, ApiError } from "@/lib/api";
import { ReFormRenderer } from "@/components/re/ReFormRenderer";
import { ResumoVisual } from "@/components/formularios/ResumoVisual";

type Status = "nao_iniciado" | "rascunho" | "concluido";
type Payload = Record<string, any>;
interface FormRow {
  id: string;
  status: Status;
  payload: Payload;
  updatedAt: string | null;
  completedAt: string | null;
  reaberturas: number;
}
interface Resp {
  version: string;
  specialty: string;
  sectionStatus: string;
  editavel: boolean;
  forms: FormRow[];
}

const ROTULO: Record<Status, string> = { nao_iniciado: "Não iniciado", rascunho: "Rascunho", concluido: "Concluído" };
const COR: Record<Status, string> = {
  nao_iniciado: "bg-linha text-black",
  rascunho: "bg-ouro-100 text-black",
  concluido: "bg-sucesso/10 text-black",
};

/**
 * Formulários da especialidade delegada ao profissional. Cada formulário sai do capítulo da especialidade
 * (catálogo `esp-0.1-rascunho`, pendente de validação clínica). O sistema não preenche, não soma e não classifica.
 * Instrumentos licenciados guardam só o resultado digitado.
 */
export function EspecialidadeFormsPanel({ sectionId, specialty, onSectionChange }: { sectionId: string; specialty: string; onSectionChange?: () => void }) {
  const catalogo: FormDef[] = useMemo(() => (isEspecialidadeId(specialty) ? ESPECIALIDADE_FORMS[specialty] : []), [specialty]);
  const [d, setD] = useState<Resp | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [rascunhos, setRascunhos] = useState<Record<string, Payload>>({});
  const [aberto, setAberto] = useState<string | null>(null);
  const [modo, setModo] = useState<"preencher" | "resumo">("preencher");
  const [msg, setMsg] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);
  const [motivo, setMotivo] = useState("");

  const carregar = useCallback(async () => {
    try {
      const r = await api.get<Resp>(`/api/cases/sections/${sectionId}/forms`);
      setD(r);
      setRascunhos(Object.fromEntries(r.forms.map((f) => [f.id, { ...f.payload }])));
      setErro(null);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os formulários da especialidade.");
    }
  }, [sectionId]);

  useEffect(() => {
    setD(null);
    setAberto(null);
    setMsg(null);
    void carregar();
  }, [carregar]);

  if (catalogo.length === 0) {
    return <p className="rounded-xl border border-linha bg-fundo px-3 py-2 text-xs text-black">Esta especialidade ainda não tem formulários digitais. Use o parecer abaixo.</p>;
  }
  if (erro) return <p role="alert" className="rounded-xl border border-erro/20 bg-erro/5 px-4 py-3 text-sm text-black">{erro}</p>;
  if (!d) return <p className="text-sm text-neutral-800">Carregando formulários…</p>;

  const linhas = new Map(d.forms.map((f) => [f.id, f]));
  const concluidos = d.forms.filter((f) => f.status === "concluido").length;
  const atual = catalogo.find((f) => f.id === aberto) ?? null;
  const linha = atual ? linhas.get(atual.id) : undefined;
  const status: Status = linha?.status ?? "nao_iniciado";
  const travado = !d.editavel || status === "concluido";
  const valor = atual ? rascunhos[atual.id] ?? {} : {};
  const alterado = atual ? JSON.stringify(valor) !== JSON.stringify(linha?.payload ?? {}) : false;

  async function salvar(): Promise<boolean> {
    if (!atual) return false;
    setOcupado(true);
    try {
      await api.put(`/api/cases/sections/${sectionId}/forms/${atual.id}`, { payload: rascunhos[atual.id] ?? {} });
      setMsg({ tom: "ok", texto: "Rascunho salvo." });
      await carregar();
      return true;
    } catch (e) {
      setMsg({ tom: "erro", texto: e instanceof ApiError ? e.message : "Não foi possível salvar." });
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function concluir() {
    if (!atual) return;
    if (!(await salvar())) return;
    setOcupado(true);
    try {
      await api.post(`/api/cases/sections/${sectionId}/forms/${atual.id}/complete`, {});
      setMsg({ tom: "ok", texto: "Formulário concluído. Para alterar, reabra com o motivo." });
      await carregar();
      onSectionChange?.();
    } catch (e) {
      setMsg({ tom: "erro", texto: e instanceof ApiError ? e.message : "Não foi possível concluir." });
    } finally {
      setOcupado(false);
    }
  }

  async function reabrir() {
    if (!atual) return;
    setOcupado(true);
    try {
      await api.post(`/api/cases/sections/${sectionId}/forms/${atual.id}/reopen`, { reason: motivo });
      setReabrindo(false);
      setMotivo("");
      setMsg({ tom: "ok", texto: "Formulário reaberto. A versão anterior ficou guardada no histórico." });
      await carregar();
    } catch (e) {
      setMsg({ tom: "erro", texto: e instanceof ApiError ? e.message : "Não foi possível reabrir." });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section aria-label="Formulários da especialidade" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-black">
          <ClipboardList className="h-4 w-4 text-roxo" aria-hidden /> Formulários da especialidade
        </h3>
        <span className="text-xs text-neutral-800">{concluidos} de {catalogo.length} concluídos</span>
      </div>

      <p className="rounded-xl border border-ceu-300 bg-ceu-50 px-3 py-2 text-xs text-black">
        Formulários do capítulo da especialidade ({d.version}), em validação clínica. O sistema <strong>não preenche, não soma, não classifica e não conclui</strong>:
        você marca, e o médico lê só depois que você concluir a seção. Use o código do aluno; não escreva nome, telefone ou endereço.
        Instrumentos de teste licenciados guardam apenas o resultado que você digitar.
      </p>

      {!d.editavel && (
        <p className="flex items-center gap-2 rounded-xl border border-linha bg-fundo px-3 py-2 text-xs text-black">
          <Lock className="h-3.5 w-3.5" aria-hidden /> A seção está concluída: os formulários ficam somente para consulta.
        </p>
      )}

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Lista de formulários">
        {catalogo.map((f) => {
          const l = linhas.get(f.id);
          const st: Status = l?.status ?? "nao_iniciado";
          const prog = progressoDef(f, rascunhos[f.id] ?? l?.payload ?? {});
          const ativo = aberto === f.id;
          return (
            <li key={f.id}>
              <button
                type="button"
                aria-pressed={ativo}
                onClick={() => {
                  setAberto(ativo ? null : f.id);
                  setModo(d.editavel && st !== "concluido" ? "preencher" : "resumo");
                  setMsg(null);
                  setReabrindo(false);
                }}
                className={`flex min-h-[56px] w-full flex-col gap-1 rounded-xl border px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-roxo/50 ${
                  ativo ? "border-roxo bg-roxo-50" : "border-linha bg-white hover:bg-fundo"
                }`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-black">{f.letra} · {f.titulo}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${COR[st]}`}>{ROTULO[st]}</span>
                </span>
                <span className="text-[11px] text-neutral-800">{prog.respondidos} de {prog.total} campos respondidos</span>
              </button>
            </li>
          );
        })}
      </ul>

      {atual && (
        <div className="space-y-3 rounded-2xl border border-linha bg-white p-3 sm:p-4">
          <div>
            <h4 className="text-sm font-bold text-black">{atual.letra} · {atual.titulo}</h4>
            <p className="text-xs text-neutral-800">{atual.dica}</p>
          </div>

          <div role="tablist" aria-label="Modo de exibição" className="inline-flex rounded-xl border border-linha bg-fundo p-0.5">
            {([
              ["preencher", travado ? "Folha completa" : "Preencher", Pencil],
              ["resumo", "Resumo visual", Eye],
            ] as const).map(([id, rotulo, Icone]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={modo === id}
                onClick={() => setModo(id)}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${modo === id ? "bg-white text-black shadow-sm" : "text-neutral-800"}`}
              >
                <Icone className="h-3.5 w-3.5" aria-hidden /> {rotulo}
              </button>
            ))}
          </div>

          {modo === "resumo" ? (
            <ResumoVisual form={atual} value={valor} />
          ) : (
            <ReFormRenderer form={atual} value={valor} readOnly={travado} onChange={(next) => setRascunhos((r) => ({ ...r, [atual.id]: next }))} />
          )}

          {atual.pendenciasDeValidacao.length > 0 && (
            <details className="rounded-xl border border-ouro-300 bg-ouro-50 px-3 py-2 text-[11px] text-black">
              <summary className="cursor-pointer font-semibold">Itens do capítulo ainda em validação clínica ({atual.pendenciasDeValidacao.length})</summary>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {atual.pendenciasDeValidacao.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-linha pt-3">
            <span className="text-[11px] text-neutral-700">
              {alterado && !travado && "Alterações ainda não salvas. "}
              {linha?.completedAt && `Concluído em ${new Date(linha.completedAt).toLocaleDateString("pt-BR")}`}
              {linha && linha.reaberturas > 0 && `${linha.completedAt ? " · " : ""}reaberto ${linha.reaberturas}×`}
            </span>
            <div className="flex flex-wrap gap-2">
              {!travado && (
                <>
                  <button type="button" onClick={() => void salvar()} disabled={ocupado || !alterado} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-linha bg-white px-3 text-xs font-semibold text-black hover:bg-fundo disabled:opacity-60">
                    <Save className="h-3.5 w-3.5" aria-hidden /> Salvar rascunho
                  </button>
                  <button type="button" onClick={() => void concluir()} disabled={ocupado || Object.keys(valor).length === 0} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-roxo bg-roxo-100 px-3 text-xs font-semibold text-black hover:bg-roxo-200 disabled:opacity-60">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Concluir formulário
                  </button>
                </>
              )}
              {d.editavel && status === "concluido" && !reabrindo && (
                <button type="button" onClick={() => setReabrindo(true)} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-ouro-400 bg-ouro-50 px-3 text-xs font-semibold text-black hover:bg-ouro-100">
                  <Pencil className="h-3.5 w-3.5" aria-hidden /> Reabrir para retificar
                </button>
              )}
            </div>
          </div>

          {reabrindo && (
            <div className="space-y-2 rounded-xl border border-ouro-300 bg-ouro-50 p-3">
              <label htmlFor="esp-motivo" className="block text-xs font-semibold text-black">Motivo da reabertura (fica na trilha do caso)</label>
              <input id="esp-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} className="w-full rounded-lg border border-linha bg-white px-3 py-2 text-sm text-black" />
              <div className="flex gap-2">
                <button type="button" onClick={() => void reabrir()} disabled={ocupado || motivo.trim().length < 3} className="inline-flex items-center gap-1.5 rounded-lg border border-ouro-400 bg-white px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-60">
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Confirmar reabertura
                </button>
                <button type="button" onClick={() => setReabrindo(false)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-black hover:bg-white">Cancelar</button>
              </div>
            </div>
          )}

          {msg && (
            <p role={msg.tom === "erro" ? "alert" : "status"} className={`text-xs ${msg.tom === "erro" ? "font-semibold text-erro" : "text-black"}`}>
              {msg.texto}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
