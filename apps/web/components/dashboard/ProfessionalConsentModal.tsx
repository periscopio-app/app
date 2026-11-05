"use client";

import { useState, useEffect } from "react";
import { ShieldAlert, CheckCircle2, FileText, Lock } from "lucide-react";
import { api, TERMO_PENDENTE_EVENTO, TERMO_ACEITO_EVENTO } from "@/lib/api";
import { Button } from "@/components/ui";

interface TermoVigente {
  id: string;
  version: string;
  title: string;
  summary: string;
  content: string;
}

/** "1. Sigilo e Reserva Profissional: texto" → título em negrito e texto normal. A primeira linha é o cabeçalho. */
function Linha({ texto, cabecalho }: { texto: string; cabecalho: boolean }) {
  if (cabecalho) return <p className="font-bold text-slate-900">{texto}</p>;
  const m = texto.match(/^(\d+\.\s[^:]+:)\s*(.*)$/);
  return m ? (
    <p>
      <strong>{m[1]}</strong> {m[2]}
    </p>
  ) : (
    <p>{texto}</p>
  );
}

/**
 * Termo de Responsabilidade Clínica e LGPD. Um aceite por conta: depois de aceito, o servidor guarda `true` e esta janela
 * nunca mais aparece para a conta. O texto exibido vem do servidor (é o mesmo que entra no hash da prova de aceite).
 */
export function ProfessionalConsentModal() {
  const [hasAccepted, setHasAccepted] = useState<boolean | null>(null);
  const [termo, setTermo] = useState<TermoVigente | null>(null);
  const [acceptedCheckbox, setAcceptedCheckbox] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const consultar = () =>
      api
        .get<{ hasAccepted: boolean; term?: TermoVigente }>("/api/me/professional-consent")
        .then((res) => {
          setTermo(res.term ?? null);
          setHasAccepted(res.hasAccepted);
        })
        .catch(() => setHasAccepted((atual) => atual ?? true)); // a trava de verdade é no servidor; se esta consulta falhar a janela não bloqueia a tela
    void consultar();
    // O servidor pode pedir o aceite depois que a página já abriu (ex.: a tabela do termo foi criada com a tela aberta).
    window.addEventListener(TERMO_PENDENTE_EVENTO, consultar);
    return () => window.removeEventListener(TERMO_PENDENTE_EVENTO, consultar);
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
      await api.post("/api/me/professional-consent/accept", { accepted: true, termId: termo?.id, termVersion: termo?.version });
      setHasAccepted(true);
      window.dispatchEvent(new CustomEvent(TERMO_ACEITO_EVENTO));
    } catch (err: any) {
      setError(err?.message || "Não foi possível registrar o aceite agora. Nada foi gravado; tente de novo.");
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
              {termo?.title ?? "Termo de Responsabilidade Clínica & LGPD"}
            </h2>
            <p className="text-xs text-slate-500">
              {termo?.summary ?? "Obrigatório para acesso e manuseio de prontuários de saúde mental infantil"}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 max-h-56 overflow-y-auto text-xs text-slate-700 space-y-2 leading-relaxed font-mono" tabIndex={0} aria-label="Texto do termo">
          {termo ? (
            termo.content.split("\n").map((linha, i) => <Linha key={i} texto={linha} cabecalho={i === 0} />)
          ) : (
            <p>Carregando o termo…</p>
          )}
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

        <Button
          type="button"
          disabled={loading || !acceptedCheckbox || !termo}
          onClick={handleAccept}
          variant="primary" size="md" className="w-full"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{loading ? "Registrando aceite e prova..." : "Confirmar Aceite e Prosseguir"}</span>
        </Button>
      </div>
    </div>
  );
}
