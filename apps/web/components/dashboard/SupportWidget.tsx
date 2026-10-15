"use client";

import { useState, useEffect } from "react";
import { HelpCircle, X, Bug, MessageSquare, ChevronDown, ChevronUp, Send, CheckCircle2, AlertTriangle, Sparkles, ArrowRight, ThumbsUp, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";

interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

interface RagResponse {
  success: boolean;
  question: string;
  answer: string;
  confidence: number;
  canOpenTicket: boolean;
  suggestions?: string[];
  source?: string;
}

export function SupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"rag" | "duvida" | "erro" | "faq">("rag");

  // RAG / Assistente state
  const [ragQuestion, setRagQuestion] = useState("");
  const [ragLoading, setRagLoading] = useState(false);
  const [ragResult, setRagResult] = useState<RagResponse | null>(null);
  const [ragResolved, setRagResolved] = useState(false);

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

  // Escutar evento global de abertura (ex: botão Suporte do topo/menu)
  useEffect(() => {
    const handleOpen = (e: any) => {
      setIsOpen(true);
      if (e?.detail?.tab) {
        setActiveTab(e.detail.tab);
      }
    };
    window.addEventListener("open-support-widget", handleOpen);
    return () => window.removeEventListener("open-support-widget", handleOpen);
  }, []);

  useEffect(() => {
    if (isOpen && faqList.length === 0) {
      api
        .get<{ faq: FAQItem[] }>("/api/support/faq")
        .then((res) => setFaqList(res.faq || []))
        .catch(() => {});
    }
  }, [isOpen, faqList.length]);

  const handleAskRag = async (q?: string) => {
    const query = (q || ragQuestion).trim();
    if (query.length < 3) return;

    setRagLoading(true);
    setRagResult(null);
    setRagResolved(false);
    setErrorMessage(null);

    try {
      const res = await api.post<RagResponse>("/api/support/ask-rag", {
        question: query,
      });
      setRagResult(res);
      setRagQuestion(query);
    } catch (err: any) {
      setErrorMessage(err?.message || "Erro ao consultar o assistente de suporte.");
    } finally {
      setRagLoading(false);
    }
  };

  const handleForwardToTicket = () => {
    setTitle(ragResult?.question || ragQuestion);
    setDescription(
      `Dúvida consultada com o Assistente RAG:\n"${ragResult?.question || ragQuestion}"\n\nResposta do Assistente:\n${ragResult?.answer || ""}\n\nObservação adicional do usuário:\nPreciso de suporte da equipe para esclarecer melhor este caso.`
    );
    setActiveTab("duvida");
  };

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
            <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold overflow-x-auto">
              <button
                onClick={() => { setActiveTab("rag"); setFeedbackSuccess(null); }}
                className={`flex-1 py-3 px-2 text-center border-b-2 transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === "rag"
                    ? "border-purple-600 text-purple-700 bg-white"
                    : "border-transparent text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>Assistente RAG</span>
              </button>
              <button
                onClick={() => { setActiveTab("duvida"); setFeedbackSuccess(null); }}
                className={`flex-1 py-3 px-2 text-center border-b-2 transition whitespace-nowrap ${
                  activeTab === "duvida"
                    ? "border-sky-600 text-sky-700 bg-white"
                    : "border-transparent text-slate-600 hover:bg-slate-100"
                }`}
              >
                Abrir Chamado
              </button>
              <button
                onClick={() => { setActiveTab("erro"); setFeedbackSuccess(null); }}
                className={`flex-1 py-3 px-2 text-center border-b-2 transition whitespace-nowrap ${
                  activeTab === "erro"
                    ? "border-rose-600 text-rose-700 bg-white"
                    : "border-transparent text-slate-600 hover:bg-slate-100"
                }`}
              >
                Relatar Erro
              </button>
              <button
                onClick={() => { setActiveTab("faq"); setFeedbackSuccess(null); }}
                className={`flex-1 py-3 px-2 text-center border-b-2 transition whitespace-nowrap ${
                  activeTab === "faq"
                    ? "border-sky-600 text-sky-700 bg-white"
                    : "border-transparent text-slate-600 hover:bg-slate-100"
                }`}
              >
                FAQ
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

              {/* Aba 1: Assistente RAG (Autoatendimento imediato) */}
              {activeTab === "rag" && (
                <div className="space-y-4">
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Assistente Periscópio RAG</strong>
                      <span className="text-purple-800 text-[11px] leading-relaxed">
                        Faça sua pergunta sobre o protocolo clínico, FOGAP, escalas ou uso da plataforma. O assistente responde instantaneamente antes de abrir um chamado.
                      </span>
                    </div>
                  </div>

                  {/* Input de Pergunta */}
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={ragQuestion}
                        onChange={(e) => setRagQuestion(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleAskRag();
                          }
                        }}
                        placeholder="Ex: Como funciona o envio do FOGAP pelo RE?"
                        className="w-full pl-3 pr-20 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-black placeholder:text-slate-400 focus:outline-none focus:border-purple-500 shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => void handleAskRag()}
                        disabled={ragLoading || ragQuestion.trim().length < 3}
                        className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition flex items-center gap-1 disabled:opacity-40"
                      >
                        {ragLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        <span>Perguntar</span>
                      </button>
                    </div>

                    {/* Dúvidas Frequentes Rápidas */}
                    {!ragResult && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Dúvidas Frequentes:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            "Como funciona o envio do FOGAP?",
                            "Quem acessa o Cofre de Identidade?",
                            "Como agendar reunião com o Board?",
                            "Por que o parecer exige 100 caracteres?",
                            "Como recuperar minha senha?",
                          ].map((sug, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => void handleAskRag(sug)}
                              className="text-[11px] text-left px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-700 border border-slate-200 transition"
                            >
                              {sug}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Resposta do RAG */}
                  {ragResult && (
                    <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-3 animate-fadeIn">
                      <div className="flex items-center justify-between text-[11px] border-b border-slate-200 pb-2">
                        <span className="font-bold text-slate-700 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Resposta da IA / RAG:
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-semibold">
                          Protocolo Oficial
                        </span>
                      </div>

                      <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                        {ragResult.answer}
                      </div>

                      {/* Feedback e Transição para Ticket */}
                      {!ragResolved ? (
                        <div className="pt-3 border-t border-slate-200 space-y-2.5">
                          <p className="text-[11px] font-semibold text-slate-600">Essa resposta resolveu sua dúvida?</p>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <button
                              type="button"
                              onClick={() => setRagResolved(true)}
                              className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                            >
                              <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Sim, foi resolvido!</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleForwardToTicket}
                              className="flex-1 py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-sm"
                            >
                              <span>Ainda preciso de ajuda</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Ficamos felizes em ajudar! Se precisar de algo mais, digite acima ou volte sempre.</span>
                        </div>
                      )}
                    </div>
                  )}
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
