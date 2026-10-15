"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, HelpCircle, Bug, CheckCircle2, Clock, AlertTriangle, RefreshCw, Send, ShieldAlert, Monitor, Globe, Mail, User } from "lucide-react";
import { api } from "@/lib/api";

interface SupportTicket {
  id: string;
  userName: string | null;
  userEmail: string;
  userRole: string | null;
  category: string;
  title: string;
  description: string;
  pageUrl: string | null;
  browserInfo: string | null;
  errorDetails: string | null;
  status: string;
  priority: string;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export default function AdminSuportePage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [metrics, setMetrics] = useState({ total: 0, openCount: 0, errorCount: 0 });
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  // Response form
  const [responseNotes, setResponseNotes] = useState("");
  const [updating, setUpdating] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (categoryFilter !== "all") q.set("category", categoryFilter);
      if (statusFilter !== "all") q.set("status", statusFilter);

      const res = await api.get<{
        tickets: SupportTicket[];
        metrics: { total: number; openCount: number; errorCount: number };
      }>(`/api/admin/support/tickets?${q.toString()}`);

      setTickets(res.tickets || []);
      setMetrics(res.metrics || { total: 0, openCount: 0, errorCount: 0 });
    } catch {
      // erro silencioso
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, statusFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleUpdateStatus = async (ticketId: string, newStatus: string) => {
    setUpdating(true);
    setFeedbackMsg(null);
    try {
      await api.patch(`/api/admin/support/tickets/${ticketId}`, {
        status: newStatus,
        resolutionNotes: responseNotes || undefined,
      });

      setFeedbackMsg(`Chamado atualizado para '${newStatus}' com sucesso! Notificação enviada ao usuário.`);
      fetchTickets();
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket((prev) => prev ? { ...prev, status: newStatus, resolutionNotes: responseNotes || prev.resolutionNotes } : null);
      }
    } catch (err: any) {
      setFeedbackMsg(err?.message || "Erro ao atualizar status do chamado.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F9FB] text-black">
      {/* Header */}
      <header className="bg-white border-b border-[#E1E9ED] py-4 px-6 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/users" className="text-slate-600 hover:text-black">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-black flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-sky-600" />
                Painel de Suporte Técnico & Diagnóstico de Erros
              </h1>
              <p className="text-xs text-slate-500">
                Atendimento a dúvidas pedagógicas e monitoramento de falhas reportadas no sistema
              </p>
            </div>
          </div>
          <button
            onClick={fetchTickets}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 space-y-6">
        {feedbackMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
            <span>{feedbackMsg}</span>
            <button onClick={() => setFeedbackMsg(null)} className="font-bold underline text-emerald-700">Fechar</button>
          </div>
        )}

        {/* Métricas do Suporte */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total de Chamados</span>
            <div className="text-2xl font-black text-black mt-1">{metrics.total}</div>
            <p className="text-[11px] text-slate-500 mt-1">Histórico completo de interações de suporte</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Chamados Abertos
            </span>
            <div className="text-2xl font-black text-amber-600 mt-1">{metrics.openCount}</div>
            <p className="text-[11px] text-slate-500 mt-1">Aguardando atendimento ou resposta técnica</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
              <Bug className="w-3.5 h-3.5" /> Falhas Técnicas Reportadas
            </span>
            <div className="text-2xl font-black text-rose-600 mt-1">{metrics.errorCount}</div>
            <p className="text-[11px] text-slate-500 mt-1">Erros de tela ou exceções enviadas pelos usuários</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 mr-2">Filtrar por Categoria:</span>
            {["all", "duvida", "erro_sistema", "urgente"].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition ${
                  categoryFilter === cat
                    ? "bg-sky-50 text-sky-800 border-sky-300 font-bold"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {cat === "all" ? "Todas" : cat === "duvida" ? "Dúvidas" : cat === "erro_sistema" ? "Erros do Sistema" : "Urgentes"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 mr-2">Status:</span>
            {["all", "aberto", "em_atendimento", "resolvido"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition ${
                  statusFilter === st
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {st === "all" ? "Todos" : st === "aberto" ? "Abertos" : st === "em_atendimento" ? "Em Atendimento" : "Resolvidos"}
              </button>
            ))}
          </div>
        </div>

        {/* Lista e Detalhe */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna da Esquerda: Lista de Chamados */}
          <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[650px]">
            <div className="p-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-700">
              Chamados Encontrados ({tickets.length})
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {loading ? (
                <div className="p-8 text-center text-xs text-slate-500">Carregando chamados...</div>
              ) : tickets.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">Nenhum chamado encontrado com estes filtros.</div>
              ) : (
                tickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTicket(t);
                      setResponseNotes(t.resolutionNotes || "");
                    }}
                    className={`w-full text-left p-3.5 hover:bg-slate-50 transition block ${
                      selectedTicket?.id === t.id ? "bg-sky-50/70 border-l-4 border-sky-600" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        t.category === "erro_sistema"
                          ? "bg-rose-50 text-rose-800 border border-rose-200"
                          : t.category === "urgente"
                          ? "bg-amber-50 text-amber-800 border border-amber-200"
                          : "bg-sky-50 text-sky-800 border border-sky-200"
                      }`}>
                        {t.category === "erro_sistema" ? "Falha Técnica" : t.category === "duvida" ? "Dúvida" : t.category}
                      </span>
                      <span className={`text-[10px] font-bold ${
                        t.status === "aberto"
                          ? "text-amber-600 font-bold"
                          : t.status === "resolvido"
                          ? "text-emerald-600"
                          : "text-blue-600"
                      }`}>
                        {t.status.toUpperCase()}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-black line-clamp-1">{t.title}</h4>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{t.description}</p>
                    <div className="flex items-center justify-between mt-2 pt-1 text-[10px] text-slate-400 border-t border-slate-50">
                      <span>{t.userName || t.userEmail}</span>
                      <span>{new Date(t.createdAt).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Coluna da Direita: Detalhe do Chamado e Diagnóstico */}
          <div className="lg:col-span-2">
            {!selectedTicket ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-16 text-center h-[650px] flex flex-col items-center justify-center">
                <HelpCircle className="w-12 h-12 text-slate-300 mb-3" />
                <h3 className="text-sm font-bold text-slate-800">Selecione um chamado ao lado</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Clique em um chamado da lista para inspecionar os detalhes técnicos, a URL de ocorrência e enviar uma resposta ao usuário.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5 h-[650px] flex flex-col overflow-y-auto">
                <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        selectedTicket.category === "erro_sistema"
                          ? "bg-rose-100 text-rose-900 border border-rose-300"
                          : "bg-sky-100 text-sky-900 border border-sky-300"
                      }`}>
                        {selectedTicket.category === "erro_sistema" ? "Erro / Falha do Sistema" : "Dúvida do Usuário"}
                      </span>
                      <span className="text-xs text-slate-500">Prioridade: <strong>{selectedTicket.priority}</strong></span>
                    </div>
                    <h2 className="text-base font-bold text-black">{selectedTicket.title}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Aberto em {new Date(selectedTicket.createdAt).toLocaleString("pt-BR")} · Protocolo: <code className="font-mono text-[11px] text-slate-700">{selectedTicket.id}</code>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateStatus(selectedTicket.id, "em_atendimento")}
                      disabled={updating || selectedTicket.status === "em_atendimento"}
                      className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition disabled:opacity-50"
                    >
                      Em Atendimento
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedTicket.id, "resolvido")}
                      disabled={updating || selectedTicket.status === "resolvido"}
                      className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Marcar como Resolvido
                    </button>
                  </div>
                </div>

                {/* Dados do Solicitante */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-bold">Solicitante</span>
                      <strong>{selectedTicket.userName || "Não informado"}</strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-bold">E-mail de Retorno</span>
                      <a href={`mailto:${selectedTicket.userEmail}`} className="text-sky-600 hover:underline">{selectedTicket.userEmail}</a>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-bold">Perfil no Sistema</span>
                      <span className="capitalize">{selectedTicket.userRole || "Outro"}</span>
                    </div>
                  </div>
                </div>

                {/* Descrição do Chamado */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Descrição Informada</h4>
                  <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {selectedTicket.description}
                  </div>
                </div>

                {/* Telemetria e Diagnóstico de Erro (Tema Claro) */}
                {(selectedTicket.pageUrl || selectedTicket.errorDetails || selectedTicket.browserInfo) && (
                  <div className="p-4 bg-slate-50/80 border border-slate-200 text-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-sky-800">
                      <Monitor className="w-4 h-4 text-sky-600" /> Diagnóstico Técnico & Telemetria do Incidente
                    </div>
                    {selectedTicket.pageUrl && (
                      <div className="text-xs">
                        <span className="text-slate-500 block text-[10px] uppercase font-bold mb-0.5">Página de Ocorrência:</span>
                        <a href={selectedTicket.pageUrl} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline font-mono text-[11px] break-all bg-white px-2.5 py-1 rounded-lg border border-slate-200 inline-block">
                          {selectedTicket.pageUrl}
                        </a>
                      </div>
                    )}
                    {selectedTicket.errorDetails && (
                      <div className="text-xs">
                        <span className="text-slate-500 block text-[10px] uppercase font-bold mb-0.5">Mensagem de Erro / Stack:</span>
                        <pre className="bg-rose-50/70 p-3 rounded-lg text-rose-900 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap border border-rose-200 leading-relaxed">
                          {selectedTicket.errorDetails}
                        </pre>
                      </div>
                    )}
                    {selectedTicket.browserInfo && (
                      <div className="text-[11px] text-slate-600 font-mono bg-white p-2 rounded-lg border border-slate-200">
                        <strong className="text-slate-700">User-Agent:</strong> {selectedTicket.browserInfo}
                      </div>
                    )}
                  </div>
                )}

                {/* Resposta e Resolução */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Parecer Técnico / Resposta ao Usuário (enviado por e-mail automaticamente):
                  </label>
                  <textarea
                    rows={3}
                    value={responseNotes}
                    onChange={(e) => setResponseNotes(e.target.value)}
                    placeholder="Escreva a resposta de suporte ou as instruções para o usuário..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-black focus:outline-none focus:border-sky-500"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleUpdateStatus(selectedTicket.id, selectedTicket.status)}
                      disabled={updating || !responseNotes.trim()}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" /> {updating ? "Enviando..." : "Salvar & Notificar Usuário"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
