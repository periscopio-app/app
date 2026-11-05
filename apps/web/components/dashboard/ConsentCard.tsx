"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, CheckCircle2, AlertTriangle, FileText, UserCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { consentAcceptSchema, cpfFieldError, formatCpf } from "@periscopio/shared";
import { Badge, Button } from "@/components/ui";
import { CartaoProtecao } from "./CartaoProtecao";

interface ConsentAcceptance {
  id: string;
  signerName: string;
  signerRole: string;
  signerDocument?: string;
  status: string;
  acceptedAt: string;
  evidenceSha256: string;
  termTitle: string;
  termVersion: string;
}

interface ConsentCardProps {
  caseId: string;
  studentId?: string;
  studentCode?: string;
}

export function ConsentCard({ caseId, studentId, studentCode }: ConsentCardProps) {
  const [hasActiveConsent, setHasActiveConsent] = useState(false);
  const [acceptances, setAcceptances] = useState<ConsentAcceptance[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [term, setTerm] = useState<{ id: string; version: string; title: string; content: string } | null>(null);

  const [signerName, setSignerName] = useState("");
  const [signerRole, setSignerRole] = useState("mae");
  const [signerDocument, setSignerDocument] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [erroTermo, setErroTermo] = useState<string | null>(null);
  const [cpfTouched, setCpfTouched] = useState(false);
  const cpfErro = cpfFieldError(signerDocument);
  const cpfCompleto = signerDocument.replace(/\D/g, "").length === 11;

  const fetchConsent = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ hasActiveConsent: boolean; acceptances: ConsentAcceptance[] }>(
        `/api/consent/case/${caseId}`
      );
      setHasActiveConsent(data.hasActiveConsent);
      setAcceptances(data.acceptances || []);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchConsent();
  }, [fetchConsent]);

  const openSignModal = async () => {
    setErroTermo(null);
    try {
      const { term: latestTerm } = await api.get<{ term: any }>("/api/consent/terms/latest?type=responsavel_legal");
      setTerm(latestTerm);
      setModalOpen(true);
    } catch {
      setErroTermo("Não foi possível carregar o termo vigente. Tente de novo em instantes.");
    }
  };

  const handleRegisterConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!term) return;
    setErrorMsg(null);
    setCpfTouched(true);

    // Mesma regra da API (zod): nome completo, parentesco e CPF com dígitos verificadores corretos.
    const parsed = consentAcceptSchema.safeParse({ signerName, signerRole, signerDocument });
    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message ?? "Confira os dados do responsável.");
      return;
    }
    setSaving(true);

    try {
      await api.post("/api/consent/accept", {
        termId: term.id,
        caseId,
        studentId,
        signerName: parsed.data.signerName,
        signerRole: parsed.data.signerRole,
        signerDocument: parsed.data.signerDocument,
      });
      setModalOpen(false);
      setSignerName("");
      setSignerDocument("");
      setCpfTouched(false);
      fetchConsent();
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro ao registrar consentimento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CartaoProtecao
      icone={<ShieldCheck className="h-5 w-5" />}
      titulo="Consentimento do Responsável (TCLE - LGPD)"
      selos={
        loading ? (
          <Badge variant="secondary" className="whitespace-nowrap text-[11px]">Verificando…</Badge>
        ) : hasActiveConsent ? (
          <Badge variant="success" className="whitespace-nowrap text-[11px]"><CheckCircle2 className="h-3 w-3" aria-hidden /> Concedido</Badge>
        ) : (
          <Badge variant="warning" className="whitespace-nowrap text-[11px]"><AlertTriangle className="h-3 w-3" aria-hidden /> Pendente de registro</Badge>
        )
      }
      descricao="Autorização livre e esclarecida dos responsáveis legais para triagem e acompanhamento de saúde."
      acoes={
        <Button type="button" onClick={openSignModal} variant="outline" size="sm" disabled={loading}>
          {hasActiveConsent ? "Ver / adicionar prova de aceite" : "Registrar consentimento"}
        </Button>
      }
    >
      {erroTermo && (
        <p role="alert" className="rounded-xl border border-erro/30 bg-erro/5 px-3 py-2 text-xs text-black">{erroTermo}</p>
      )}

      {acceptances.length > 0 && (
        <ul className="space-y-2 border-t border-linha pt-3">
          {acceptances.map((acc) => (
            <li key={acc.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-linha bg-fundo p-3 text-xs text-neutral-800">
              <div className="min-w-0">
                <p className="break-words font-semibold text-black">
                  Signatário(a): {acc.signerName} ({acc.signerRole})
                </p>
                <p className="text-[11px] text-neutral-700">
                  {acc.termTitle} ({acc.termVersion}) • Assinado em {new Date(acc.acceptedAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <span className="shrink-0 rounded border border-linha bg-white px-2 py-1 font-mono text-[10px] text-neutral-700" title={`Evidência SHA-256: ${acc.evidenceSha256}`}>
                Hash: {acc.evidenceSha256.slice(0, 8)}…
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Modal de Registro de Aceite */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Registro de Consentimento Legal (TCLE)">
        {term && (
          <form onSubmit={handleRegisterConsent} className="space-y-4 text-left">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 max-h-48 overflow-y-auto text-xs text-slate-700 leading-relaxed font-mono">
              <h4 className="font-bold text-black mb-1">{term.title} ({term.version})</h4>
              <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{term.content}</p>
            </div>

            {errorMsg && (
              <div className="text-xs text-rose-800 bg-rose-50 p-3 rounded-xl border border-rose-200">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-black mb-1">
                Nome Completo do Responsável Signatário *
              </label>
              <input
                type="text"
                required
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Ex.: Maria da Silva"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-black"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Grau de Parentesco *
                </label>
                <select
                  value={signerRole}
                  onChange={(e) => setSignerRole(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-black"
                >
                  <option value="mae">Mãe</option>
                  <option value="pai">Pai</option>
                  <option value="responsavel_legal">Responsável Legal / Tutor</option>
                  <option value="outro">Outro Familiar</option>
                </select>
              </div>

              <div>
                <label htmlFor="consent-cpf" className="block text-xs font-bold text-black mb-1">
                  CPF do Responsável (opcional)
                </label>
                <input
                  id="consent-cpf"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={14}
                  value={signerDocument}
                  onChange={(e) => setSignerDocument(formatCpf(e.target.value))}
                  onBlur={() => setCpfTouched(true)}
                  aria-invalid={cpfTouched && !!cpfErro}
                  aria-describedby="consent-cpf-msg"
                  placeholder="000.000.000-00"
                  className={`w-full px-3 py-2 text-sm rounded-xl border bg-white text-black ${
                    cpfTouched && cpfErro ? "border-rose-500" : cpfCompleto && !cpfErro ? "border-emerald-500" : "border-slate-300"
                  }`}
                />
                <p
                  id="consent-cpf-msg"
                  role={cpfTouched && cpfErro ? "alert" : undefined}
                  className={`mt-1 text-[11px] ${cpfTouched && cpfErro ? "text-rose-700" : cpfCompleto && !cpfErro ? "text-emerald-700" : "text-slate-500"}`}
                >
                  {cpfTouched && cpfErro
                    ? cpfErro
                    : cpfCompleto && !cpfErro
                      ? "CPF válido."
                      : "Digite só os números; a máscara é automática."}
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Ao registrar o aceite, o sistema gera uma assinatura digital com evidência criptográfica (SHA-256) e auditoria imutável conforme o Art. 8º § 2º da LGPD.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                onClick={() => setModalOpen(false)}
                variant="outline" size="md"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                variant="primary" size="md"
              >
                {saving ? "Registrando Prova..." : "Confirmar e Registrar Aceite"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </CartaoProtecao>
  );
}
