"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, FileText, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Alert, Button } from "@/components/ui";

interface TempoFogap {
  periodoDias: number;
  casos: number;
  suppressed: boolean;
  medianaSegundos: number | null;
  mediaSegundos: number | null;
  p25Segundos: number | null;
  p75Segundos: number | null;
  passos: { step: string; casos: number; medianaSegundos: number | null; suppressed: boolean }[];
}
interface Volume {
  periodoDias: number;
  total: { n: number; chars: number; words: number; estTokens: number };
  porFormulario: { form: string; kind: string; n: number; chars: number; words: number; estTokens: number }[];
  observacao: string;
}

const NOME_FORM: Record<string, string> = { devolucao: "Devolução ao RE", fogap: "FOGAP (Sim/Não/Às vezes)", conduta: "Houve conduta" };

/** "9 min 40 s" / "45 s". */
export function formatarDuracao(seg: number | null): string {
  if (seg === null || !Number.isFinite(seg)) return "—";
  const m = Math.floor(seg / 60);
  const s = Math.round(seg % 60);
  if (m === 0) return `${s} s`;
  return s === 0 ? `${m} min` : `${m} min ${s} s`;
}

/**
 * KPIs internos do Administrador Master: mediana do tempo de preenchimento do FOGAP pelo RE e volumetria das justificativas.
 * Só agregados (menos de 5 casos fica oculto). Os dados vêm da API; o navegador não calcula nada.
 */
export function KpisInternosCard() {
  const [dias, setDias] = useState(90);
  const [tempo, setTempo] = useState<TempoFogap | null>(null);
  const [vol, setVol] = useState<Volume | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [t, v] = await Promise.all([
        api.get<TempoFogap>(`/api/admin/kpis/fogap-fill-time?dias=${dias}`),
        api.get<Volume>(`/api/admin/kpis/justification-volume?dias=${dias}`),
      ]);
      setTempo(t);
      setVol(v);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os indicadores.");
    } finally {
      setCarregando(false);
    }
  }, [dias]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <section aria-labelledby="kpis-internos" className="rounded-2xl border border-linha bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="kpis-internos" className="text-base font-bold text-black">Indicadores internos de uso</h2>
        <div className="flex items-center gap-2">
          <label htmlFor="kpis-dias" className="text-xs font-semibold text-black">Período</label>
          <select id="kpis-dias" value={dias} onChange={(e) => setDias(Number(e.target.value))} className="rounded-lg border border-linha bg-white px-2 py-1 text-sm text-black">
            <option value={30}>30 dias</option>
            <option value={90}>90 dias</option>
            <option value={365}>1 ano</option>
          </select>
        </div>
      </div>

      {erro && (
        <div className="mt-3">
          <Alert tom="erro">{erro}</Alert>
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => void carregar()}>Tentar de novo</Button>
        </div>
      )}
      {carregando && !erro && (
        <p className="mt-4 flex items-center gap-2 text-sm text-black" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando…</p>
      )}

      {!carregando && !erro && tempo && vol && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-linha p-4" data-testid="kpi-tempo-fogap">
            <p className="flex items-center gap-2 text-sm font-semibold text-black"><Clock className="h-4 w-4" aria-hidden /> Tempo de preenchimento do FOGAP</p>
            {tempo.casos === 0 ? (
              <p className="mt-2 text-sm text-black">Ainda sem casos enviados com tempo registrado neste período.</p>
            ) : tempo.suppressed ? (
              <p className="mt-2 text-sm text-black">{tempo.casos} caso(s) no período. Com menos de 5 casos o número fica oculto para não identificar ninguém.</p>
            ) : (
              <>
                <p className="mt-2 text-3xl font-extrabold text-black" aria-label={`Mediana ${formatarDuracao(tempo.medianaSegundos)}`}>{formatarDuracao(tempo.medianaSegundos)}</p>
                <p className="text-xs text-black">mediana por caso enviado ({tempo.casos} casos)</p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs text-black">
                  <div><dt className="font-semibold">Média</dt><dd>{formatarDuracao(tempo.mediaSegundos)}</dd></div>
                  <div><dt className="font-semibold">25% levam até</dt><dd>{formatarDuracao(tempo.p25Segundos)}</dd></div>
                  <div><dt className="font-semibold">75% levam até</dt><dd>{formatarDuracao(tempo.p75Segundos)}</dd></div>
                </dl>
                <p className="mt-2 text-[11px] text-black">Tempo ativo na tela, somando as partes A a I. Não mede quem ficou com a tela aberta parada.</p>
              </>
            )}
          </div>

          <div className="rounded-xl border border-linha p-4" data-testid="kpi-volume-justificativas">
            <p className="flex items-center gap-2 text-sm font-semibold text-black"><FileText className="h-4 w-4" aria-hidden /> Volume de justificativas</p>
            {vol.total.n === 0 ? (
              <p className="mt-2 text-sm text-black">Nenhuma justificativa registrada neste período.</p>
            ) : (
              <>
                <p className="mt-2 text-3xl font-extrabold text-black">{vol.total.estTokens.toLocaleString("pt-BR")}</p>
                <p className="text-xs text-black">tokens estimados · {vol.total.n.toLocaleString("pt-BR")} justificativas · {vol.total.words.toLocaleString("pt-BR")} palavras</p>
                <ul className="mt-3 space-y-1 text-xs text-black">
                  {vol.porFormulario.map((l) => (
                    <li key={`${l.form}:${l.kind}`} className="flex justify-between gap-2">
                      <span>{NOME_FORM[l.form] ?? l.form}</span>
                      <span>{l.n} · {l.estTokens.toLocaleString("pt-BR")} tokens</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-black">{vol.observacao}</p>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
