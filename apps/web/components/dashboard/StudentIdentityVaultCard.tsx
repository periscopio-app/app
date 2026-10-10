"use client";

import { useState } from "react";
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";

interface StudentIdentityVaultCardProps {
  studentId?: string;
  studentCode?: string;
}

export function StudentIdentityVaultCard({ studentId = "", studentCode = "" }: StudentIdentityVaultCardProps) {
  const [revealedData, setRevealedData] = useState<{
    fullName: string;
    document?: string | null;
    contact?: string | null;
  } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [accessReason, setAccessReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Campos para cadastro inicial
  const [newFullName, setNewFullName] = useState("");
  const [newDocument, setNewDocument] = useState("");
  const [newContact, setNewContact] = useState("");
  const [savingNew, setSavingNew] = useState(false);

  const handleReveal = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (accessReason.trim().length < 5) {
      setErrorMsg("A justificativa de acesso deve ter pelo menos 5 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<{
        hasData: boolean;
        fullName?: string;
        document?: string | null;
        contact?: string | null;
        message: string;
      }>(`/api/students/${studentId}/vault/reveal`, { accessReason });

      if (res.hasData && res.fullName) {
        setRevealedData({
          fullName: res.fullName,
          document: res.document,
          contact: res.contact,
        });
        setModalOpen(false);
        setAccessReason("");
      } else {
        setErrorMsg("Nenhum dado civil cadastrado no cofre para este aluno.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Acesso negado: apenas profissionais clínicos autorizados podem acessar o cofre.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNew(true);
    setErrorMsg(null);

    try {
      await api.post(`/api/students/${studentId}/vault`, {
        fullName: newFullName,
        document: newDocument,
        contact: newContact,
      });
      setRegisterModalOpen(false);
      setRevealedData({
        fullName: newFullName,
        document: newDocument || null,
        contact: newContact || null,
      });
      setNewFullName("");
      setNewDocument("");
      setNewContact("");
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro ao salvar no cofre de identidade.");
    } finally {
      setSavingNew(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-slate-100 text-slate-700 rounded-xl border border-slate-200">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-black flex items-center gap-2">
              Cofre de Identidade do Aluno (LGPD)
              <span className="text-[11px] font-semibold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                AES-256 Cifrado
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Isolamento estrito: o sistema opera 100% sobre o código pseudonimizado <strong className="font-mono text-black">{studentCode}</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {revealedData ? (
            <button
              onClick={() => setRevealedData(null)}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition flex items-center gap-1.5"
            >
              <EyeOff className="w-3.5 h-3.5" /> Ocultar Dados
            </button>
          ) : (
            <>
              <button
                onClick={() => setRegisterModalOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition"
              >
                Cadastrar no Cofre
              </button>
              <button
                onClick={() => setModalOpen(true)}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100 transition flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" /> Acessar Identidade
              </button>
            </>
          )}
        </div>
      </div>

      {/* Exibição dos Dados Revelados */}
      {revealedData ? (
        <div className="bg-purple-50/50 border border-purple-200 rounded-xl p-4 text-xs space-y-2 animate-fadeIn">
          <div className="flex items-center gap-2 text-purple-900 font-bold mb-1">
            <ShieldCheck className="w-4 h-4 text-purple-700" />
            Dados Pessoais Revelados sob Auditoria Clínica:
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div>
              <span className="text-slate-500 text-[11px] uppercase font-bold">Nome Completo Civil</span>
              <p className="font-semibold text-black text-sm">{revealedData.fullName}</p>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] uppercase font-bold">Documento / Certidão</span>
              <p className="font-semibold text-black text-sm">{revealedData.document || "Não cadastrado"}</p>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] uppercase font-bold">Contato Responsável</span>
              <p className="font-semibold text-black text-sm">{revealedData.contact || "Não cadastrado"}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 border border-slate-200/60 flex items-center gap-2">
          <Lock className="w-4 h-4 text-slate-400 shrink-0" />
          <span>Nome civil e documentos estão protegidos no cofre criptografado. Para visualizar, informe uma justificativa assistencial formal.</span>
        </div>
      )}

      {/* Modal de Revelação Auditada */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Acesso ao Cofre de Identidade do Aluno">
        <form onSubmit={handleReveal} className="space-y-4 text-left">
          <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong>Atenção às diretrizes da LGPD:</strong> O acesso ao nome completo e documentos da criança é estritamente restrito a profissionais clínicos com ato assistencial em andamento e é registrado de forma <strong>permanente e auditável</strong> na trilha de segurança.
            </div>
          </div>

          {errorMsg && (
            <div className="text-xs text-rose-800 bg-rose-50 p-3 rounded-xl border border-rose-200">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-black mb-1">
              Justificativa Clínica do Acesso * (mínimo 5 caracteres)
            </label>
            <input
              type="text"
              required
              value={accessReason}
              onChange={(e) => setAccessReason(e.target.value)}
              placeholder="Ex.: Emissão de encaminhamento médico para CAPS ou contato com responsável"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-black"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-bold rounded-xl bg-[#682880] text-white hover:bg-[#531e66] disabled:opacity-50"
            >
              {loading ? "Auditando e Descriptografando..." : "Autorizar e Revelar"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de Cadastro no Cofre */}
      <Modal open={registerModalOpen} onClose={() => setRegisterModalOpen(false)} title="Cadastrar Identidade Civil no Cofre">
        <form onSubmit={handleSaveVault} className="space-y-4 text-left">
          <p className="text-xs text-slate-600">
            Os dados serão cifrados com chave AES-256 e ficarão desacoplados dos relatórios e do BI populacional.
          </p>

          {errorMsg && (
            <div className="text-xs text-rose-800 bg-rose-50 p-3 rounded-xl border border-rose-200">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-black mb-1">Nome Completo do Aluno *</label>
            <input
              type="text"
              required
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
              placeholder="Ex.: Lucas Gabriel da Silva"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-black"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-black mb-1">Documento / Certidão de Nascimento</label>
              <input
                type="text"
                value={newDocument}
                onChange={(e) => setNewDocument(e.target.value)}
                placeholder="Ex.: 12345678-9"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-black"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-black mb-1">Telefone / Contato do Responsável</label>
              <input
                type="text"
                value={newContact}
                onChange={(e) => setNewContact(e.target.value)}
                placeholder="(11) 98765-4321"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-black"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setRegisterModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingNew}
              className="px-4 py-2 text-sm font-bold rounded-xl bg-[#682880] text-white hover:bg-[#531e66] disabled:opacity-50"
            >
              {savingNew ? "Cifrando no Cofre..." : "Salvar no Cofre Cifrado"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
