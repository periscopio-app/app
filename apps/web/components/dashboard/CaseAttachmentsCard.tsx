"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Paperclip, UploadCloud, Eye, FileText, X, Loader2, ExternalLink, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Badge, Button } from "@/components/ui";

interface ClinicalAttachment {
  id: string;
  originalName: string;
  category: string;
  fileSizeBytes: number;
  mimeType: string;
  description: string | null;
  createdAt: string;
}

interface CaseAttachmentsCardProps {
  caseId: string;
}

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Laudos que os pais levam (Bloco 5). É um complemento OPCIONAL: nada no envio ao médico depende dele.
 * Só RE e médico enviam e abrem; especialistas nunca veem este cartão. PDF, JPG ou PNG, até 10 MB.
 * O arquivo fica guardado no sistema e abre aqui dentro, sem link público; a lista mostra só o título.
 */
export function CaseAttachmentsCard({ caseId }: CaseAttachmentsCardProps) {
  const [attachments, setAttachments] = useState<ClinicalAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ name: string; url: string; image: boolean } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ attachments: ClinicalAttachment[] }>(`/api/cases/${caseId}/attachments`);
      setAttachments(res.attachments || []);
    } catch (e) {
      // Laudo é opcional: se a lista não carregar, o cartão continua usável e não mostra alarme.
      // O aviso só aparece quando a pessoa tenta anexar ou abrir um arquivo.
      void e;
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { void fetchAttachments(); }, [fetchAttachments]);

  // Libera o PDF da memória ao fechar o visualizador.
  useEffect(() => () => { if (viewer) URL.revokeObjectURL(viewer.url); }, [viewer]);

  async function enviar(files: FileList | File[]) {
    setErro(null);
    const lista = Array.from(files);
    if (lista.length === 0) return;
    setUploading(true);
    try {
      for (const file of lista) {
        const ehAceito = /^(application\/pdf|image\/jpeg|image\/png)$/.test(file.type) || /\.(pdf|jpe?g|png)$/i.test(file.name);
        if (!ehAceito) { setErro(`"${file.name}" não é PDF, JPG ou PNG. Envie o laudo em um desses formatos.`); continue; }
        if (file.size > MAX_BYTES) { setErro(`"${file.name}" passa de 10 MB.`); continue; }
        await api.upload(`/api/cases/${caseId}/attachments`, file);
      }
      await fetchAttachments();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : (e as Error)?.message || "Não foi possível anexar agora. Você pode continuar e tentar depois.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function abrir(att: ClinicalAttachment) {
    setErro(null);
    setOpening(att.id);
    try {
      const res = await fetch(`/api/cases/${caseId}/attachments/${att.id}/file`, { credentials: "include" });
      if (!res.ok) throw new Error(res.status === 403 ? "Seu perfil não pode abrir laudos." : "Não foi possível abrir o laudo agora.");
      const blob = await res.blob();
      setViewer({ name: att.originalName, url: URL.createObjectURL(blob), image: blob.type.startsWith("image/") });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOpening(null);
    }
  }

  return (
    <div className="min-w-0 space-y-4 rounded-2xl border border-linha bg-white p-4 shadow-suave sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-roxo-100 bg-roxo-50 text-roxo">
          <Paperclip className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold leading-snug text-black">Laudos trazidos pela família</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {attachments.length > 0 && <Badge variant="default" className="whitespace-nowrap text-[11px]">{attachments.length} anexado(s)</Badge>}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-neutral-700">
            Se a família trouxe um laudo, anexe aqui. Não é obrigatório para enviar ao médico.
          </p>
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void enviar(e.dataTransfer.files); }}
        className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-4 text-center transition ${dragging ? "border-roxo bg-roxo-50" : "border-linha bg-fundo"}`}
      >
        {uploading ? <Loader2 className="h-6 w-6 animate-spin text-roxo" aria-hidden /> : <UploadCloud className="h-6 w-6 text-roxo" aria-hidden />}
        <p className="text-sm font-semibold text-black">{uploading ? "Enviando…" : "Arraste o laudo aqui"}</p>
        <Button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          variant="outline" size="sm"
        >
          ou escolher o arquivo
        </Button>
        <p className="text-[11px] text-neutral-700">PDF, JPG ou PNG (foto do celular), até 10 MB cada.</p>
        <input ref={inputRef} type="file" multiple accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => e.target.files && void enviar(e.target.files)} />
      </div>

      {erro && <p role="status" className="rounded-xl border border-ouro/40 bg-ouro-50 px-3 py-2 text-xs leading-relaxed text-black">{erro}</p>}

      {loading ? (
        <p className="text-xs text-neutral-700">Carregando laudos…</p>
      ) : attachments.length === 0 ? null : (
        <ul className="space-y-2 border-t border-linha pt-3">
          {attachments.map((att) => (
            <li key={att.id} className="flex items-center justify-between gap-3 rounded-xl border border-linha bg-fundo p-3 text-xs text-neutral-800">
              <div className="flex min-w-0 items-center gap-2.5">
                <FileText className="h-4 w-4 shrink-0 text-roxo" aria-hidden />
                <p className="min-w-0 truncate text-sm font-semibold text-black" title={att.originalName}>{att.originalName}</p>
              </div>
              <Button
                type="button"
                onClick={() => void abrir(att)}
                disabled={opening === att.id}
                variant="outline" size="sm" className="shrink-0"
              >
                {opening === att.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
                Visualizar
              </Button>
            </li>
          ))}
        </ul>
      )}

      {viewer && (
        <div role="dialog" aria-modal="true" aria-label={`Laudo ${viewer.name}`} className="fixed inset-0 z-50 flex flex-col bg-black/70 p-3 sm:p-6">
          <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
              <p className="truncate text-sm font-bold text-black">{viewer.name}</p>
              <div className="flex shrink-0 items-center gap-2">
                <a href={viewer.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50">
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Nova aba
                </a>
                <button type="button" onClick={() => setViewer(null)} aria-label="Fechar visualizador" className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-100">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
            {viewer.image ? (
              <div className="flex flex-1 items-center justify-center overflow-auto bg-slate-100 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={viewer.url} alt={`Laudo ${viewer.name}`} className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <iframe src={viewer.url} title={`Laudo ${viewer.name}`} className="h-full w-full flex-1" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
