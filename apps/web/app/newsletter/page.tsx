"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Mail, Send, CheckCircle2, AlertCircle, Calendar, Tag, ShieldCheck, Search } from "lucide-react";
import { api } from "@/lib/api";

interface NewsletterIssue {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  category: string;
  publishedAt: string;
}

export default function NewsletterPublicPage() {
  const [issues, setIssues] = useState<NewsletterIssue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<NewsletterIssue | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Inscrição
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("professor");
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeSuccess, setSubscribeSuccess] = useState<string | null>(null);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  // Opt-out LGPD
  const [optOutOpen, setOptOutOpen] = useState(false);
  const [optOutEmail, setOptOutEmail] = useState("");
  const [optOutMsg, setOptOutMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get<{ issues: NewsletterIssue[] }>("/api/newsletter/issues")
      .then((res) => setIssues(res.issues || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubscribing(true);
    setSubscribeError(null);
    setSubscribeSuccess(null);

    try {
      const res = await api.post<{ success: boolean; message: string }>("/api/newsletter/subscribe", {
        email,
        name,
        role,
      });
      setSubscribeSuccess(res.message);
      setEmail("");
      setName("");
    } catch (err: any) {
      setSubscribeError(err?.message || "Erro ao realizar inscrição.");
    } finally {
      setSubscribing(false);
    }
  };

  const handleOptOut = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post<{ success: boolean; message: string }>("/api/newsletter/unsubscribe", {
        email: optOutEmail,
      });
      setOptOutMsg(res.message);
      setOptOutEmail("");
    } catch (err: any) {
      setOptOutMsg(err?.message || "Erro ao processar opt-out.");
    }
  };

  const filteredIssues = issues.filter(
    (i) => selectedCategory === "all" || i.category === selectedCategory
  );

  return (
    <div className="min-h-screen bg-[#F6F9FB] text-black">
      {/* Header */}
      <header className="bg-white border-b border-[#E1E9ED] py-4 px-6 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-600 hover:text-black">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-black flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-sky-600" />
                Boletins Científicos & Diretrizes Pedagógicas
              </h1>
              <p className="text-xs text-slate-500">
                Informativos periódicos de saúde mental infantil, acolhimento escolar e neurodesenvolvimento
              </p>
            </div>
          </div>
          <button
            onClick={() => setOptOutOpen(true)}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            Gerenciar Assinatura (LGPD)
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto py-10 px-4 space-y-10">
        {/* Hero & Inscrição */}
        <div className="bg-gradient-to-br from-slate-900 to-sky-950 text-white rounded-3xl p-8 md:p-12 shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl space-y-4">
            <span className="px-3 py-1 bg-sky-500/20 text-sky-300 rounded-full text-xs font-bold border border-sky-400/30">
              Comunicação Científica Periscópio
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Atualizações clínicas, estudos do Board e práticas pedagógicas inclusivas
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Assine nosso boletim gratuito e receba materiais fundamentados em evidências, orientações de acolhimento na rede municipal e novos recursos da plataforma.
            </p>

            {subscribeSuccess ? (
              <div className="p-4 bg-emerald-950/80 border border-emerald-500 text-emerald-200 rounded-2xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{subscribeSuccess}</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="pt-2 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-xs text-white placeholder-slate-400 focus:outline-none focus:bg-white/20"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Seu e-mail principal"
                    required
                    className="px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-xs text-white placeholder-slate-400 focus:outline-none focus:bg-white/20"
                  />
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-xs text-white focus:outline-none focus:bg-white/20"
                  >
                    <option value="professor" className="text-black">Professor(a)</option>
                    <option value="especialista" className="text-black">Especialista (Fono, Psico, etc.)</option>
                    <option value="medico" className="text-black">Médico(a)</option>
                    <option value="gestor" className="text-black">Gestor(a) Escolar</option>
                    <option value="outro" className="text-black">Outro profissional</option>
                  </select>
                </div>
                {subscribeError && (
                  <p className="text-xs text-rose-300 font-semibold">{subscribeError}</p>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Sem spam · Cancelamento fácil a qualquer momento (Art. 8º LGPD)
                  </span>
                  <button
                    type="submit"
                    disabled={subscribing}
                    className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-lg flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {subscribing ? "Inscrevendo..." : "Receber Boletins"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Filtro de Categorias */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "all", label: "Todas as Edições" },
              { id: "saude_mental", label: "Saúde Mental Infantil" },
              { id: "diretrizes_pedagogicas", label: "Diretrizes Pedagógicas" },
              { id: "plataforma_novidades", label: "Novidades da Plataforma" },
              { id: "artigo_cientifico", label: "Artigos Científicos" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition ${
                  selectedCategory === cat.id
                    ? "bg-sky-50 text-sky-800 border-sky-300 font-bold"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-500 font-semibold">
            {filteredIssues.length} {filteredIssues.length === 1 ? "edição encontrada" : "edições encontradas"}
          </span>
        </div>

        {/* Grade de Edições */}
        {loading ? (
          <div className="p-16 text-center text-xs text-slate-500">Carregando boletins publicados...</div>
        ) : filteredIssues.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">Nenhum boletim publicado nesta categoria ainda</h3>
            <p className="text-xs text-slate-500 mt-1">Inscreva-se acima para receber a próxima edição assim que for lançada!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredIssues.map((issue) => (
              <article
                key={issue.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="px-2 py-0.5 rounded-full font-bold bg-sky-50 text-sky-800 border border-sky-200 capitalize">
                      {issue.category.replace(/_/g, " ")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {new Date(issue.publishedAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-black leading-snug line-clamp-2">
                    {issue.title}
                  </h3>
                  {issue.summary && (
                    <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      {issue.summary}
                    </p>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-semibold">Board Periscópio</span>
                  <button
                    onClick={() => setSelectedIssue(issue)}
                    className="text-xs font-bold text-sky-600 hover:text-sky-700 hover:underline"
                  >
                    Ler Artigo Completo →
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Modal de Leitura de Artigo */}
        {selectedIssue && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200 uppercase">
                    {selectedIssue.category.replace(/_/g, " ")}
                  </span>
                  <h2 className="text-lg font-black text-black mt-2 leading-snug">{selectedIssue.title}</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Publicado em {new Date(selectedIssue.publishedAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedIssue(null)}
                  className="text-slate-400 hover:text-slate-800 p-1"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed text-slate-800">
                {selectedIssue.summary && (
                  <div className="p-3 bg-sky-50/60 border-l-4 border-sky-500 rounded-r-xl italic text-slate-700">
                    {selectedIssue.summary}
                  </div>
                )}
                <div className="whitespace-pre-wrap font-sans text-sm text-slate-800 leading-relaxed space-y-3">
                  {selectedIssue.content}
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button
                  onClick={() => setSelectedIssue(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition"
                >
                  Fechar Leitura
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Opt-out LGPD */}
        {optOutOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <h3 className="text-sm font-bold text-black flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-700" />
                Cancelamento de Assinatura (LGPD Art. 8º)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Você tem o direito de revogar seu consentimento e interromper o recebimento de boletins a qualquer momento.
              </p>

              {optOutMsg ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                  {optOutMsg}
                </div>
              ) : (
                <form onSubmit={handleOptOut} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Informe seu e-mail cadastrado:</label>
                    <input
                      type="email"
                      value={optOutEmail}
                      onChange={(e) => setOptOutEmail(e.target.value)}
                      placeholder="seu.email@escola.sp.gov.br"
                      required
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-black focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setOptOutOpen(false)}
                      className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition"
                    >
                      Cancelar Assinatura
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
