"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, CheckCircle2, Clock, Send, AlertCircle, FileText } from "lucide-react";
import { api } from "@/lib/api";

export default function LGPDPedidosPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [kind, setKind] = useState<string>("access");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [protocol, setProtocol] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.post<{
        success: boolean;
        protocol: string;
        deadlineDate: string;
        legalDeadlineDays: number;
        message: string;
      }>("/api/lgpd/requests", {
        requesterEmail: email,
        requesterName: name,
        requesterDocument: document,
        kind,
        details,
      });

      setProtocol(res.protocol);
      setDeadline(res.deadlineDate);
    } catch (err: any) {
      setError(err?.message || "Erro ao registrar a solicitação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F9FB] text-black">
      {/* Top Header */}
      <header className="bg-white border-b border-[#E1E9ED] py-4 px-6 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/privacidade" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-black">
            <ArrowLeft className="w-4 h-4" />
            Voltar à Política de Privacidade
          </Link>
          <div className="flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            Canal Oficial LGPD (Art. 18)
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto py-10 px-4">
        {protocol ? (
          <div className="bg-white rounded-2xl border border-emerald-200 p-8 shadow-sm text-center animate-fadeIn">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-black mb-2">Solicitação Registrada com Sucesso</h1>
            <p className="text-slate-600 text-sm mb-6">
              Sua solicitação sob a Lei Geral de Proteção de Dados (LGPD) foi protocolada junto ao Encarregado de Dados (DPO) da plataforma e das instituições parceiras.
            </p>

            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 text-left mb-6 space-y-3">
              <div>
                <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">Número de Protocolo</span>
                <p className="font-mono text-base font-bold text-black select-all">{protocol}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-black pt-2 border-t border-slate-200">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span>Prazo legal de atendimento: <strong>até {deadline} (15 dias úteis)</strong> conforme Art. 19, II da LGPD.</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-6">
              Uma confirmação foi encaminhada ao e-mail informado. Para acompanhamento adicional, contate diretamente <strong>dpo@projetoperiscopio.com.br</strong> mencionando o número de protocolo.
            </p>

            <Link
              href="/"
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-purple-50 text-purple-800 border border-purple-200 font-semibold hover:bg-purple-100 transition"
            >
              Voltar à Página Inicial
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-purple-50 text-purple-700 rounded-xl border border-purple-200">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-black">Exercício de Direitos do Titular</h1>
                <p className="text-sm text-slate-600">Requerimento formal com base no Art. 18 da Lei Federal nº 13.709/2018 (LGPD)</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-6 bg-blue-50/60 p-4 rounded-xl border border-blue-100 leading-relaxed">
              Como responsável legal pelo aluno ou profissional cadastrado, você tem o direito de requerer confirmação de tratamento, acesso, retificação ou exclusão de dados pessoais. Nosso Encarregado pelo Tratamento de Dados (DPO) responderá dentro do prazo legal de 15 dias úteis.
            </p>

            {error && (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-800 text-sm p-4 rounded-xl mb-6">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-black mb-1">
                  E-mail para resposta e confirmação <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@dominio.com.br"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-black placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-black mb-1">
                    Nome Completo do Solicitante
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome do titular ou responsável legal"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-black placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-black mb-1">
                    CPF (opcional para conferência)
                  </label>
                  <input
                    type="text"
                    value={document}
                    onChange={(e) => setDocument(e.target.value)}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-black placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-black mb-1">
                  Tipo de Solicitação LGPD <span className="text-rose-500">*</span>
                </label>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-black focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  <option value="access">Acesso e Confirmação de Tratamento (Art. 18, I e II)</option>
                  <option value="correction">Correção de Dados Incompletos ou Inexatos (Art. 18, III)</option>
                  <option value="deletion">Anonimização, Bloqueio ou Eliminação (Art. 18, IV e VI)</option>
                  <option value="portability">Portabilidade dos Dados (Art. 18, V)</option>
                  <option value="revocation">Revogação de Consentimento Prévia (Art. 18, IX)</option>
                  <option value="information">Informações sobre Compartilhamento (Art. 18, VII)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-black mb-1">
                  Detalhes da Solicitação
                </label>
                <textarea
                  rows={4}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Descreva detalhes específicos para auxiliar na localização dos dados, como nome da escola ou município envolvido..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-black placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-6 rounded-xl font-bold bg-[#682880] text-white hover:bg-[#531e66] transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {loading ? (
                    "Registrando solicitação..."
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Enviar Solicitação e Gerar Protocolo
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-slate-500 text-center pt-2">
                Suas informações serão tratadas sob estrito sigilo funcional pelo Encarregado de Dados.
              </p>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
