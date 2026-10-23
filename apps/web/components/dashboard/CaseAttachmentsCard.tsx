"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Paperclip, UploadCloud, Eye, FileText, X, Loader2, ExternalLink, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";

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

function lerComoBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    r.readAsDataURL(file);
  });
}

/**
 * Laudos que os pais levam (Bloco 5). Só RE e médico enviam e abrem; especialistas nunca veem este cartão.
 * PDF, JPG ou PNG, até 10 MB. O arquivo fica no bucket privado e abre aqui dentro, sem link público.
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
      setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os laudos.");
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
        const dataBase64 = await lerComoBase64(file);
        await api.post(`/api/cases/${caseId}/attachments`, { fileName: file.name, dataBase64 });
      }
      await fetchAttachments();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : (e as Error)?.message || "Erro no envio do laudo.");
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
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2.5">
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-2 text-sky-700">
          <Paperclip className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold text-black">
            Laudos trazidos pela família
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              {attachments.length} documento(s)
            </span>
          </h3>
          <p className="flex items-center gap-1 text-xs text-slate-600">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
            PDF ou foto em armazenamento privado. Só o RE e o médico do caso abrem.
          </p>
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void enviar(e.dataTransfer.files); }}
        className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${dragging ? "border-purple-500 bg-purple-50" : "border-slate-300 bg-slate-50"}`}
      >
        {uploading ? <Loader2 className="h-6 w-6 animate-spin text-purple-700" aria-hidden /> : <UploadCloud className="h-6 w-6 text-purple-700" aria-hidden />}
        <p className="text-sm font-semibold text-black">{uploading ? "Enviando…" : "Arraste o PDF aqui"}</p>
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="rounded-xl border border-purple-300 bg-white px-3 py-1.5 text-xs font-bold text-purple-800 hover:bg-purple-50 disabled:opacity-50"
        >
          ou escolher o arquivo
        </button>
        <p className="text-[11px] text-slate-600">PDF, JPG ou PNG (foto do celular), até 10 MB cada.</p>
        <input ref={inputRef} type="file" multiple accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => e.target.files && void enviar(e.target.files)} />
      </div>

      {erro && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{erro}</p>}

      {loading ? (
        <p className="text-xs text-slate-500">Carregando laudos…</p>
      ) : attachments.length === 0 ? (
        <div className="rounded-xl border border-slate-200/60 bg-slate-50 p-4 text-center text-xs text-slate-600">
          Nenhum laudo anexado a este caso.
        </div>
      ) : (
        <ul className="space-y-2 border-t border-slate-100 pt-1">
          {attachments.map((att) => (
            <li key={att.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-xs text-slate-700">
              <div className="flex min-w-0 items-center gap-2.5">
                <FileText className="h-4 w-4 shrink-0 text-purple-700" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-black">{att.originalName}</p>
                  <p className="text-[11px] text-slate-600">
                    {(att.fileSizeBytes / 1024).toFixed(0)} KB • {new Date(att.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void abrir(att)}
                disabled={opening === att.id}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                {opening === att.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
                Visualizar
              </button>
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
