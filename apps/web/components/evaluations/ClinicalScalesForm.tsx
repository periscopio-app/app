"use client";

import { useState } from "react";
import { ClipboardCheck, Check, AlertTriangle, Send } from "lucide-react";

interface ScaleQuestion {
  id: string;
  text: string;
  options: { label: string; score: number }[];
}

const MCHAT_QUESTIONS: ScaleQuestion[] = [
  { id: "q1", text: "1. Se você apontar para algo do outro lado da sala, a criança olha para o objeto?", options: [{ label: "Sim", score: 0 }, { label: "Não", score: 1 }] },
  { id: "q2", text: "2. Você já se perguntou se a criança pode ser surda?", options: [{ label: "Sim", score: 1 }, { label: "Não", score: 0 }] },
  { id: "q3", text: "3. A criança brinca de faz-de-conta ou jogo simbólico?", options: [{ label: "Sim", score: 0 }, { label: "Não", score: 1 }] },
  { id: "q4", text: "4. A criança gosta de subir nas coisas (ex.: móveis, brinquedos do parque)?", options: [{ label: "Sim", score: 0 }, { label: "Não", score: 1 }] },
  { id: "q5", text: "5. A criança faz movimentos incomuns com os dedos perto dos olhos?", options: [{ label: "Sim", score: 1 }, { label: "Não", score: 0 }] },
  { id: "q6", text: "6. A criança aponta com o indicador para pedir algo ou para mostrar interesse?", options: [{ label: "Sim", score: 0 }, { label: "Não", score: 1 }] },
];

const SRQ20_QUESTIONS: ScaleQuestion[] = [
  { id: "s1", text: "1. Tem dores de cabeça frequentes?", options: [{ label: "Sim", score: 1 }, { label: "Não", score: 0 }] },
  { id: "s2", text: "2. Tem falta de apetite?", options: [{ label: "Sim", score: 1 }, { label: "Não", score: 0 }] },
  { id: "s3", text: "3. Dorme mal?", options: [{ label: "Sim", score: 1 }, { label: "Não", score: 0 }] },
  { id: "s4", text: "4. Assusta-se com facilidade?", options: [{ label: "Sim", score: 1 }, { label: "Não", score: 0 }] },
  { id: "s5", text: "5. Sente-se triste ou desanimado frequentemente?", options: [{ label: "Sim", score: 1 }, { label: "Não", score: 0 }] },
];

export default function ClinicalScalesForm({ studentId }: { studentId?: string }) {
  const [selectedScale, setSelectedScale] = useState<"mchat" | "srq20">("mchat");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const questions = selectedScale === "mchat" ? MCHAT_QUESTIONS : SRQ20_QUESTIONS;

  const currentScore = Object.values(answers).reduce((sum, val) => sum + val, 0);

  const handleSelectOption = (questionId: string, score: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: score }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
            totalQuestions: questions.length,
            answeredAt: new Date().toISOString(),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar avaliação clínica.");

      setSuccess(`Avaliação ${selectedScale.toUpperCase()} salva com sucesso! Score calculado: ${currentScore}`);
      setAnswers({});
    } catch (err: any) {
      setError(err?.message || "Falha ao enviar dados da avaliação.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-[#E1E9ED] rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-[#E1E9ED] pb-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-[#14202B] flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-[#682880]" />
            <span>Escalas Clínicas de Rastreamento</span>
          </h2>
          <p className="text-xs text-[#5B6B78] mt-0.5">
            Aplicação e consolidação de protocolos padronizados no prontuário
          </p>
        </div>

        {/* Scale Switcher */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setSelectedScale("mchat"); setAnswers({}); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedScale === "mchat"
                ? "bg-[#682880] text-white"
                : "bg-[#F0F9FC] text-[#3D6B6B] hover:bg-[#E1ECEC]"
            }`}
          >
            M-CHAT (Autismo)
          </button>
          <button
            type="button"
            onClick={() => { setSelectedScale("srq20"); setAnswers({}); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedScale === "srq20"
                ? "bg-[#682880] text-white"
                : "bg-[#F0F9FC] text-[#3D6B6B] hover:bg-[#E1ECEC]"
            }`}
          >
            SRQ-20 (Saúde Mental)
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 mb-4 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 mb-4 rounded-xl bg-[#EAF6F0] text-[#1E5A41] text-xs border border-[#CFE8DB] flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0 text-[#2F7D5B]" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {questions.map((q) => (
          <div key={q.id} className="p-4 rounded-xl bg-[#F6F9FB] border border-[#E1E9ED]">
            <p className="text-xs font-semibold text-[#14202B] mb-2">{q.text}</p>
            <div className="flex gap-3">
              {q.options.map((opt) => {
                const isSelected = answers[q.id] === opt.score;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => handleSelectOption(q.id, opt.score)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      isSelected
                        ? "bg-[#3D6B6B] text-white border-[#3D6B6B]"
                        : "bg-white text-[#5B6B78] border-[#E1E9ED] hover:bg-[#F0F9FC]"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Footer Score Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-[#E1E9ED]">
          <div className="text-xs">
            <span className="text-[#5B6B78]">Score Calculado: </span>
            <span className="font-extrabold text-[#682880] text-sm">{currentScore} pts</span>
          </div>

          <button
            type="submit"
            disabled={submitting || Object.keys(answers).length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#682880] to-[#52206A] text-white font-semibold text-xs shadow-sm hover:shadow transition-all disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submitting ? "Salvando..." : "Salvar no Prontuário"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
