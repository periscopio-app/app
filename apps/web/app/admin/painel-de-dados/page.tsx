"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Database, RefreshCw } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui";

type Celula = string | number | null;
interface Status { configured: boolean; reason?: string; paineis: { id: string; titulo: string }[] }
type Resultado =
  | { configured: false; reason: string }
  | { configured: true; ok: true; id: string; titulo: string; colunas: string[]; linhas: Celula[][]; suprimidas: number; minimoPorCelula: number; atualizadoEm: number }
  | { configured: true; ok: false; id: string; error: string };

const ROTULO: Record<string, string> = { estado: "Estado", mes: "Mês", escola: "Escola", especialidade: "Especialidade", total: "Total" };

/** Painel de dados (Databricks). Só o Administrador Master chega aqui. Dados agregados e sintéticos, sem aluno por linha. */
export default function PainelDeDadosPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [dados, setDados] = useState<Record<string, Resultado>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const s = await api.get<Status>("/api/admin/data-panel");
      setStatus(s);
      if (s.configured) {
        const pares = await Promise.all(s.paineis.map(async (p) => [p.id, await api.get<Resultado>(`/api/admin/data-panel/${p.id}`)] as const));
        setDados(Object.fromEntries(pares));
      }
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível carregar o painel de dados.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="min-h-screen bg-[#F6F9FB] p-4 font-sans text-black sm:p-6 md:p-10">
      <div className="mx-auto max-w-[1100px]">
        <Link href="/admin/saude" className="inline-flex w-fit items-center gap-1.5 text-xs text-slate-600 hover:text-black">
          <ArrowLeft className="h-3.5 w-3.5" /> Saúde do sistema
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            <Database className="h-6 w-6" aria-hidden /> Painel de dados
          </h1>
          <Button type="button" variant="secondary" onClick={() => void carregar()} disabled={carregando}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${carregando ? "animate-spin" : ""}`} aria-hidden /> Atualizar
          </Button>
        </div>
        <p className="mt-1 max-w-[62ch] text-sm text-slate-600">
          Indicadores agregados do Databricks, só para o Administrador Master. Não mostra aluno, nome nem relato. Totais pequenos aparecem como &ldquo;suprimidos&rdquo; para não identificar ninguém.
        </p>

        {erro && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
        {!status && !erro && <p className="mt-6 text-sm text-slate-600">Carregando…</p>}

        {status && !status.configured && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" data-testid="painel-desligado">
            <p className="font-semibold">Painel desligado</p>
            <p className="mt-1">{status.reason}</p>
            <p className="mt-2 text-xs">Nada é consultado enquanto o Databricks não estiver configurado. Ver <code>infra/databricks/README.md</code>.</p>
          </div>
        )}

        {status?.configured && (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {status.paineis.map((p) => {
              const r = dados[p.id];
              return (
                <section key={p.id} className="min-w-0 rounded-xl border border-[#E1E9ED] bg-white p-4" aria-labelledby={`t-${p.id}`}>
                  <h2 id={`t-${p.id}`} className="font-display text-base font-bold">{p.titulo}</h2>
                  {!r && <p className="mt-2 text-sm text-slate-600">Carregando…</p>}
                  {r && !r.configured && <p className="mt-2 text-sm text-slate-600">{r.reason}</p>}
                  {r && r.configured && !r.ok && <p role="alert" className="mt-2 text-sm text-red-800">{r.error}</p>}
                  {r && r.configured && r.ok && (
                    <>
                      {r.linhas.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-600">Ainda sem dados nesta visão.</p>
                      ) : (
                        <div className="mt-2 overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr>{r.colunas.map((c) => <th key={c} className="border-b border-[#E1E9ED] py-1.5 pr-3 text-left text-xs font-semibold text-slate-600">{ROTULO[c] ?? c}</th>)}</tr>
                            </thead>
                            <tbody>
                              {r.linhas.map((l, i) => (
                                <tr key={i}>
                                  {l.map((c, j) => (
                                    <td key={j} className="border-b border-[#E1E9ED] py-1.5 pr-3 tabular-nums">
                                      {c === null ? <span className="text-slate-500" title={`Menos de ${r.minimoPorCelula}`}>suprimido</span> : c}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <p className="mt-2 text-xs text-slate-500">
                        Atualizado às {new Date(r.atualizadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {r.suprimidas > 0 ? ` · ${r.suprimidas} linha(s) com total menor que ${r.minimoPorCelula}` : ""}
                      </p>
                    </>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
