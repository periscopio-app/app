"use client";

import { useEffect, useState } from "react";
import { History, Save } from "lucide-react";
import { api } from "@/lib/api";
import { Modal, Button } from "@/components/ui";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
export const SERIES_SUGERIDAS = ["1º ano", "2º ano", "3º ano", "4º ano", "5º ano"];

interface Alteracao {
  id: string;
  action: string;
  by: string | null;
  at: string;
  payload?: { changedFields?: string[]; before?: Record<string, unknown>; after?: Record<string, unknown> } | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  studentId: string;
  studentCode: string;
  birthYear: number | null;
  birthMonth: number | null;
  grade: string | null;
  /** Depois de salvar: o pai recarrega o caso e as listas. */
  onSaved: (novo: { birthYear: number | null; birthMonth: number | null; grade: string | null }) => void;
}

const ROTULO_CAMPO: Record<string, string> = { birthYear: "Ano de nascimento", birthMonth: "Mês de nascimento", grade: "Série" };

function valorTexto(campo: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "(vazio)";
  if (campo === "birthMonth" && typeof v === "number") return MESES[v - 1] ?? String(v);
  return String(v);
}

/** Edição dos dados do aluno que o RE preenche (nascimento e série), com histórico de quem alterou e quando. */
export function AlunoEdicaoModal({ open, onClose, studentId, studentCode, birthYear, birthMonth, grade, onSaved }: Props) {
  const [ano, setAno] = useState<number>(birthYear ?? new Date().getFullYear() - 7);
  const [mes, setMes] = useState<number>(birthMonth ?? 1);
  const [serie, setSerie] = useState<string>(grade ?? "");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [historico, setHistorico] = useState<Alteracao[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setAno(birthYear ?? new Date().getFullYear() - 7);
    setMes(birthMonth ?? 1);
    setSerie(grade ?? "");
    setErro(null);
    let vivo = true;
    api
      .get<{ history: Alteracao[] }>(`/api/students/${studentId}/history`)
      .then((r) => vivo && setHistorico(r.history))
      .catch(() => vivo && setHistorico([]));
    return () => {
      vivo = false;
    };
  }, [open, studentId, birthYear, birthMonth, grade]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErro(null);
    try {
      const body: Record<string, unknown> = {};
      if (ano !== birthYear) body.birthYear = ano;
      if (mes !== birthMonth) body.birthMonth = mes;
      if ((serie.trim() || null) !== (grade ?? null)) body.grade = serie.trim();
      if (Object.keys(body).length === 0) {
        onClose();
        return;
      }
      const r = await api.patch<{ student: { birthYear: number | null; birthMonth: number | null; grade: string | null } }>(`/api/students/${studentId}`, body);
      onSaved({ birthYear: r.student.birthYear, birthMonth: r.student.birthMonth, grade: r.student.grade ?? null });
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  const campo = "w-full rounded-xl border border-linha bg-white px-3 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-roxo/40";

  return (
    <Modal open={open} onClose={onClose} title="Editar dados do aluno" description={`Código ${studentCode}. Nome e documentos ficam só no Cofre.`} maxWidth="lg">
      <form onSubmit={salvar} className="space-y-4" data-testid="aluno-edicao">
        {erro && <p role="alert" className="rounded-xl bg-erro/10 px-3 py-2 text-sm text-black">{erro}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="ed-ano" className="mb-1 block text-xs font-semibold text-black">Ano de nascimento</label>
            <input id="ed-ano" type="number" className={campo} value={ano} onChange={(e) => setAno(Number(e.target.value))} />
          </div>
          <div>
            <label htmlFor="ed-mes" className="mb-1 block text-xs font-semibold text-black">Mês de nascimento</label>
            <select id="ed-mes" className={campo} value={mes} onChange={(e) => setMes(Number(e.target.value))}>
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ed-serie" className="mb-1 block text-xs font-semibold text-black">Série / ano escolar</label>
            <input id="ed-serie" list="ed-series" maxLength={40} className={campo} value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="Ex.: 3º ano" />
            <datalist id="ed-series">
              {SERIES_SUGERIDAS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        </div>
        <p className="text-xs text-neutral-800">Piloto: alunos de 6 anos a 9 anos e 11 meses. Toda alteração fica registrada com quem fez e quando.</p>

        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose} variant="outline" size="md">Cancelar</Button>
          <Button type="submit" disabled={busy} variant="primary" size="md">
            <Save className="h-4 w-4" aria-hidden /> {busy ? "Salvando…" : "Salvar alteração"}
          </Button>
        </div>

        <section aria-label="Histórico de alterações" className="rounded-xl border border-linha bg-fundo p-3">
          <h4 className="mb-2 flex items-center gap-2 text-xs font-bold text-black"><History className="h-4 w-4" aria-hidden /> Histórico</h4>
          {historico === null ? (
            <p className="text-xs text-neutral-800">Carregando…</p>
          ) : historico.length === 0 ? (
            <p className="text-xs text-neutral-800">Sem registros.</p>
          ) : (
            <ul className="max-h-48 space-y-2 overflow-y-auto text-xs text-black">
              {historico.map((h) => (
                <li key={h.id} className="rounded-lg border border-linha bg-white px-3 py-2">
                  <p className="font-semibold">
                    {h.action === "create_student" ? "Cadastro" : "Alteração"} · {new Date(h.at).toLocaleString("pt-BR")} · {h.by ?? "usuário"}
                  </p>
                  {h.action === "update_student" && h.payload?.changedFields?.map((c) => (
                    <p key={c}>
                      {ROTULO_CAMPO[c] ?? c}: {valorTexto(c, h.payload?.before?.[c])} → <strong>{valorTexto(c, h.payload?.after?.[c])}</strong>
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </section>
      </form>
    </Modal>
  );
}
