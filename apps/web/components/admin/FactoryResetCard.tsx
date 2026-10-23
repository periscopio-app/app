"use client";

import { useState } from "react";
import { AlertTriangle, Eraser, Loader2, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui";

interface DemoTenant { id: string; name: string; municipalityCode: string }
interface CountRow { table: string; label: string; rows: number }
interface Preview { confirmacao: string; tenants: DemoTenant[]; counts: CountRow[]; total: number }
interface ResetResult { tenants: DemoTenant[]; deleted: CountRow[]; total: number }

/**
 * Reset de fábrica do piloto (Bloco 2). Só o Administrador Master.
 * Zera os dados de aluno/caso dos municípios de DEMONSTRAÇÃO. Municípios reais (Tarumã) nunca entram.
 */
export function FactoryResetCard() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirm, setConfirm] = useState("");
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<ResetResult | null>(null);

  async function carregarPreview() {
    setErro(null); setFeito(null);
    try {
      setPreview(await api.get<Preview>("/api/admin/factory-reset/preview"));
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível carregar a prévia.");
    }
  }

  async function executar() {
    if (!preview || confirm.trim() !== preview.confirmacao) return;
    setRodando(true); setErro(null);
    try {
      const r = await api.post<ResetResult>("/api/admin/factory-reset", { confirm: confirm.trim() });
      setFeito(r); setPreview(null); setConfirm("");
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível executar o reset.");
    } finally {
      setRodando(false);
    }
  }

  return (
    <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-xs" aria-label="Reset de fábrica do piloto">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
          <Eraser className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-black">Reset de fábrica do piloto</h2>
          <p className="mt-0.5 text-xs text-neutral-700">
            Zera os dados de aluno e caso dos municípios de <strong>demonstração</strong> antes do início do piloto.
            Municípios reais (como Tarumã) nunca são afetados, e tenants, escolas e usuários são preservados.
          </p>
        </div>
      </div>

      <p className="mt-3 flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-900">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Proteção tripla: só municípios marcados como demo, lista fixa que exclui Tarumã, e nada de estrutura é apagado.
      </p>

      {erro && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{erro}</p>}

      {feito && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-black">
          <p className="font-bold text-emerald-900">Reset concluído.</p>
          <p className="mt-0.5">
            {feito.total} registro(s) apagado(s) em {feito.tenants.map((t) => t.name).join(", ") || "nenhum município"}.
          </p>
        </div>
      )}

      {!preview ? (
        <Button
          type="button"
          onClick={() => void carregarPreview()}
          variant="danger" size="md" className="mt-4"
        >
          <Eraser className="h-4 w-4" aria-hidden /> Ver o que seria apagado
        </Button>
      ) : (
        <div className="mt-4 space-y-3">
          {preview.tenants.length === 0 ? (
            <p className="rounded-lg border border-linha bg-fundo px-3 py-2 text-xs text-black">
              Nenhum município de demonstração marcado. Nada seria apagado.
            </p>
          ) : (
            <>
              <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
                <p className="flex items-center gap-1.5 text-xs font-bold text-rose-900">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Vai apagar {preview.total} registro(s) de: {preview.tenants.map((t) => t.name).join(", ")}
                </p>
                <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-[11px] text-neutral-800 sm:grid-cols-2">
                  {preview.counts.filter((c) => c.rows > 0).map((c) => (
                    <li key={c.table} className="flex justify-between gap-2"><span>{c.label}</span><strong>{c.rows}</strong></li>
                  ))}
                </ul>
              </div>
              <label className="block text-xs font-semibold text-black">
                Para confirmar, digite <code className="rounded bg-neutral-100 px-1">{preview.confirmacao}</code>
                <input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-linha px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-rose-300"
                  placeholder={preview.confirmacao}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => void executar()}
                  disabled={rodando || confirm.trim() !== preview.confirmacao}
                  variant="danger" size="md"
                >
                  {rodando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Eraser className="h-4 w-4" aria-hidden />}
                  Apagar dados de demonstração
                </Button>
                <Button type="button" onClick={() => { setPreview(null); setConfirm(""); }} variant="ghost" size="md">
                  Cancelar
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
