"use client";

import { useState, useEffect, useCallback } from "react";
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, CheckCircle, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Badge, Button } from "@/components/ui";
import { CartaoProtecao } from "./CartaoProtecao";

interface StudentIdentityVaultCardProps {
  studentId?: string;
  studentCode?: string;
  /** Incrementa para abrir o pedido de acesso ao nome (usado pelo botão "Ver nome" do cabeçalho do aluno). */
  abrirSinal?: number;
}

export function StudentIdentityVaultCard({ studentId = "", studentCode = "", abrirSinal = 0 }: StudentIdentityVaultCardProps) {
  const [revealedData, setRevealedData] = useState<{
    fullName: string;
    document?: string | null;
    contact?: string | null;
  } | null>(null);

  const [vaultStatus, setVaultStatus] = useState<{
    hasData: boolean;
    hasDocument: boolean;
    hasContact: boolean;
    updatedAt: string | null;
  } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [accessReason, setAccessReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!studentId) return;
    try {
      const res = await api.get<{
        hasData: boolean;
        hasDocument: boolean;
        hasContact: boolean;
        updatedAt: string | null;
      }>(`/api/students/${studentId}/vault/status`);
      setVaultStatus(res);
    } catch {
      // silencioso se não autenticado
    }
  }, [studentId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (abrirSinal > 0) {
      setErrorMsg(null);
      setModalOpen(true);
    }
  }, [abrirSinal]);

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
      fetchStatus();
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro ao salvar no cofre de identidade.");
    } finally {
      setSavingNew(false);
    }
  };

  const selos = (
    <>
      <Badge variant="default" className="whitespace-nowrap text-[11px]">AES-256 cifrado</Badge>
      {vaultStatus &&
        (vaultStatus.hasData ? (
          <Badge variant="success" className="whitespace-nowrap text-[11px]"><CheckCircle className="h-3 w-3" aria-hidden /> Custodiado</Badge>
        ) : (
          <Badge variant="warning" className="whitespace-nowrap text-[11px]"><AlertCircle className="h-3 w-3" aria-hidden /> Pendente de cadastro</Badge>
        ))}
    </>
  );

  return (
    <CartaoProtecao
      id="cofre-identidade"
      icone={<Lock className="h-5 w-5" />}
      titulo="Cofre de Identidade do Aluno (LGPD)"
      selos={selos}
      descricao={
        <>
          Isolamento estrito: o sistema opera 100% sobre o código pseudonimizado <strong className="whitespace-nowrap font-mono text-black">{studentCode}</strong>.
        </>
      }
      acoes={
        revealedData ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setRevealedData(null)}>
            <EyeOff className="h-3.5 w-3.5" aria-hidden /> Ocultar dados
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => setRegisterModalOpen(true)}>
              Cadastrar no cofre
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(true)}>
              <Eye className="h-3.5 w-3.5" aria-hidden /> Acessar identidade
            </Button>
          </>
        )
      }
    >
      {/* Exibição dos Dados Revelados */}
      {revealedData ? (
        <div className="animate-fadeIn space-y-2 rounded-xl border border-roxo-200 bg-roxo-50/60 p-3 text-xs sm:p-4">
          <div className="flex items-center gap-2 font-bold text-roxo-800">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
            Dados pessoais revelados sob auditoria clínica
          </div>
          <div className="grid grid-cols-1 items-stretch gap-2 pt-1">
            {(
              [
                ["Nome completo civil", revealedData.fullName],
                ["Documento / certidão", revealedData.document || "Não cadastrado"],
                ["Contato do responsável", revealedData.contact || "Não cadastrado"],
              ] as const
            ).map(([rotulo, valor]) => (
              <div key={rotulo} className="flex min-h-[72px] flex-col rounded-xl border border-roxo-200 bg-white p-3" data-testid="cofre-caixa">
                <span className="text-[11px] font-bold uppercase text-neutral-700">{rotulo}</span>
                <p className="mt-1 break-words text-sm font-semibold text-black">{valor}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="flex items-start gap-2 rounded-xl border border-linha bg-fundo p-3 text-xs leading-relaxed text-neutral-700">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-600" aria-hidden />
          <span>Nome civil e documentos estão protegidos no cofre criptografado. Para visualizar, informe uma justificativa assistencial formal.</span>
        </p>
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
    </CartaoProtecao>
  );
}
