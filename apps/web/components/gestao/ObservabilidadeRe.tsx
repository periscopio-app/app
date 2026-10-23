"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, EyeOff, Hourglass, Save, SkipForward, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui";

interface Cell { value: number | null; suppressed: boolean }
interface PassoTempo { step: string; casos: number; medianaSegundos: Cell; baselineMinutos: number | null; ganhoMedianoMinutos: number | null }
interface TeaInstr { instrument: string; iniciados: Cell; enviados: Cell; rascunhos: Cell; medianaDiasAteEnvio: Cell }
interface Obs {
  smallCell: number;
  passos: { id: string; letra: string; titulo: string }[];
  tempo: { passos: PassoTempo[]; casosComTempo: number; medianaTotalSegundos: Cell; horasGanhasEstimadas: Cell };
  podeEditarBaselines: boolean;
  usoOpcional: { casosComJornada: number; casosComGPulado: Cell; percentual: Cell; retomadas: Cell };
  tea: { casosComTriagem: number; instrumentos: TeaInstr[]; ataAguardandoResponsavel: Cell; porRespondente: { respondent: string; enviados: Cell }[] };
  notas: string[];
}

const RESPONDENTES: Record<string, string> = { mae_pai: "Mãe / pai", responsavel: "Outro responsável legal", professor: "Professor(a)", outro: "Outro" };
const INSTRUMENTOS: Record<string, string> = { ata: "ATA", asq: "ASQ", mchat: "M-CHAT", srs2: "SRS-2", abc: "ABC" };

function dur(seg: number | null) {
  if (seg == null) return null;
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return m ? `${m} min${s ? ` ${s}s` : ""}` : `${s}s`;
}

function Valor({ c, fmt = (n: number) => String(n), sufixo = "" }: { c: Cell; fmt?: (n: number) => string; sufixo?: string }) {
  if (c.value != null) return <span>{fmt(c.value)}{sufixo}</span>;
  return (
    <span className="inline-flex items-center gap-1 text-neutral-700" title="Menos de 5 casos: oculto para proteger o aluno">
      <EyeOff className="h-3.5 w-3.5" aria-hidden /> {c.suppressed ? "<5" : "—"}
    </span>
  );
}

function Cartao({ icone, titulo, children }: { icone: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-linha bg-white p-4 shadow-suave">
      <p className="flex items-center gap-2 text-xs font-semibold text-neutral-800">{icone}{titulo}</p>
      <p className="mt-1 text-2xl font-extrabold text-black">{children}</p>
    </div>
  );
}

export function ObservabilidadeRe({ schoolId }: { schoolId: string }) {
  const [d, setD] = useState<Obs | null>(null);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [okMsg, setOkMsg] = useState("");

  const carregar = useCallback(() => {
    const qs = schoolId ? `?schoolId=${encodeURIComponent(schoolId)}` : "";
    setErro("");
    api.get<Obs>(`/api/management/re-observability${qs}`).then(setD).catch((e) => setErro(e instanceof Error ? e.message : "Falha ao carregar"));
  }, [schoolId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function salvarBaselines() {
    const baselines = Object.entries(editando)
      .filter(([, v]) => v.trim() !== "" && Number.isFinite(Number(v)))
      .map(([step, v]) => ({ step, baselineMinutes: Math.round(Number(v)) }));
    if (!baselines.length) return;
    setSalvando(true);
    setOkMsg("");
    try {
      await api.put("/api/management/re-time-baselines", { baselines });
      setEditando({});
      setOkMsg("Tempos de referência salvos.");
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setSalvando(false);
    }
  }

  if (erro) return <p role="alert" className="rounded-xl border border-black bg-white p-3 text-sm">{erro}</p>;
  if (!d) return <p className="text-sm">Carregando…</p>;

  const t = d.tempo;
  return (
    <section aria-label="Observabilidade do fluxo do RE" className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao icone={<Clock className="h-4 w-4" />} titulo="Mediana para preencher tudo (A–I)">
          <Valor c={t.medianaTotalSegundos} fmt={(n) => dur(n) ?? "—"} />
        </Cartao>
        <Cartao icone={<Hourglass className="h-4 w-4" />} titulo="Horas ganhas (estimativa)">
          <Valor c={t.horasGanhasEstimadas} sufixo=" h" />
        </Cartao>
        <Cartao icone={<SkipForward className="h-4 w-4" />} titulo="Casos que não aplicaram o SNAP-IV (G)">
          <Valor c={d.usoOpcional.casosComGPulado} />
          {d.usoOpcional.percentual.value != null && <span className="ml-2 text-sm font-semibold">({d.usoOpcional.percentual.value}%)</span>}
        </Cartao>
        <Cartao icone={<Users className="h-4 w-4" />} titulo="ATA aguardando o responsável">
          <Valor c={d.tea.ataAguardandoResponsavel} />
        </Cartao>
      </div>

      <div className="rounded-2xl border border-linha bg-white">
        <h3 className="border-b border-linha px-4 py-3 text-sm font-bold">Tempo ativo por parte do formulário</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="sr-only">Mediana do tempo de preenchimento por parte, comparada ao tempo de referência em papel</caption>
            <thead>
              <tr className="border-b border-linha text-left">
                <th scope="col" className="px-3 py-2">Parte</th>
                <th scope="col" className="px-3 py-2">Casos</th>
                <th scope="col" className="px-3 py-2">Mediana no sistema</th>
                <th scope="col" className="px-3 py-2">Referência no papel (min)</th>
                <th scope="col" className="px-3 py-2">Ganho mediano</th>
              </tr>
            </thead>
            <tbody>
              {d.passos.map((p) => {
                const x = t.passos.find((y) => y.step === p.id);
                if (!x) return null;
                return (
                  <tr key={p.id} className="border-b border-linha last:border-0">
                    <th scope="row" className="px-3 py-2 text-left font-semibold">{p.letra} · {p.titulo}</th>
                    <td className="px-3 py-2">{x.casos < d.smallCell && x.casos > 0 ? "<5" : x.casos}</td>
                    <td className="px-3 py-2"><Valor c={x.medianaSegundos} fmt={(n) => dur(n) ?? "—"} /></td>
                    <td className="px-3 py-2">
                      {d.podeEditarBaselines ? (
                        <>
                          <label className="sr-only" htmlFor={`bl-${p.id}`}>Minutos no papel para {p.titulo}</label>
                          <input
                            id={`bl-${p.id}`}
                            inputMode="numeric"
                            className="w-20 rounded-lg border border-black px-2 py-1"
                            placeholder={x.baselineMinutos != null ? String(x.baselineMinutos) : "—"}
                            value={editando[p.id] ?? ""}
                            onChange={(e) => setEditando((s) => ({ ...s, [p.id]: e.target.value.replace(/\D/g, "").slice(0, 3) }))}
                          />
                        </>
                      ) : (x.baselineMinutos ?? "—")}
                    </td>
                    <td className="px-3 py-2">{x.ganhoMedianoMinutos != null ? `${x.ganhoMedianoMinutos} min` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {d.podeEditarBaselines && (
          <div className="flex flex-wrap items-center gap-3 border-t border-linha px-4 py-3">
            <Button type="button" onClick={salvarBaselines} disabled={salvando || !Object.values(editando).some((v) => v.trim())}
              variant="primary" size="md">
              <Save className="h-4 w-4" aria-hidden /> Salvar tempos de referência
            </Button>
            {okMsg && <span role="status" className="text-sm">{okMsg}</span>}
            <span className="text-xs text-neutral-700">Informe quanto cada parte leva hoje no papel. É a base do tempo ganho.</span>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-linha bg-white">
        <h3 className="border-b border-linha px-4 py-3 text-sm font-bold">Triagem TEA — andamento</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="sr-only">Andamento dos instrumentos de triagem TEA</caption>
            <thead>
              <tr className="border-b border-linha text-left">
                <th scope="col" className="px-3 py-2">Instrumento</th>
                <th scope="col" className="px-3 py-2">Iniciados</th>
                <th scope="col" className="px-3 py-2">Enviados</th>
                <th scope="col" className="px-3 py-2">Em rascunho</th>
                <th scope="col" className="px-3 py-2">Mediana até enviar</th>
              </tr>
            </thead>
            <tbody>
              {d.tea.instrumentos.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-3">Nenhuma triagem iniciada ainda.</td></tr>
              )}
              {d.tea.instrumentos.map((i) => (
                <tr key={i.instrument} className="border-b border-linha last:border-0">
                  <th scope="row" className="px-3 py-2 text-left font-semibold">{INSTRUMENTOS[i.instrument] ?? i.instrument.toUpperCase()}</th>
                  <td className="px-3 py-2"><Valor c={i.iniciados} /></td>
                  <td className="px-3 py-2"><Valor c={i.enviados} /></td>
                  <td className="px-3 py-2"><Valor c={i.rascunhos} /></td>
                  <td className="px-3 py-2"><Valor c={i.medianaDiasAteEnvio} sufixo=" dia(s)" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d.tea.porRespondente.length > 0 && (
          <p className="border-t border-linha px-4 py-3 text-xs">
            Quem respondeu:{" "}
            {d.tea.porRespondente.map((r, k) => (
              <span key={r.respondent}>{k ? " · " : ""}{RESPONDENTES[r.respondent] ?? r.respondent}: <Valor c={r.enviados} /></span>
            ))}
          </p>
        )}
      </div>

      <ul className="list-disc space-y-1 pl-5 text-xs text-neutral-800">
        {d.notas.map((n) => <li key={n}>{n}</li>)}
        <li>Valores com menos de {d.smallCell} casos aparecem como “&lt;5”.</li>
      </ul>
    </section>
  );
}
