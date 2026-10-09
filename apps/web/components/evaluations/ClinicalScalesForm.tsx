"use client";

import { useState } from "react";
import {
  ClipboardCheck,
  Check,
  AlertTriangle,
  Send,
  Sparkles,
  ShieldAlert,
  Brain,
  Activity,
  FileCheck,
  Copy,
} from "lucide-react";

interface ScaleQuestion {
  id: string;
  category?: string;
  text: string;
  options: { label: string; score: number }[];
}

// 1. M-CHAT-R/F (Rastreamento de Autismo em Crianças Pequenas)
const MCHAT_QUESTIONS: ScaleQuestion[] = [
  { id: "mc1", text: "1. Se você apontar para algo do outro lado da sala, a criança olha para o objeto?", options: [{ label: "Sim", score: 0 }, { label: "Não", score: 1 }] },
  { id: "mc2", text: "2. Você já se perguntou se a criança pode ser surda?", options: [{ label: "Sim", score: 1 }, { label: "Não", score: 0 }] },
  { id: "mc3", text: "3. A criança brinca de faz-de-conta ou jogo simbólico (ex.: fingir que bebe em copo vazio)?", options: [{ label: "Sim", score: 0 }, { label: "Não", score: 1 }] },
  { id: "mc4", text: "4. A criança gosta de subir nas coisas (ex.: móveis, brinquedos do parque)?", options: [{ label: "Sim", score: 0 }, { label: "Não", score: 1 }] },
  { id: "mc5", text: "5. A criança faz movimentos incomuns com os dedos perto dos olhos?", options: [{ label: "Sim", score: 1 }, { label: "Não", score: 0 }] },
  { id: "mc6", text: "6. A criança aponta com o indicador para pedir algo ou mostrar interesse?", options: [{ label: "Sim", score: 0 }, { label: "Não", score: 1 }] },
  { id: "mc7", text: "7. A criança se interessa por outras crianças?", options: [{ label: "Sim", score: 0 }, { label: "Não", score: 1 }] },
  { id: "mc8", text: "8. A criança responde quando é chamada pelo nome?", options: [{ label: "Sim", score: 0 }, { label: "Não", score: 1 }] },
  { id: "mc9", text: "9. Quando você sorri para a criança, ela sorri de volta?", options: [{ label: "Sim", score: 0 }, { label: "Não", score: 1 }] },
  { id: "mc10", text: "10. A criança fica chateada com barulhos do dia a dia?", options: [{ label: "Sim", score: 1 }, { label: "Não", score: 0 }] },
];

// 2. FOGAP (Ficha de Observação Global de Aprendizagem e Psicomotricidade)
const FOGAP_QUESTIONS: ScaleQuestion[] = [
  { id: "fog1", category: "Psicomotricidade", text: "1. Coordenação Motora Fina: Empunhadura de lápis, encaixe e manipulação de pequenos objetos.", options: [{ label: "Adequado (0)", score: 0 }, { label: "Atenção (1)", score: 1 }, { label: "Déficit Relevante (2)", score: 2 }] },
  { id: "fog2", category: "Psicomotricidade", text: "2. Esquema Corporal e Equilíbrio: Noção de espaço, postura e locomoção orientada.", options: [{ label: "Adequado (0)", score: 0 }, { label: "Atenção (1)", score: 1 }, { label: "Déficit Relevante (2)", score: 2 }] },
  { id: "fog3", category: "Linguagem", text: "3. Comunicação Expressiva: Articulação de frases, vocabulário e clareza na intenção comunicativa.", options: [{ label: "Adequado (0)", score: 0 }, { label: "Atenção (1)", score: 1 }, { label: "Déficit Relevante (2)", score: 2 }] },
  { id: "fog4", category: "Linguagem", text: "4. Compreensão de Comandos: Entendimento de instruções verbais simples e compostas em sala.", options: [{ label: "Adequado (0)", score: 0 }, { label: "Atenção (1)", score: 1 }, { label: "Déficit Relevante (2)", score: 2 }] },
  { id: "fog5", category: "Comportamento", text: "5. Socialização e Interação: Engajamento com pares em brincadeiras em grupo e autorregulação.", options: [{ label: "Adequado (0)", score: 0 }, { label: "Atenção (1)", score: 1 }, { label: "Déficit Relevante (2)", score: 2 }] },
  { id: "fog6", category: "Aprendizagem", text: "6. Foco e Sustentação de Atenção: Manutenção da concentração em tarefas pedagógicas adequadas à idade.", options: [{ label: "Adequado (0)", score: 0 }, { label: "Atenção (1)", score: 1 }, { label: "Déficit Relevante (2)", score: 2 }] },
];

// 3. SRQ-20 (Self-Reporting Questionnaire - Rastreamento de Sofrimento Psíquico)
const SRQ20_QUESTIONS: ScaleQuestion[] = [
  { id: "srq1", text: "1. Tem dores de cabeça frequentes?", options: [{ label: "Sim", score: 1 }, { label: "Não", score: 0 }] },
  { id: "srq2", text: "2. Tem falta de apetite?", options: [{ label: "Sim", score: 1 }, { label: "Não", score: 0 }] },
  { id: "srq3", text: "3. Dorme mal ou acorda com sensação de cansaço?", options: [{ label: "Sim", score: 1 }, { label: "Não", score: 0 }] },
  { id: "srq4", text: "4. Assusta-se ou irrita-se com facilidade?", options: [{ label: "Sim", score: 1 }, { label: "Não", score: 0 }] },
  { id: "srq5", text: "5. Sente-se triste, desanimado ou com choro fácil?", options: [{ label: "Sim", score: 1 }, { label: "Não", score: 0 }] },
  { id: "srq6", text: "6. Tem dificuldades para tomar decisões no cotidiano?", options: [{ label: "Sim", score: 1 }, { label: "Não", score: 0 }] },
  { id: "srq7", text: "7. Sente-se incapaz de desempenhar um papel útil em sua vida?", options: [{ label: "Sim", score: 1 }, { label: "Não", score: 0 }] },
  { id: "srq8", text: "8. Perdeu o interesse pelas coisas ou atividades habituais?", options: [{ label: "Sim", score: 1 }, { label: "Não", score: 0 }] },
];

export default function ClinicalScalesForm({ studentId }: { studentId?: string }) {
  const [selectedScale, setSelectedScale] = useState<"mchat" | "fogap" | "srq20">("mchat");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const getQuestions = () => {
    switch (selectedScale) {
      case "mchat": return MCHAT_QUESTIONS;
      case "fogap": return FOGAP_QUESTIONS;
      case "srq20": return SRQ20_QUESTIONS;
    }
  };

  const questions = getQuestions();
  const currentScore = Object.values(answers).reduce((sum, val) => sum + val, 0);

  // Cálculo do Risco / Nível Clínico
  const getRiskClassification = () => {
    if (selectedScale === "mchat") {
      if (currentScore <= 2) return { level: "Baixo Risco", color: "bg-emerald-100 text-emerald-800 border-emerald-300", desc: "Acompanhamento no desenvolvimento de rotina em sala." };
      if (currentScore <= 7) return { level: "Risco Moderado", color: "bg-amber-100 text-amber-800 border-amber-300", desc: "Recomenda-se aplicação da entrevista de seguimento M-CHAT-R/F." };
      return { level: "Alto Risco de TEA", color: "bg-rose-100 text-rose-800 border-rose-300", desc: "Encaminhamento prioritário à equipe de neuropediatria/psiquiatria." };
    }
    if (selectedScale === "fogap") {
      if (currentScore <= 3) return { level: "Desenvolvimento Esperado", color: "bg-emerald-100 text-emerald-800 border-emerald-300", desc: "Sinais de aprendizagem dentro da faixa etária." };
      if (currentScore <= 7) return { level: "Atenção Pedagógica", color: "bg-amber-100 text-amber-800 border-amber-300", desc: "Indicação de intervenção precoce no plano de ensino." };
      return { level: "Investigação Multidisciplinar", color: "bg-rose-100 text-rose-800 border-rose-300", desc: "Abertura de seções com Fonoaudiologia e Psicopedagogia (PpI)." };
    }
    // SRQ-20
    if (currentScore < 5) return { level: "Sem Sofrimento Significativo", color: "bg-emerald-100 text-emerald-800 border-emerald-300", desc: "Métricas emocionais estáveis." };
    if (currentScore < 7) return { level: "Alerta Emocional Leve", color: "bg-amber-100 text-amber-800 border-amber-300", desc: "Acolhimento preventivo com psicólogo/orientador escolar." };
    return { level: "Sofrimento Psíquico Significativo", color: "bg-rose-100 text-rose-800 border-rose-300", desc: "Pontuação positiva para rastreamento de transtorno mental comum." };
  };

  const riskInfo = getRiskClassification();

  // Gerador de Resumo Clínico Automático para Prontuário
  const generateClinicalSummaryText = () => {
    const scaleName = selectedScale.toUpperCase();
    const totalQ = questions.length;
    const answeredQ = Object.keys(answers).length;
    const dateStr = new Date().toLocaleDateString("pt-BR");

    return `[SUMÁRIO CLÍNICO AUTOMÁTICO - ${scaleName}]
Data de Aplicação: ${dateStr}
Código do Estudante (LGPD): ${studentId || "std-demo-123"}
Escala Aplicada: ${scaleName} (${answeredQ}/${totalQ} itens respondidos)
Pontuação Total Calculada: ${currentScore} pontos
Classificação de Risco: ${riskInfo.level}
Parecer de Encaminhamento: ${riskInfo.desc}
Status no Prontuário NEMT: Registro consolidado e anexado ao dossiê multiprofissional.`;
  };

  const handleSelectOption = (questionId: string, score: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: score }));
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(generateClinicalSummaryText());
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const apiUrl = "";

    try {
      const res = await fetch(`${apiUrl}/api/evaluations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentId || "std-demo-123",
          scale: selectedScale,
          score: currentScore,
          payload: {
            answers,
            classification: riskInfo.level,
            summaryText: generateClinicalSummaryText(),
            totalQuestions: questions.length,
            answeredAt: new Date().toISOString(),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar avaliação clínica.");

      setSuccess(`Avaliação ${selectedScale.toUpperCase()} salva no prontuário com sucesso! Score: ${currentScore} (${riskInfo.level}).`);
    } catch (err: any) {
      setError(err?.message || "Falha ao enviar dados da avaliação.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-[#E1E9ED] rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header & Scale Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E1E9ED] pb-4 gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-black flex items-center gap-2 font-display">
            <ClipboardCheck className="w-5 h-5 text-black" />
            <span>Formulários & Escalas Clínicas Interativas</span>
          </h2>
          <p className="text-xs text-neutral-800 mt-0.5">
            Aplicação de M-CHAT, FOGAP e SRQ-20 com pontuação e resumo automático no prontuário
          </p>
        </div>

        {/* Scale Switcher Tabs */}
        <div className="flex flex-wrap gap-1.5 bg-[#F6F9FB] p-1.5 rounded-xl border border-[#E1E9ED]">
          <button
            type="button"
            onClick={() => { setSelectedScale("mchat"); setAnswers({}); setSuccess(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedScale === "mchat"
                ? "bg-roxo-100 border border-roxo text-black shadow-sm"
                : "text-neutral-800 hover:text-black"
            }`}
          >
            M-CHAT (Autismo)
          </button>

          <button
            type="button"
            onClick={() => { setSelectedScale("fogap"); setAnswers({}); setSuccess(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedScale === "fogap"
                ? "bg-roxo-100 border border-roxo text-black shadow-sm"
                : "text-neutral-800 hover:text-black"
            }`}
          >
            FOGAP (Aprendizagem)
          </button>

          <button
            type="button"
            onClick={() => { setSelectedScale("srq20"); setAnswers({}); setSuccess(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedScale === "srq20"
                ? "bg-roxo-100 border border-roxo text-black shadow-sm"
                : "text-neutral-800 hover:text-black"
            }`}
          >
            SRQ-20 (Saúde Mental)
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 text-red-800 text-xs border border-red-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl bg-[#EAF6F0] text-[#1E5A41] text-xs border border-[#CFE8DB] flex items-center gap-2 font-medium">
          <Check className="w-4 h-4 shrink-0 text-[#2F7D5B]" />
          <span>{success}</span>
        </div>
      )}

      {/* Questions Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 max-h-[420px] overflow-y-auto pr-1">
          {questions.map((q) => (
            <div key={q.id} className="p-4 rounded-xl bg-[#F6F9FB] border border-[#E1E9ED]">
              {q.category && (
                <span className="text-[10px] uppercase font-extrabold text-black tracking-wider mb-1 block">
                  {q.category}
                </span>
              )}
              <p className="text-xs font-bold text-black mb-2.5 leading-relaxed">{q.text}</p>
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => {
                  const isSelected = answers[q.id] === opt.score;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => handleSelectOption(q.id, opt.score)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                        isSelected
                          ? "bg-roxo-100 border border-roxo text-black border-roxo shadow-sm"
                          : "bg-white text-neutral-800 border-[#E1E9ED] hover:bg-[#F0F9FC] hover:text-black"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Real-Time Risk Score Bar & Automatic Summary Generator */}
        <div className="p-4 rounded-2xl bg-[#F0F9FC] border border-[#E1E9ED] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-800 font-bold">Pontuação Total:</span>
                <span className="text-lg font-extrabold text-black">{currentScore} pts</span>
              </div>
              <p className="text-xs text-neutral-800 mt-0.5">{riskInfo.desc}</p>
            </div>

            <span className={`px-3 py-1.5 rounded-full text-xs font-extrabold border ${riskInfo.color}`}>
              {riskInfo.level}
            </span>
          </div>

          {/* Automatic Clinical Summary Card Preview */}
          <div className="p-3.5 bg-white rounded-xl border border-[#E1E9ED] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-black flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-black" />
                Resumo Automático de Prontuário
              </span>
              <button
                type="button"
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-black hover:underline"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedSummary ? "Copiado!" : "Copiar Texto"}</span>
              </button>
            </div>
            <pre className="text-[11px] font-mono text-neutral-800 whitespace-pre-wrap bg-[#F6F9FB] p-2.5 rounded-lg border border-[#E1E9ED]">
              {generateClinicalSummaryText()}
            </pre>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting || Object.keys(answers).length === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-roxo-100 border border-roxo hover:bg-roxo-200 text-black font-bold text-xs shadow-sm transition-all disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? "Gravando..." : "Anexar Resumo ao Prontuário"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
