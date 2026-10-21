"use client";

import { useState } from "react";
import { CheckCircle2, ImageIcon, Loader2, XCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";

interface Step {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  httpStatus?: number;
  ms: number;
}
interface Resultado {
  ok: boolean;
  finishedAt: string;
  avatar: { publicUrl: string | null; httpStatus: number | null };
  steps: Step[];
}

/** Botão do Administrador Master: prova, no ambiente publicado, que foto e anexo chegam ao Supabase e que o link responde 200. */
export function StorageCheckCard() {
  const [rodando, setRodando] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function testar() {
    setRodando(true);
    setErro(null);
    try {
      setRes(await api.post<Resultado>("/api/admin/storage-check", {}));
    } catch (e) {
      setRes(null);
      setErro(e instanceof ApiError ? e.message : "Não foi possível rodar o teste.");
    } finally {
      setRodando(false);
    }
  }

  return (
    <section aria-label="Teste do armazenamento de fotos e anexos">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">Armazenamento de fotos e anexos</h2>
      <div className="rounded-xl border border-[#E1E9ED] bg-white p-4 space-y-3">
        <p className="text-sm text-black">
          Envia uma imagem sintética de 1 pixel ao bucket de fotos, abre o link público e confere o código <strong>200</strong>. Faz o mesmo com o bucket
          privado dos anexos clínicos. Os arquivos de teste são apagados no final.
        </p>
        <button
          type="button"
          onClick={() => void testar()}
          disabled={rodando}
          className="inline-flex items-center gap-2 rounded-lg border border-[#E1E9ED] bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
        >
          {rodando ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <ImageIcon className="w-4 h-4" aria-hidden />}
          {rodando ? "Testando…" : "Testar armazenamento de fotos"}
        </button>
        {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
        {res && (
          <div className="space-y-2" aria-live="polite">
            <p className={`text-sm font-bold ${res.ok ? "text-emerald-700" : "text-red-700"}`}>
              {res.ok ? "Tudo certo: fotos e anexos estão funcionando." : "Há um problema no armazenamento. Veja o passo em vermelho."}
            </p>
            {res.avatar.publicUrl && (
              <p className="text-xs text-slate-700 break-all">
                Link público de teste: <span className="font-mono">{res.avatar.publicUrl}</span> → código{" "}
                <strong>{res.avatar.httpStatus ?? "—"}</strong>
              </p>
            )}
            <ul className="divide-y divide-[#E1E9ED] rounded-lg border border-[#E1E9ED]">
              {res.steps.map((s) => (
                <li key={s.id} className="flex items-start gap-2 p-2.5">
                  {s.ok ? (
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" aria-label="ok" />
                  ) : (
                    <XCircle className="w-4 h-4 mt-0.5 text-red-600 shrink-0" aria-label="falhou" />
                  )}
                  <div className="text-sm">
                    <p className="font-semibold text-black">
                      {s.label}
                      {s.httpStatus != null && <span className="ml-2 font-mono text-xs text-slate-600">HTTP {s.httpStatus}</span>}
                    </p>
                    <p className="text-xs text-slate-600">{s.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
            {!res.ok && (
              <p className="text-xs text-slate-600">
                Causas mais comuns: falta <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span> no Render, ou a chave pertence a outro projeto do Supabase.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
