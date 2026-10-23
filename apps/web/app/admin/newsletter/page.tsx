"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Send, Plus, Users, Mail, CheckCircle2, Clock, RefreshCw, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui";

interface IssueItem {
  id: string;
  title: string;
  summary: string | null;
  category: string;
  status: string;
  publishedAt: string;
}

interface SubscriberItem {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  subscribedAt: string;
}

export default function AdminNewsletterPage() {
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [subscribers, setSubscribers] = useState<SubscriberItem[]>([]);
  const [totalSubscribers, setTotalSubscribers] = useState(0);
  const [totalActive, setTotalActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"issues" | "subscribers">("issues");

  // Modal Nova Edição
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("saude_mental");
  const [submitting, setSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Disparo
  const [sendingId, setSendingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [issuesRes, subsRes] = await Promise.all([
        api.get<{ issues: IssueItem[] }>("/api/newsletter/issues"),
        api.get<{ subscribers: SubscriberItem[]; total: number; totalActive: number }>("/api/admin/newsletter/subscribers").catch(() => ({ subscribers: [], total: 0, totalActive: 0 })),
      ]);
      setIssues(issuesRes.issues || []);
      setSubscribers(subsRes.subscribers || []);
      setTotalSubscribers(subsRes.total || 0);
      setTotalActive(subsRes.totalActive || 0);
    } catch {
      // erro silencioso
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedbackError(null);
    setFeedbackSuccess(null);

    try {
      await api.post("/api/admin/newsletter/issues", {
        title,
        summary,
        content,
        category,
        status: "publicado",
      });
      setFeedbackSuccess("Nova edição publicada com sucesso no portal!");
      setModalOpen(false);
      setTitle("");
      setSummary("");
      setContent("");
      fetchData();
    } catch (err: any) {
      setFeedbackError(err?.message || "Erro ao publicar edição.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendIssue = async (issueId: string) => {
    if (!confirm("Deseja realmente disparar esta edição por e-mail para todos os assinantes ativos via Resend?")) {
      return;
    }
    setSendingId(issueId);
    setFeedbackSuccess(null);
    setFeedbackError(null);

    try {
      const res = await api.post<{ success: boolean; message: string; sentCount: number }>(`/api/admin/newsletter/issues/${issueId}/send`, {});
      setFeedbackSuccess(res.message);
    } catch (err: any) {
      setFeedbackError(err?.message || "Erro no disparo da newsletter.");
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F9FB] text-black">
      {/* Header */}
      <header className="bg-white border-b border-[#E1E9ED] py-4 px-6 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/users" className="text-slate-600 hover:text-black">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-black flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-sky-600" />
                Gestão de Boletins & Comunicação Científica
              </h1>
              <p className="text-xs text-slate-500">
                Publicação de artigos, comunicados do Board e disparo via Resend para a rede
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit"
              onClick={() => setModalOpen(true)}
              variant="primary" size="sm"
            >
              <Plus className="w-4 h-4" /> Nova Edição
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto py-8 px-4 space-y-6">
        {feedbackSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
            <span>{feedbackSuccess}</span>
            <button onClick={() => setFeedbackSuccess(null)} className="font-bold underline text-emerald-700">Fechar</button>
          </div>
        )}

        {feedbackError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
            <span>{feedbackError}</span>
            <button onClick={() => setFeedbackError(null)} className="font-bold underline text-rose-700">Fechar</button>
          </div>
        )}

        {/* Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Assinantes Ativos</span>
            <div className="text-2xl font-black text-black mt-1">{totalActive}</div>
            <p className="text-[11px] text-slate-500 mt-1">Profissionais e gestores cadastrados</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <span className="text-xs font-semibold text-sky-600 uppercase tracking-wider">Edições Publicadas</span>
            <div className="text-2xl font-black text-sky-600 mt-1">{issues.length}</div>
            <p className="text-[11px] text-slate-500 mt-1">Disponíveis no portal e histórico</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Total de Inscrições</span>
            <div className="text-2xl font-black text-purple-600 mt-1">{totalSubscribers}</div>
            <p className="text-[11px] text-slate-500 mt-1">Inclui opt-outs registrados</p>
          </div>
        </div>

        {/* Abas */}
        <div className="flex border-b border-slate-200 text-xs font-bold gap-4">
          <button
            onClick={() => setActiveTab("issues")}
            className={`pb-3 border-b-2 transition ${
              activeTab === "issues" ? "border-sky-600 text-sky-700" : "border-transparent text-slate-500 hover:text-black"
            }`}
          >
            Edições do Boletim ({issues.length})
          </button>
          <button
            onClick={() => setActiveTab("subscribers")}
            className={`pb-3 border-b-2 transition ${
              activeTab === "subscribers" ? "border-sky-600 text-sky-700" : "border-transparent text-slate-500 hover:text-black"
            }`}
          >
            Base de Assinantes ({subscribers.length})
          </button>
        </div>

        {/* Tabela de Edições */}
        {activeTab === "issues" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Título</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">Carregando edições...</td>
                    </tr>
                  ) : issues.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">Nenhum boletim publicado ainda.</td>
                    </tr>
                  ) : (
                    issues.map((i) => (
                      <tr key={i.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-500">
                          {new Date(i.publishedAt).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="py-3 px-4 font-bold text-black">
                          {i.title}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-sky-50 text-sky-800 border border-sky-200 capitalize">
                            {i.category.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Publicado
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button type="submit"
                            onClick={() => handleSendIssue(i.id)}
                            disabled={sendingId === i.id}
                            variant="outline" size="sm" className="ml-auto"
                          >
                            <Send className="w-3 h-3" />
                            {sendingId === i.id ? "Disparando..." : "Disparar E-mails"}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tabela de Assinantes */}
        {activeTab === "subscribers" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">E-mail</th>
                    <th className="py-3 px-4">Nome</th>
                    <th className="py-3 px-4">Perfil</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Data de Inscrição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {subscribers.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-mono font-bold text-black">{s.email}</td>
                      <td className="py-3 px-4">{s.name || "—"}</td>
                      <td className="py-3 px-4 capitalize">{s.role}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          s.status === "ativo"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}>
                          {s.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {new Date(s.subscribedAt).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal Nova Edição */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-black">Publicar Nova Edição do Boletim</h3>
                <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-black">✕</button>
              </div>

              <form onSubmit={handleCreateIssue} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Título da Edição</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Diretrizes Clínicas para Acolhimento do TEA em Ambiente Escolar"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-black focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria Temática</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-black focus:outline-none focus:border-sky-500"
                  >
                    <option value="saude_mental">Saúde Mental Infantil</option>
                    <option value="diretrizes_pedagogicas">Diretrizes Pedagógicas</option>
                    <option value="plataforma_novidades">Novidades da Plataforma</option>
                    <option value="artigo_cientifico">Artigo Científico</option>
                    <option value="geral">Geral</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Resumo / Subtítulo</label>
                  <input
                    type="text"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Breve resumo em uma ou duas frases que aparecerá no cabeçalho..."
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-black focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Conteúdo Completo</label>
                  <textarea
                    rows={8}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Escreva o texto completo do boletim, artigo ou comunicado..."
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-black focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    variant="outline" size="sm"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    variant="primary" size="sm"
                  >
                    {submitting ? "Publicando..." : "Publicar Boletim"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
