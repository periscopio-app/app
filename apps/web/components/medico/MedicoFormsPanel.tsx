"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronsDownUp, ChevronsUpDown, ClipboardList, Lock, MessageSquareText, Pencil, RotateCcw, Save, School, Send } from "lucide-react";
import { MD_FORMS, MD_TEXTO_MAX, type MdCampo, type MdFormId } from "@periscopio/shared";
import { api, ApiError } from "@/lib/api";
import { GenogramaEditor } from "@/components/genograma/GenogramaEditor";
import { Button } from "@/components/ui";

type Status = "nao_iniciado" | "rascunho" | "concluido";
interface FormRow {
  id: MdFormId;
  titulo: string;
  status: Status;
  payload: Record<string, string>;
  updatedAt: string | null;
  completedAt: string | null;
  reaberturas: number;
  desatualizado: boolean;
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
 * Formulário do Médico: ficha única, na sequência do papel (seções B a R).
 * Campos do capítulo médico, com as mesmas perguntas do papel. O sistema não sugere nem preenche nada.
 */
export function MedicoFormsPanel({
  caseId,
  queixaEscola,
  dificuldadesPersistentes,
  schoolName,
  studentCode,
}: {
  caseId: string;
  queixaEscola?: string | null;
  /** Dificuldades assinaladas pelo RE no Formulário I (FOGAP · secao_sumario.dificuldades_persistentes). */
  dificuldadesPersistentes?: string[] | null;
  schoolName?: string | null;
  studentCode?: string | null;
}) {
  const [d, setD] = useState<Resp | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [rascunhos, setRascunhos] = useState<Record<string, Record<string, string>>>({});
  const [msg, setMsg] = useState<Record<string, { tom: "ok" | "erro"; texto: string }>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<Record<string, string>>({});
  const [reabrindo, setReabrindo] = useState<string | null>(null);
  // Seções abertas na tela. Começa só na primeira: a ficha tem 17 seções e o médico escolhe onde ir pelo índice.
  const [abertas, setAbertas] = useState<Set<string>>(new Set(["queixa_escola"]));
  const refs = useRef<Record<string, HTMLDetailsElement | null>>({});

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
    setAbertas(new Set(["queixa_escola"]));
    void carregar();
  }, [carregar]);

  const alternar = (id: string, aberta: boolean) =>
    setAbertas((a) => {
      const n = new Set(a);
      if (aberta) n.add(id);
      else n.delete(id);
      return n;
    });
  const irPara = (id: string) => {
    alternar(id, true);
    requestAnimationFrame(() => refs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const aviso = (id: string, tom: "ok" | "erro", texto: string) => setMsg((m) => ({ ...m, [id]: { tom, texto } }));

  async function salvar(id: MdFormId) {
    setOcupado(id);
    try {
      const form = d?.forms.find((f) => f.id === id);
      await api.put(`/api/cases/${caseId}/medical-forms/${id}`, {
        payload: rascunhos[id] ?? {},
        ...(form?.updatedAt ? { ifUpdatedAt: form.updatedAt } : {}),
      });
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
      const form = d?.forms.find((f) => f.id === id);
      await api.put(`/api/cases/${caseId}/medical-forms/${id}`, {
        payload: rascunhos[id] ?? {},
        ...(form?.updatedAt ? { ifUpdatedAt: form.updatedAt } : {}),
      });
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

  const pct = Math.round((concluidos / d.forms.length) * 100);

  return (
    <section aria-label="Formulário do Médico" className="space-y-3">
      {(schoolName || studentCode) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-linha bg-fundo px-3 py-2 text-xs text-black" data-testid="md-form-escola">
          {studentCode && <span className="font-mono font-bold">{studentCode}</span>}
          {schoolName && (
            <>
              {studentCode && <span className="text-neutral-300">·</span>}
              <span className="flex items-center gap-1"><School className="h-3.5 w-3.5 text-roxo" aria-hidden /> {schoolName}</span>
            </>
          )}
        </div>
      )}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold text-black">
            <ClipboardList className="h-4 w-4 text-roxo" aria-hidden /> Formulário do Médico
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-neutral-800" data-testid="md-progresso">{concluidos} de {d.forms.length} seções concluídas</span>
            <Button
              type="button"
              onClick={() => setAbertas(new Set(d.forms.map((f) => f.id)))}
              variant="outline" size="sm"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" aria-hidden /> Abrir todas
            </Button>
            <Button
              type="button"
              onClick={() => setAbertas(new Set())}
              variant="outline" size="sm"
            >
              <ChevronsDownUp className="h-3.5 w-3.5" aria-hidden /> Recolher todas
            </Button>
          </div>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-linha" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Seções concluídas">
          <div className="h-full bg-roxo transition-all" style={{ width: `${pct}%` }} />
        </div>
        {/* Índice B–R: pula direto para a seção; a cor mostra a situação */}
        <nav aria-label="Seções do formulário" className="flex flex-wrap gap-1.5">
          {d.forms.map((f) => {
            const def = MD_FORMS[f.id];
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => irPara(f.id)}
                title={`${def.letra}. ${f.titulo}: ${ROTULO[f.status]}`}
                aria-label={`${def.letra}. ${f.titulo}: ${ROTULO[f.status]}`}
                className={`h-7 min-w-7 rounded-lg border px-1.5 text-[11px] font-bold ${
                  f.status === "concluido" ? "border-sucesso/40 bg-sucesso/10 text-black" : f.status === "rascunho" ? "border-ouro-300 bg-ouro-100 text-black" : "border-linha bg-white text-black"
                } hover:ring-2 hover:ring-roxo/30`}
              >
                {def.letra}
              </button>
            );
          })}
        </nav>
      </div>

      <p className="rounded-xl border border-ceu-300 bg-ceu-50 px-3 py-2 text-xs text-black">
        Campos do capítulo médico ({d.version}). O sistema <strong>não sugere, não classifica e não preenche</strong> hipótese, conduta, prescrição ou alta, e não calcula escore.
        Use o código do aluno, sem nome, telefone ou endereço.
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
          <details
            key={f.id}
            id={`md-secao-${f.id}`}
            ref={(el) => { refs.current[f.id] = el; }}
            open={abertas.has(f.id)}
            onToggle={(e) => alternar(f.id, (e.currentTarget as HTMLDetailsElement).open)}
            className="scroll-mt-4 rounded-xl border border-linha bg-white"
          >
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-black">
              <span className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-roxo-100 text-xs font-extrabold text-black" aria-hidden>{def.letra}</span>
                <span>{f.titulo}</span>
              </span>
              <span className="flex items-center gap-1.5">
                {f.id === "sumario_medico" && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-roxo/30 bg-roxo-50 px-2 py-0.5 text-[10px] font-bold text-black">
                    <Send className="h-3 w-3" aria-hidden /> Vai aos especialistas
                  </span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${COR[f.status]}`}>{ROTULO[f.status]}</span>
              </span>
            </summary>
            {f.desatualizado && (
              <p className="border-t border-ouro-300 bg-ouro-50 px-3 py-2 text-xs font-semibold text-black" role="status">
                Formulário atualizado: reveja e conclua de novo.
              </p>
            )}
            {f.status === "concluido" && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sucesso/20 bg-sucesso/5 px-3 py-2 text-xs text-black" role="status">
                <span>Seção concluída em {f.completedAt ? new Date(f.completedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"} — para alterar, reabra.</span>
                {d.editavel && reabrindo !== f.id && (
                  <Button type="button" onClick={() => setReabrindo(f.id)} variant="warning" size="sm">
                    <Pencil className="h-3.5 w-3.5" aria-hidden /> Reabrir
                  </Button>
                )}
              </div>
            )}
            <div className="space-y-2 border-t border-linha p-3">
              <p className="text-xs text-neutral-800">{def.descricao}</p>
              {f.id === "queixa_escola" && (
                <div className="rounded-xl border border-roxo-200/70 bg-roxo-50/60 px-3 py-2 space-y-2" data-testid="md-queixa-do-re">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-black">
                    <MessageSquareText className="h-3.5 w-3.5 text-roxo" aria-hidden /> Registros do RE (só consulta)
                  </span>
                  {dificuldadesPersistentes && dificuldadesPersistentes.length > 0 && (
                    <div>
                      <p className="mb-1 text-[11px] font-semibold text-neutral-800">Dificuldades persistentes assinaladas:</p>
                      <div className="flex flex-wrap gap-1">
                        {dificuldadesPersistentes.map((d) => (
                          <span key={d} className="rounded-full border border-roxo-200 bg-white px-2 py-0.5 text-[11px] font-medium text-roxo">{d}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="mb-0.5 text-[11px] font-semibold text-neutral-800">Queixa do professor:</p>
                    <p className="whitespace-pre-wrap break-words text-xs text-black">
                      {queixaEscola?.trim() ? queixaEscola.trim() : <span className="italic text-neutral-700">Não registrada.</span>}
                    </p>
                  </div>
                </div>
              )}
              {def.aviso && <p className="rounded-lg bg-ceu-50 px-2 py-1 text-[11px] text-black">{def.aviso}</p>}
              {def.campos.map((campo, idx) => {
                const texto = valores[campo.id] ?? "";
                const idCampo = `md-${f.id}-${campo.id}`;
                const mudar = (v: string) => setRascunhos((r) => ({ ...r, [f.id]: { ...(r[f.id] ?? {}), [campo.id]: v } }));
                const novoGrupo = campo.grupo && campo.grupo !== def.campos[idx - 1]?.grupo;
                return (
                  <div key={campo.id} className="space-y-1">
                    {novoGrupo && <p className="border-t border-linha pt-2 text-xs font-extrabold text-black">{campo.grupo}</p>}
                    {campo.nota && <p className="rounded-lg bg-fundo px-2 py-1 text-[11px] text-black">{campo.nota}</p>}
                    <CampoMd campo={campo} idCampo={idCampo} valor={texto} travado={travado} mudar={mudar} ocultarRotulo={!!campo.grupo && semAcento(campo.grupo) === semAcento(campo.rotulo)} />
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
                      <Button
                        type="button"
                        onClick={() => void salvar(f.id)}
                        disabled={ocupado === f.id}
                        variant="outline" size="sm"
                      >
                        <Save className="h-3.5 w-3.5" aria-hidden /> Salvar rascunho
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void concluir(f.id)}
                        disabled={ocupado === f.id || !preenchido}
                        variant="primary" size="sm"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Concluir seção
                      </Button>
                    </>
                  )}
                  {d.editavel && f.status === "concluido" && reabrindo !== f.id && (
                    <Button
                      type="button"
                      onClick={() => setReabrindo(f.id)}
                      variant="warning" size="sm"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden /> Reabrir para retificar
                    </Button>
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
                    <Button
                      type="button"
                      onClick={() => void reabrir(f.id)}
                      disabled={ocupado === f.id || (motivo[f.id] ?? "").trim().length < 3}
                      variant="warning" size="sm"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Confirmar reabertura
                    </Button>
                    <Button type="button" onClick={() => setReabrindo(null)} variant="ghost" size="sm">
                      Cancelar
                    </Button>
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

const ENTRADA = "rounded-xl border border-linha px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-roxo/40 disabled:bg-fundo";

/** Um campo do formulário do médico, no formato do papel (marcação, número, data ou texto). */
const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

function CampoMd({ campo, idCampo, valor, travado, mudar, ocultarRotulo = false }: { campo: MdCampo; idCampo: string; valor: string; travado: boolean; mudar: (v: string) => void; ocultarRotulo?: boolean }) {
  // Quando o título do bloco já diz o mesmo que o rótulo (ex.: "Gestação" / "Gestação"), o rótulo só fica para leitor de tela.
  const rotulo = (
    <>
      <span className={ocultarRotulo ? "sr-only" : "block text-xs font-semibold text-black"}>{campo.rotulo}</span>
      {campo.ajuda && <span className="block text-[11px] font-normal text-neutral-700">{campo.ajuda}</span>}
    </>
  );
  if (campo.tipo === "genograma") {
    return (
      <div className="space-y-1">
        <span className="block text-xs font-semibold text-black">{campo.rotulo}</span>
        {campo.ajuda && <p className="text-[11px] text-neutral-700">{campo.ajuda}</p>}
        <GenogramaEditor idBase={idCampo} value={valor} onChange={mudar} disabled={travado} />
      </div>
    );
  }
  if (campo.tipo === "escolha") {
    return (
      <fieldset className="space-y-1">
        <legend className="mb-1">{rotulo}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {campo.opcoes?.map((o) => (
            <label key={o.valor} className="flex items-center gap-1.5 text-xs text-black">
              <input
                type="radio"
                name={idCampo}
                checked={valor === o.valor}
                disabled={travado}
                onChange={() => mudar(o.valor)}
                className="h-4 w-4 accent-roxo"
              />
              {o.rotulo}
            </label>
          ))}
          {valor && !travado && (
            <button type="button" onClick={() => mudar("")} className="text-[11px] text-neutral-700 underline">limpar</button>
          )}
        </div>
      </fieldset>
    );
  }
  if (campo.tipo === "multi") {
    const marcados = new Set(valor ? valor.split(",") : []);
    const alternar = (v: string) => {
      const n = new Set(marcados);
      if (n.has(v)) n.delete(v);
      else {
        if (campo.exclusivo && v === campo.exclusivo) n.clear();
        else if (campo.exclusivo) n.delete(campo.exclusivo);
        n.add(v);
      }
      mudar((campo.opcoes ?? []).map((o) => o.valor).filter((x) => n.has(x)).join(","));
    };
    return (
      <fieldset className="space-y-1">
        <legend className="mb-1">{rotulo}</legend>
        <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {campo.opcoes?.map((o) => (
            <label key={o.valor} className="flex items-start gap-1.5 text-xs text-black">
              <input
                type="checkbox"
                checked={marcados.has(o.valor)}
                disabled={travado}
                onChange={() => alternar(o.valor)}
                className="mt-0.5 h-4 w-4 accent-roxo"
              />
              <span>{o.rotulo}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  return (
    <div className="space-y-1">
      <label className="block" htmlFor={idCampo}>{rotulo}</label>
      {campo.tipo === "data" ? (
        <input id={idCampo} type="date" value={valor} disabled={travado} onChange={(e) => mudar(e.target.value)} className={ENTRADA} />
      ) : campo.tipo === "numero" ? (
        <input id={idCampo} type="text" inputMode="decimal" maxLength={8} value={valor} disabled={travado} onChange={(e) => mudar(e.target.value.replace(/[^\d.,]/g, ""))} className={`w-32 ${ENTRADA}`} />
      ) : campo.tipo === "texto_curto" ? (
        <input id={idCampo} type="text" maxLength={campo.max} value={valor} disabled={travado} onChange={(e) => mudar(e.target.value)} className={`w-full ${ENTRADA}`} />
      ) : (
        <>
          <textarea id={idCampo} rows={4} maxLength={MD_TEXTO_MAX} value={valor} disabled={travado} onChange={(e) => mudar(e.target.value)} className={`w-full ${ENTRADA}`} />
          <span className="block text-[11px] text-neutral-700">{valor.length}/{MD_TEXTO_MAX}</span>
        </>
      )}
    </div>
  );
}
