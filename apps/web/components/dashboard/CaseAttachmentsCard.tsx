"use client";

import { useState, useEffect } from "react";
import { Paperclip, Upload, Download, FileText, CheckCircle2, Clock, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";

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

export function CaseAttachmentsCard({ caseId }: CaseAttachmentsCardProps) {
  const [attachments, setAttachments] = useState<ClinicalAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);

  const fetchAttachments = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ attachments: ClinicalAttachment[] }>(`/api/cases/${caseId}/attachments`);
      setAttachments(res.attachments || []);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttachments();
  }, [caseId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // 1. Upload intent
      const intent = await api.post<{
        success: boolean;
        storageKey: string;
      }>(`/api/cases/${caseId}/attachments/upload-intent`, {
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSizeBytes: file.size,
        category: "relatorio_clinico",
      });

      // 2. Confirm upload
      await api.post(`/api/cases/${caseId}/attachments/confirm`, {
        storageKey: intent.storageKey,
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSizeBytes: file.size,
        category: "relatorio_clinico",
      });

      fetchAttachments();
    } catch (err: any) {
      alert(err?.message || "Erro no upload do anexo.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDownload = async (attachmentId: string) => {
    try {
      const res = await api.get<{ signedUrl: string; expiresInSeconds: number; fileName: string }>(
        `/api/cases/${caseId}/attachments/${attachmentId}/signed-url`
      );
      setDownloadMsg(`URL temporária assinada gerada (expira em ${res.expiresInSeconds}s). Download autorizado e auditado.`);
      setTimeout(() => setDownloadMsg(null), 6000);
    } catch (err: any) {
      alert(err?.message || "Erro ao solicitar URL assinada de download.");
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-sky-50 text-sky-700 rounded-xl border border-sky-200">
            <Paperclip className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-black flex items-center gap-2">
              Anexos e Documentos Clínicos
              <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                {attachments.length} documento(s)
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Armazenamento protegido sob chaves opacas. URLs assinadas com expiração estrita de 10 minutos (600s).
            </p>
          </div>
        </div>

        <label className="px-3 py-1.5 text-xs font-bold rounded-xl bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100 transition cursor-pointer flex items-center gap-1.5">
          <Upload className="w-3.5 h-3.5" />
          {uploading ? "Enviando..." : "Anexar Arquivo"}
          <input
            type="file"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
            accept=".pdf,.docx,.xlsx,.csv,.png,.jpg"
          />
        </label>
      </div>

      {downloadMsg && (
        <div className="text-xs text-emerald-800 bg-emerald-50 p-3 rounded-xl border border-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{downloadMsg}</span>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-400">Carregando anexos...</p>
      ) : attachments.length === 0 ? (
        <div className="bg-slate-50 rounded-xl p-4 text-center text-xs text-slate-500 border border-slate-200/60">
          Nenhum documento ou relatório clínico anexado a este caso.
        </div>
      ) : (
        <div className="space-y-2 pt-1 border-t border-slate-100">
          {attachments.map((att) => (
            <div key={att.id} className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-purple-700 shrink-0" />
                <div>
                  <p className="font-semibold text-black">{att.originalName}</p>
                  <p className="text-[11px] text-slate-500">
                    {(att.fileSizeBytes / 1024).toFixed(1)} KB • {new Date(att.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleDownload(att.id)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1 shadow-2xs"
                title="Emitir URL assinada temporária"
              >
                <Download className="w-3.5 h-3.5" /> Baixar (600s)
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
