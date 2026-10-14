"use client";

import { useState, useEffect } from "react";
import { ShieldAlert, CheckCircle2, FileText, Lock } from "lucide-react";
import { api } from "@/lib/api";

export function ProfessionalConsentModal() {
  const [hasAccepted, setHasAccepted] = useState<boolean | null>(null);
  const [acceptedCheckbox, setAcceptedCheckbox] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ hasAccepted: boolean }>("/api/me/professional-consent")
      .then((res) => setHasAccepted(res.hasAccepted))
      .catch(() => setHasAccepted(true)); // Se falhar rota não trava a interface
  }, []);

  if (hasAccepted === null || hasAccepted === true) {
    return null;
  }

  const handleAccept = async () => {
    if (!acceptedCheckbox) {
      setError("É obrigatório marcar o checkbox declarando concordância com os termos.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post("/api/me/professional-consent/accept", {});
      setHasAccepted(true);
    } catch (err: any) {
      setError(err?.message || "Erro ao registrar aceite.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-3 bg-purple-50 text-purple-700 rounded-2xl border border-purple-200">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Termo de Responsabilidade Clínica & LGPD
            </h2>
            <p className="text-xs text-slate-500">
              Obrigatório para acesso e manuseio de prontuários de saúde mental infantil
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 max-h-56 overflow-y-auto text-xs text-slate-700 space-y-2 leading-relaxed font-mono">
          <p className="font-bold text-slate-900">
            COMPROMISSO ÉTICO, DEONTOLÓGICO E DE PROTEÇÃO DE DADOS (LEI 13.709/2018):
          </p>
          <p>
            1. <strong>Sigilo e Reserva Profissional:</strong> Declaro observar estritamente as resoluções do meu Conselho de Classe Profissional (CFM, CFP, CREFONO, ABPp, CFESS, etc.) pertinentes ao sigilo de prontuários clínicos.
          </p>
          <p>
            2. <strong>Minimização de Dados (Art. 6º, III):</strong> Comprometo-me a acessar e registrar unicamente as informações pertinentes à minha especialidade técnica e à conduta assistencial do estudante.
          </p>
          <p>
            3. <strong>Proibição de Vazamento e Cópia:</strong> É estritamente vedado copiar, fotografar, exportar ou compartilhar dados clínicos de menores com terceiros não autorizados ou por canais de mensageria não oficiais.
          </p>
          <p>
            4. <strong>Imutabilidade e Auditoria:</strong> Estou ciente de que cada visualização e preenchimento de prontuário é auditada com carimbo de tempo, IP e assinatura eletrônica rastreável.
          </p>
        </div>

        <label className="flex items-start gap-3 p-3.5 bg-purple-50/50 rounded-xl border border-purple-200/60 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedCheckbox}
            onChange={(e) => setAcceptedCheckbox(e.target.checked)}
            className="mt-0.5 rounded border-slate-300 text-purple-700 focus:ring-purple-700 h-4 w-4"
          />
          <span className="text-xs text-slate-800 leading-snug">
            <strong>Declaro ter lido e aceito</strong> as condições do Termo de Responsabilidade Clínica e Proteção de Dados (LGPD). Comprometo-me a manter absoluto sigilo sobre qualquer dado de saúde visualizado.
          </span>
        </label>

        <button
          type="button"
          disabled={loading || !acceptedCheckbox}
          onClick={handleAccept}
          className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-purple-700 hover:bg-purple-800 text-white flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{loading ? "Registrando aceite e prova..." : "Confirmar Aceite e Prosseguir"}</span>
        </button>
      </div>
    </div>
  );
}
