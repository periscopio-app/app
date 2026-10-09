"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, ShieldCheck, ThumbsDown, ThumbsUp, Trash2, User } from "lucide-react";
import { api } from "@/lib/api";
import { ResultView, type Result } from "./ResultView";

export interface ChatPlan {
  metric: string;
  groupBy: string[];
  viz?: "table" | "bar" | "line";
  filters: { schoolId?: string; ageBracket?: string; journeyState?: string; specialty?: string; from?: string; to?: string };
}

interface AskReply {
  questionId: string;
  understood: boolean;
  scrubbed?: boolean;
  message?: string;
  plan?: ChatPlan;
  result?: Result;
  summary?: string;
  explanation?: string | null;
  source?: string;
  confidence?: number | null;
}

type Msg =
  | { id: number; from: "user"; text: string }
  | { id: number; from: "bot"; kind: "text"; text: string }
  | { id: number; from: "bot"; kind: "answer"; reply: AskReply; feedback?: string }
  | { id: number; from: "bot"; kind: "error"; text: string };

const SUGGESTIONS = [
  "Quantos casos temos por escola?",
  "Queixas mais registradas na base de Tarumã",
  "Quantos profissionais precisamos por serviço?",
  "Tempo médio até o encerramento por mês",
  "Casos por etapa da jornada",
  "Delegações por especialidade",
];

const SOURCE_LABEL: Record<string, string> = {
  example: "pergunta já validada pela gestão",
  rules: "interpretação por regras",
  llm: "interpretação por IA",
};

const WELCOME =
  "Oi! Eu respondo perguntas sobre o programa em linguagem natural: casos, escolas, tempo até encerrar, queixas e profissionais necessários. Mostro só contagens agregadas (grupos com menos de 5 casos ficam ocultos) e nunca alunos individuais. Escolha uma sugestão ou escreva a sua pergunta.";

export function AssistantChat({
  currentPlan,
  canApprove,
  onPlan,
  onFeedbackSaved,
}: {
  currentPlan: ChatPlan;
  canApprove: boolean;
  onPlan: (p: ChatPlan) => void;
  onFeedbackSaved: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, from: "bot", kind: "text", text: WELCOME }]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const idRef = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = () => idRef.current++;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [msgs, busy]);

  async function send(raw: string) {
    const q = raw.trim();
    if (q.length < 3 || busy) return;
    setDraft("");
    setMsgs((m) => [...m, { id: nextId(), from: "user", text: q }]);
    setBusy(true);
    try {
      const r = await api.post<AskReply>("/api/bi/ask", { question: q });
      if (r.understood && r.result) {
        if (r.plan) onPlan({ ...r.plan, groupBy: r.plan.groupBy ?? [], filters: r.plan.filters ?? {} });
        setMsgs((m) => [
          ...m,
          ...(r.scrubbed
            ? [{ id: nextId(), from: "bot" as const, kind: "text" as const, text: "Tirei da sua pergunta algo que parecia documento, e-mail ou telefone, por privacidade." }]
            : []),
          { id: nextId(), from: "bot", kind: "answer", reply: r },
        ]);
      } else {
        setMsgs((m) => [
          ...m,
          { id: nextId(), from: "bot", kind: "text", text: r.message ?? "Não consegui transformar isso em uma consulta. Tente citar o que medir e como agrupar." },
        ]);
      }
    } catch (e) {
      setMsgs((m) => [...m, { id: nextId(), from: "bot", kind: "error", text: e instanceof Error ? e.message : "Falha ao perguntar." }]);
    } finally {
      setBusy(false);
    }
  }

  async function feedback(msgId: number, questionId: string, rating: 1 | -1, corrected = false) {
    try {
      const r = await api.post<{ approved: boolean; pendingReview: boolean }>("/api/bi/feedback", {
        questionId,
        rating,
        ...(corrected ? { correctedPlan: currentPlan } : {}),
      });
      const text = r.approved
        ? "Obrigado! Esta pergunta passou a ensinar o assistente."
        : r.pendingReview
          ? "Obrigado! Vai para revisão da gestão antes de ensinar o assistente."
          : "Obrigado pelo retorno.";
      setMsgs((m) => m.map((x) => (x.id === msgId && x.from === "bot" && x.kind === "answer" ? { ...x, feedback: text } : x)));
      if (canApprove) onFeedbackSaved();
    } catch (e) {
      const text = e instanceof Error ? e.message : "Falha ao enviar.";
      setMsgs((m) => m.map((x) => (x.id === msgId && x.from === "bot" && x.kind === "answer" ? { ...x, feedback: text } : x)));
    }
  }

  const fresh = msgs.length === 1;

  return (
    <section aria-label="Assistente do BI" className="rounded-2xl bg-white border border-linha shadow-suave overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-linha bg-roxo-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-roxo bg-roxo-100" aria-hidden="true">
            <Bot className="h-5 w-5 text-black" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-black">Assistente Periscópio</h2>
            <p className="flex items-center gap-1 text-[11px] text-black">
              <ShieldCheck className="h-3 w-3" /> Só contagens agregadas. Não digite nome ou documento de aluno.
            </p>
          </div>
        </div>
        {!fresh && (
          <button
            type="button"
            onClick={() => setMsgs([{ id: nextId(), from: "bot", kind: "text", text: WELCOME }])}
            className="inline-flex items-center gap-1 rounded-lg border border-linha bg-white px-2 py-1 text-xs text-black hover:bg-roxo-50"
          >
            <Trash2 className="h-3 w-3" /> Nova conversa
          </button>
        )}
      </header>

      <div role="log" aria-live="polite" aria-label="Conversa" className="max-h-[560px] min-h-[220px] space-y-4 overflow-y-auto bg-fundo px-4 py-4">
        {msgs.map((m) =>
          m.from === "user" ? (
            <div key={m.id} className="flex items-start justify-end gap-2">
              <p className="max-w-[85%] rounded-2xl rounded-tr-sm border border-roxo bg-roxo-100 px-3 py-2 text-sm text-black">{m.text}</p>
              <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-linha bg-white" aria-hidden="true">
                <User className="h-4 w-4 text-black" />
              </span>
            </div>
          ) : (
            <div key={m.id} className="flex items-start gap-2">
              <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-roxo bg-roxo-100" aria-hidden="true">
                <Bot className="h-4 w-4 text-black" />
              </span>
              <div className="max-w-[92%] min-w-0 flex-1">
                {m.kind === "answer" ? (
                  <div className="space-y-3 rounded-2xl rounded-tl-sm border border-linha bg-white px-3 py-3">
                    {m.reply.summary && <p className="text-sm font-semibold text-black">{m.reply.summary}</p>}
                    {m.reply.explanation && <p className="text-xs text-neutral-800">{m.reply.explanation}</p>}
                    {m.reply.result && <ResultView r={m.reply.result} />}
                    <div className="flex flex-wrap items-center gap-2 border-t border-linha pt-2 text-xs text-black">
                      {m.reply.source && <span className="text-[11px] text-neutral-800">Origem: {SOURCE_LABEL[m.reply.source] ?? m.reply.source}.</span>}
                      <span className="ml-auto">Ajudou?</span>
                      <button type="button" aria-label="Resposta útil" onClick={() => feedback(m.id, m.reply.questionId, 1)} className="inline-flex items-center gap-1 rounded-lg border border-linha px-2 py-1 hover:bg-roxo-50">
                        <ThumbsUp className="h-3 w-3" /> Sim
                      </button>
                      <button type="button" aria-label="Resposta não ajudou" onClick={() => feedback(m.id, m.reply.questionId, -1)} className="inline-flex items-center gap-1 rounded-lg border border-linha px-2 py-1 hover:bg-roxo-50">
                        <ThumbsDown className="h-3 w-3" /> Não
                      </button>
                      <button type="button" onClick={() => feedback(m.id, m.reply.questionId, 1, true)} className="rounded-lg border border-linha px-2 py-1 hover:bg-roxo-50" title="Usa a consulta mostrada em “Montar consulta” como a resposta certa">
                        Corrigir com a consulta abaixo
                      </button>
                    </div>
                    {m.feedback && <p role="status" className="text-xs text-black">{m.feedback}</p>}
                  </div>
                ) : m.kind === "error" ? (
                  <p role="alert" className="rounded-2xl rounded-tl-sm border border-black bg-white px-3 py-2 text-sm text-black">{m.text}</p>
                ) : (
                  <p className="rounded-2xl rounded-tl-sm border border-linha bg-white px-3 py-2 text-sm text-black">{m.text}</p>
                )}
              </div>
            </div>
          ),
        )}
        {busy && (
          <div className="flex items-center gap-2" role="status" aria-label="O assistente está pensando">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-roxo bg-roxo-100" aria-hidden="true">
              <Bot className="h-4 w-4 text-black" />
            </span>
            <span className="inline-flex gap-1 rounded-2xl border border-linha bg-white px-3 py-2" aria-hidden="true">
              <span className="h-2 w-2 animate-bounce rounded-full bg-black [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-black [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-black" />
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="space-y-2 border-t border-linha bg-white px-4 py-3">
        {fresh && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} disabled={busy} className="rounded-full border border-linha bg-white px-3 py-1 text-xs text-black hover:bg-roxo-50 disabled:opacity-60">
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="flex items-end gap-2"
        >
          <label htmlFor="bi-q" className="sr-only">Pergunta ao assistente</label>
          <textarea
            id="bi-q"
            rows={1}
            value={draft}
            maxLength={500}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
            placeholder="Escreva sua pergunta. Ex.: casos por escola nos últimos 6 meses"
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-black bg-white px-3 py-2 text-sm text-black"
          />
          <button
            type="submit"
            disabled={busy || draft.trim().length < 3}
            className="inline-flex h-10 items-center gap-1 rounded-xl border border-roxo bg-roxo-100 px-4 text-sm font-semibold text-black hover:bg-roxo-200 disabled:opacity-60"
          >
            <Send className="h-4 w-4" /> {busy ? "Pensando…" : "Enviar"}
          </button>
        </form>
        <p className="text-[11px] text-neutral-800">Enter envia, Shift+Enter quebra a linha. {draft.length}/500</p>
      </div>
    </section>
  );
}
