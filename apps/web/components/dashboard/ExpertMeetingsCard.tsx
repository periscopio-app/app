"use client";

import { useState, useEffect } from "react";
import { Calendar, Video, Clock, CheckCircle2, AlertCircle, Send, ExternalLink, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";

interface ExpertSlot {
  id: string;
  startsAt: string;
  endsAt: string;
  status?: string;
}

interface MeetingRequest {
  id: string;
  status: "pending" | "confirmed" | "declined" | "cancelled";
  startsAt: string;
  endsAt: string;
  topic: string;
  meetUrl: string | null;
  professionalName?: string;
  schoolName?: string;
  decisionNote?: string | null;
  createdAt: string;
}

interface ExpertMeetingsCardProps {
  caseId?: string;
  studentCode?: string;
}

export function ExpertMeetingsCard({ caseId, studentCode }: ExpertMeetingsCardProps) {
  const [slots, setSlots] = useState<ExpertSlot[]>([]);
  const [meetings, setMeetings] = useState<MeetingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [topic, setTopic] = useState("");
  const [professionalName, setProfessionalName] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [slotsRes, meetingsRes] = await Promise.all([
        api.get<{ slots: ExpertSlot[] }>("/api/expert-meetings/slots"),
        api.get<{ meetings: MeetingRequest[] }>("/api/expert-meetings/requests").catch(() => ({ meetings: [] })),
      ]);
      setSlots(slotsRes.slots || []);
      setMeetings(meetingsRes.meetings || []);
    } catch (err: any) {
      setFeedback({ type: "error", msg: err?.message || "Erro ao carregar agenda do Board." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [caseId]);

  const handleRequestMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlotId || !topic.trim() || !professionalName.trim()) {
      setFeedback({ type: "error", msg: "Preencha todos os campos e selecione um horário." });
      return;
    }

    setRequesting(true);
    setFeedback(null);

    try {
      const res = await api.post<{ request: MeetingRequest; message?: string }>("/api/expert-meetings/requests", {
        slotId: selectedSlotId,
        caseId,
        topic: topic.trim(),
        professionalName: professionalName.trim(),
        studentCode,
      });

      setFeedback({
        type: "success",
        msg: "Solicitação enviada com sucesso! O Board foi notificado por e-mail e o link da videochamada será persistido após confirmação.",
      });
      setSelectedSlotId("");
      setTopic("");
      fetchData();
    } catch (err: any) {
      setFeedback({ type: "error", msg: err?.message || "Erro ao solicitar horário na agenda." });
    } finally {
      setRequesting(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-roxo-50 text-roxo rounded-xl border border-roxo-200">
            <Video className="w-5 h-5 text-purple-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-black flex items-center gap-2">
              Board de Experts & Videochamada Integrada
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Serviço Gratuito • Jitsi / Meet
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Agende discussões clínicas de casos com o comitê de especialistas. Link de videochamada e e-mail automático via Resend.
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
          title="Recarregar agenda"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Grid: Agendamento & Reuniões Marcadas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Formulário de Solicitação */}
        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
            <Calendar className="w-3.5 h-3.5 text-purple-700" />
            Solicitar Horário com o Board
          </h4>

          {slots.length === 0 ? (
            <p className="text-xs text-slate-500 py-3">
              Nenhum horário aberto pelo Board no momento. Novos slots são disponibilizados periodicamente pelos especialistas.
            </p>
          ) : (
            <form onSubmit={handleRequestMeeting} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Horário Disponível na Agenda *
                </label>
                <select
                  value={selectedSlotId}
                  onChange={(e) => setSelectedSlotId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white text-slate-800 outline-none focus:ring-1 focus:ring-purple-700"
                  required
                >
                  <option value="">Selecione um horário disponível...</option>
                  {slots.map((s) => (
                    <option key={s.id} value={s.id}>
                      📅 {formatDateTime(s.startsAt)} até {formatDateTime(s.endsAt).split(" ")[1]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Seu Nome e Especialidade *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Dra. Mariana (Psicopedagoga RE)"
                  value={professionalName}
                  onChange={(e) => setProfessionalName(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white text-slate-800 outline-none focus:ring-1 focus:ring-purple-700"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assunto / Queixa Clínica Principal *
                </label>
                <textarea
                  rows={2}
                  placeholder="Descreva brevemente a dúvida ou motivo do alinhamento com o Board..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white text-slate-800 outline-none focus:ring-1 focus:ring-purple-700 resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={requesting || !selectedSlotId}
                className="w-full py-2 px-3 text-xs font-bold rounded-lg bg-purple-700 hover:bg-purple-800 text-white flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {requesting ? "Enviando solicitação..." : "Agendar e Notificar por E-mail"}
              </button>
            </form>
          )}
        </div>

        {/* Lista de Reuniões Agendadas / Confirmadas */}
        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-purple-700" />
            Reuniões Agendadas & Videochamadas
          </h4>

          {meetings.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              Nenhuma reunião solicitada ainda.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
              {meetings.map((m) => {
                const isConfirmed = m.status === "confirmed";
                const isPending = m.status === "pending";

                return (
                  <div
                    key={m.id}
                    className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-purple-600" />
                        {formatDateTime(m.startsAt)}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isConfirmed
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : isPending
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {isConfirmed ? "Confirmada" : isPending ? "Pendente" : "Recusada"}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 font-medium line-clamp-2">
                      {m.topic}
                    </p>

                    {/* Botão de Entrar na Chamada de Vídeo */}
                    {isConfirmed && m.meetUrl && (
                      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">Link pronto:</span>
                        <a
                          href={m.meetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-2xs"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>Entrar na Videochamada</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {isPending && (
                      <div className="text-[11px] text-amber-700 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Aguardando confirmação do especialista.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
