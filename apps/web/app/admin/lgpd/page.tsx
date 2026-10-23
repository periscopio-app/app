"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Clock, CheckCircle2, XCircle, AlertTriangle, RefreshCw, FileText, Database, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui";

interface LGPDRequestItem {
  id: string;
  requesterEmail: string;
  kind: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  daysElapsed: number;
  daysRemaining: number;
  isOverdue: boolean;
}

interface RetentionPolicy {
  category: string;
  tables: string[];
  retentionPeriodYears?: number;
  retentionPeriodDays?: number;
  legalBasis: string;
  disposalMethod: string;
  controllerResponsibility: string;
}

interface VaultAuditItem {
  id: string;
  userEmail: string;
  action: string;
  entityId: string;
  ipAddress: string | null;
  userAgent: string | null;
  payload?: {
    studentCode?: string;
    accessReason?: string;
  } | null;
  createdAt: string;
}

export default function AdminLGPDPage() {
  const [requests, setRequests] = useState<LGPDRequestItem[]>([]);
  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [vaultLogs, setVaultLogs] = useState<VaultAuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"requests" | "retention" | "vault">("requests");
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reqData, retData, vaultData] = await Promise.all([
        api.get<{ requests: LGPDRequestItem[] }>("/api/lgpd/requests").catch(() => ({ requests: [] })),
        api.get<{ policies: RetentionPolicy[] }>("/api/lgpd/retention/policies").catch(() => ({ policies: [] })),
        api.get<{ logs: VaultAuditItem[] }>("/api/admin/vault/audit-logs").catch(() => ({ logs: [] })),
      ]);
      setRequests(reqData.requests || []);
      setPolicies(retData.policies || []);
      setVaultLogs(vaultData.logs || []);
    } catch {
      // erro tratado silenciosamente
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleResolve = async (id: string, newStatus: "resolved" | "rejected") => {
    try {
      await api.patch(`/api/lgpd/requests/${id}`, {
        status: newStatus,
        notes: `Atendimento formalizado pelo Encarregado em ${new Date().toLocaleDateString("pt-BR")}.`,
      });
      setActionMsg(`Solicitação marcada como ${newStatus === "resolved" ? "atendida" : "rejeitada"}.`);
      fetchData();
    } catch (e: any) {
      setActionMsg(e?.message || "Erro ao atualizar solicitação.");
    }
  };

  const handleDryRun = async () => {
    try {
      const res = await api.post<{ message: string }>("/api/lgpd/retention/dry-run", {});
      setActionMsg(res.message);
    } catch (e: any) {
      setActionMsg(e?.message || "Erro ao executar ciclo de varredura.");
    }
  };

  const KIND_LABELS: Record<string, string> = {
    access: "Acesso e Confirmação (Art. 18, I e II)",
    correction: "Correção de Dados (Art. 18, III)",
    deletion: "Eliminação / Anonimização (Art. 18, IV e VI)",
    portability: "Portabilidade de Dados (Art. 18, V)",
    revocation: "Revogação de Consentimento (Art. 18, IX)",
    information: "Informação de Compartilhamento (Art. 18, VII)",
  };

  return (
    <div className="min-h-screen bg-[#F6F9FB] text-black">
      {/* Top Bar */}
      <header className="bg-white border-b border-[#E1E9ED] py-4 px-6 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/users" className="text-slate-600 hover:text-black">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-black flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-700" />
                Painel do Encarregado (DPO) & Governança LGPD
              </h1>
              <p className="text-xs text-slate-500">Gestão de Pedidos de Titulares (Art. 18) e Matriz de Retenção Legal</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("requests")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition ${
                activeTab === "requests"
                  ? "bg-purple-100 text-purple-900 border-purple-300"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Pedidos de Titulares ({requests.length})
            </button>
            <button
              onClick={() => setActiveTab("retention")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition ${
                activeTab === "retention"
                  ? "bg-purple-100 text-purple-900 border-purple-300"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Matriz de Retenção & Expurgo
            </button>
            <button
              onClick={() => setActiveTab("vault")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition ${
                activeTab === "vault"
                  ? "bg-purple-100 text-purple-900 border-purple-300"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Cofre de Identidade & Auditoria ({vaultLogs.length})
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto py-8 px-4">
        {actionMsg && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm p-4 rounded-xl flex items-center justify-between">
            <span>{actionMsg}</span>
            <button onClick={() => setActionMsg(null)} className="text-emerald-700 font-bold hover:underline">
              Fechar
            </button>
          </div>
        )}

        {activeTab === "requests" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-black">Solicitações Recebidas dos Titulares</h2>
                <p className="text-xs text-slate-500">
                  Prazo legal de resposta de até 15 dias úteis (Art. 19, II da Lei 13.709/2018).
                </p>
              </div>
              <Button
                onClick={fetchData}
                variant="outline" size="sm"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Atualizar
              </Button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500">Carregando solicitações...</div>
            ) : requests.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="font-semibold text-black">Nenhuma solicitação pendente</p>
                <p className="text-xs text-slate-500">Todas as requisições de titulares estão respondidas ou em dia.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Protocolo / Data</th>
                        <th className="py-3 px-4">Titular (E-mail)</th>
                        <th className="py-3 px-4">Direito Requerido (Art. 18)</th>
                        <th className="py-3 px-4">SLA Legal (15 dias)</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Ação DPO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {requests.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 font-mono text-xs">
                            <span className="font-bold text-black select-all">{req.id.slice(0, 8)}...</span>
                            <div className="text-[11px] text-slate-500 font-sans">
                              {new Date(req.createdAt).toLocaleDateString("pt-BR")}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-medium text-black">
                            {req.requesterEmail}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-700">
                            {KIND_LABELS[req.kind] || req.kind}
                          </td>
                          <td className="py-3 px-4">
                            {req.status === "pending" ? (
                              req.isOverdue ? (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                                  <AlertTriangle className="w-3.5 h-3.5" /> Prazo Vencido ({req.daysElapsed}d)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                  <Clock className="w-3.5 h-3.5" /> {req.daysRemaining} dias restantes
                                </span>
                              )
                            ) : (
                              <span className="text-xs text-slate-500">Concluído</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                                req.status === "resolved"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : req.status === "rejected"
                                  ? "bg-rose-50 text-rose-800 border-rose-200"
                                  : "bg-sky-50 text-sky-800 border-sky-200"
                              }`}
                            >
                              {req.status === "resolved" ? "Atendido" : req.status === "rejected" ? "Indeferido" : "Pendente"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {req.status === "pending" && (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleResolve(req.id, "resolved")}
                                  className="p-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition"
                                  title="Marcar como Atendido"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleResolve(req.id, "rejected")}
                                  className="p-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg transition"
                                  title="Indeferir com Justificativa"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "retention" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-black flex items-center gap-2">
                  <Database className="w-5 h-5 text-purple-700" />
                  Matriz de Retenção e Guarda Legal de Dados
                </h2>
                <p className="text-xs text-slate-500">
                  Definição normativa dos prazos legais de guarda e responsabilidades de cada entidade controladora.
                </p>
              </div>

              <Button
                onClick={handleDryRun}
                variant="outline" size="sm"
              >
                <ShieldAlert className="w-4 h-4" /> Simular Varredura Preventiva de Expurgo
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {policies.map((p, idx) => (
                <div key={idx} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold text-black text-sm">{p.category}</h3>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {p.retentionPeriodYears ? `${p.retentionPeriodYears} anos` : `${p.retentionPeriodDays} dias`}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>Base Legal:</strong> {p.legalBasis}
                  </p>

                  <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 space-y-1">
                    <p><strong>Destinação:</strong> {p.disposalMethod}</p>
                    <p><strong>Responsabilidade:</strong> {p.controllerResponsibility}</p>
                    <p><strong>Tabelas Protegidas:</strong> <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded">{p.tables.join(", ")}</code></p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "vault" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-black flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-700" />
                  Governança do Cofre de Identidade do Aluno & Auditoria de Acesso
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Art. 37 da LGPD: registro das operações de revelação civil temporária e prova de conformidade do encarregado.
                </p>
              </div>
              <Button
                onClick={fetchData}
                variant="outline" size="sm"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Atualizar Auditoria
              </Button>
            </div>

            {/* Destaques Técnicos de Governança */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
                <div className="flex items-center gap-2 text-purple-700 font-bold text-xs uppercase tracking-wider">
                  <Database className="w-4 h-4" /> Criptografia AES-256 GCM
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Os dados civis (nome, CPF, contato) ficam cifrados em repouso no banco e completamente desacoplados da camada de BI e relatórios.
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" /> Justificativa Obrigatória
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Todo ato clínico de revelação de identidade exige justificativa formal prévia (mínimo 5 caracteres) registrada de forma imutável.
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
                <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
                  <Clock className="w-4 h-4" /> Trilha Append-Only
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Proteção por gatilho SQL no Postgres: a tabela de auditoria não permite <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">UPDATE</code> nem <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">DELETE</code>.
                </p>
              </div>
            </div>

            {/* Tabela de Auditoria do Cofre */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Histórico de Revelações e Acessos ao Cofre ({vaultLogs.length})
                </h3>
              </div>
              {vaultLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <CheckCircle2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="font-semibold text-black text-sm">Nenhum evento de revelação registrado ainda.</p>
                  <p className="text-xs text-slate-500">Os acessos clínicos ao cofre de identidade serão auditados aqui automaticamente.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Data / Horário</th>
                        <th className="py-3 px-4">Profissional</th>
                        <th className="py-3 px-4">Ação</th>
                        <th className="py-3 px-4">Código do Aluno</th>
                        <th className="py-3 px-4">Justificativa Registrada</th>
                        <th className="py-3 px-4">IP de Origem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {vaultLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-600">
                            {new Date(log.createdAt).toLocaleString("pt-BR")}
                          </td>
                          <td className="py-3 px-4 font-semibold text-black">
                            {log.userEmail || "Sistema"}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              log.action === "student.vault_revealed"
                                ? "bg-purple-100 text-purple-900 border border-purple-200"
                                : "bg-blue-100 text-blue-900 border border-blue-200"
                            }`}>
                              {log.action === "student.vault_revealed" ? "Revelação Clínica" : "Atualização de Cadastro"}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {log.payload?.studentCode || log.entityId.slice(0, 8)}
                          </td>
                          <td className="py-3 px-4 text-slate-800 max-w-xs truncate" title={log.payload?.accessReason || "N/A"}>
                            {log.payload?.accessReason || "Atualização de custódia"}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                            {log.ipAddress || "127.0.0.1"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
