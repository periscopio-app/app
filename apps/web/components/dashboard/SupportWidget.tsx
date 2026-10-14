"use client";

import { useState, useEffect } from "react";
import { HelpCircle, X, Bug, MessageSquare, ChevronDown, ChevronUp, Send, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";

interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export function SupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"faq" | "duvida" | "erro">("faq");

  // FAQ state
  const [faqList, setFaqList] = useState<FAQItem[]>([]);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [errorDetails, setErrorDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && faqList.length === 0) {
      api
        .get<{ faq: FAQItem[] }>("/api/support/faq")
        .then((res) => setFaqList(res.faq || []))
        .catch(() => {});
    }
  }, [isOpen, faqList.length]);

  const handleSubmit = async (e: React.FormEvent, category: "duvida" | "erro_sistema") => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    setFeedbackSuccess(null);

    try {
      const pageUrl = typeof window !== "undefined" ? window.location.href : "";
      const browserInfo = typeof navigator !== "undefined" ? navigator.userAgent : "";

      const res = await api.post<{ success: boolean; ticketId: string; message: string }>("/api/support/tickets", {
        title,
        description,
        category,
        pageUrl,
        browserInfo,
        errorDetails: category === "erro_sistema" ? errorDetails : undefined,
        userEmail: userEmail || undefined,
      });

      setFeedbackSuccess(res.message || "Chamado registrado com sucesso!");
      setTitle("");
      setDescription("");
      setErrorDetails("");
    } catch (err: any) {
      setErrorMessage(err?.message || "Erro ao registrar chamado.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Botão Flutuante */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 text-white font-semibold text-xs shadow-2xl hover:bg-slate-800 transition transform hover:scale-105 active:scale-95 border border-slate-700/50"
      >
        <HelpCircle className="w-4 h-4 text-sky-400" />
        <span>Suporte & Dúvidas</span>
      </button>

      {/* Modal / Painel Lateral */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-end p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full sm:max-w-md h-[90vh] sm:h-[82vh] rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-sky-500/20 text-sky-400 rounded-lg">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Central de Ajuda & Suporte</h3>
                  <p className="text-[11px] text-slate-400">Tire dúvidas e relate problemas no sistema</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setFeedbackSuccess(null);
                  setErrorMessage(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Abas */}
            <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold">
              <button
                onClick={() => { setActiveTab("faq"); setFeedbackSuccess(null); }}
                className={`flex-1 py-3 text-center border-b-2 transition ${
                  activeTab === "faq"
                    ? "border-sky-600 text-sky-700 bg-white"
                    : "border-transparent text-slate-600 hover:bg-slate-100"
                }`}
              >
                Dúvidas (FAQ)
              </button>
              <button
                onClick={() => { setActiveTab("duvida"); setFeedbackSuccess(null); }}
                className={`flex-1 py-3 text-center border-b-2 transition ${
                  activeTab === "duvida"
                    ? "border-sky-600 text-sky-700 bg-white"
                    : "border-transparent text-slate-600 hover:bg-slate-100"
                }`}
              >
                Tirar Dúvida
              </button>
              <button
                onClick={() => { setActiveTab("erro"); setFeedbackSuccess(null); }}
                className={`flex-1 py-3 text-center border-b-2 transition ${
                  activeTab === "erro"
                    ? "border-rose-600 text-rose-700 bg-white"
                    : "border-transparent text-slate-600 hover:bg-slate-100"
                }`}
              >
                Relatar Erro
              </button>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {feedbackSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{feedbackSuccess}</span>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Aba FAQ */}
              {activeTab === "faq" && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    Respostas rápidas para as principais dúvidas sobre fluxos clínicos e governança:
                  </p>
                  {faqList.map((item) => (
                    <div key={item.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                      <button
                        onClick={() => setExpandedFaq(expandedFaq === item.id ? null : item.id)}
                        className="w-full text-left p-3 flex items-center justify-between text-xs font-semibold text-slate-900 hover:bg-slate-50"
                      >
                        <span>{item.question}</span>
                        {expandedFaq === item.id ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                      {expandedFaq === item.id && (
                        <div className="p-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-700 leading-relaxed">
                          {item.answer}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Aba Tirar Dúvida */}
              {activeTab === "duvida" && (
                <form onSubmit={(e) => handleSubmit(e, "duvida")} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Qual é a sua dúvida?</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Como preencher a escala ATA de triagem?"
                      required
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-black focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Detalhes da dúvida</label>
                    <textarea
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Explique o que você precisa entender ou realizar no sistema..."
                      required
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-black focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Seu e-mail para resposta (opcional)</label>
                    <input
                      type="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="seu.email@escola.sp.gov.br"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-black focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {submitting ? "Enviando..." : "Enviar Dúvida"}
                  </button>
                </form>
              )}

              {/* Aba Relatar Erro do Sistema */}
              {activeTab === "erro" && (
                <form onSubmit={(e) => handleSubmit(e, "erro_sistema")} className="space-y-3">
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 flex items-center gap-2">
                    <Bug className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Os dados técnicos da página atual serão anexados automaticamente para ajudar na resolução rápida.</span>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">O que deu errado?</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Botão de salvar não responde na etapa de parecer"
                      required
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-black focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Como reproduzir ou o que você estava fazendo?</label>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Descreva o passo a passo até o erro acontecer..."
                      required
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-black focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mensagem de erro exibida na tela (se houver)</label>
                    <textarea
                      rows={2}
                      value={errorDetails}
                      onChange={(e) => setErrorDetails(e.target.value)}
                      placeholder="Cole aqui a mensagem de erro ou código retornado..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono text-black focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Seu e-mail de contato</label>
                    <input
                      type="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="seu.email@escola.sp.gov.br"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-black focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
                  >
                    <Bug className="w-3.5 h-3.5" />
                    {submitting ? "Registrando Incidente..." : "Reportar Erro Técnico"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
