"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type Me } from "@/lib/api";
import { Alert, Badge, Button, Card, Field } from "@/components/ui";
import { CalendarClock, Video } from "lucide-react";

type Slot = { id: string; startsAt: string; endsAt: string; status?: string };
type Meeting = {
  id: string;
  status: "pending" | "confirmed" | "declined" | "cancelled";
  professionalName: string;
  topic: string;
  studentCode: string | null;
  meetUrl: string | null;
  decisionNote: string | null;
  startsAt: string;
  endsAt: string;
  schoolName: string | null;
};

const STATUS_LABEL: Record<Meeting["status"], string> = {
  pending: "Aguardando confirmação",
  confirmed: "Confirmada",
  declined: "Não confirmada",
  cancelled: "Cancelada",
};

const STATUS_ESTADO = { pending: "revisao", confirmed: "encerrado", declined: "rascunho", cancelled: "rascunho" } as const;

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
const fmtShort = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

/** Converte "2026-10-20" + "14:00" (horário de Brasília, UTC-3 sem horário de verão) em ISO. */
const toIso = (date: string, time: string) => new Date(`${date}T${time}:00-03:00`).toISOString();

export default function AgendaPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetUrl, setMeetUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [msg, setMsg] = useState<{ tom: "ok" | "erro"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // formulário da escola
  const [slotId, setSlotId] = useState("");
  const [professionalName, setProfessionalName] = useState("");
  const [topic, setTopic] = useState("");
  const [studentCode, setStudentCode] = useState("");

  // formulário da Dra.
  const [date, setDate] = useState("");
  const [start, setStart] = useState("14:00");
  const [end, setEnd] = useState("15:00");

  const isManager = me?.role === "board" || me?.role === "admin_platform";

  const reload = useCallback(async (manager: boolean) => {
    const [s, m] = await Promise.all([
      api.get<{ slots: Slot[]; notice: string }>("/api/expert-meetings/slots"),
      api.get<{ meetings: Meeting[] }>("/api/expert-meetings"),
    ]);
    setSlots(s.slots);
    setNotice(s.notice);
    setMeetings(m.meetings);
    if (manager) {
      const cfg = await api.get<{ meetUrl: string | null }>("/api/expert-meetings/settings");
      setMeetUrl(cfg.meetUrl ?? "");
    }
  }, []);

  useEffect(() => {
    api
      .get<{ user: Me }>("/api/me")
      .then(async ({ user }) => {
        setMe(user);
        setProfessionalName(user.name ?? "");
        await reload(user.role === "board" || user.role === "admin_platform");
      })
      .catch((e) => setMsg({ tom: "erro", text: e instanceof ApiError ? e.message : "Não foi possível carregar a agenda." }));
  }, [reload]);

  async function run(action: () => Promise<unknown>, okText: string) {
    setBusy(true);
    setMsg(null);
    try {
      await action();
      setMsg({ tom: "ok", text: okText });
      await reload(!!isManager);
    } catch (e) {
      setMsg({ tom: "erro", text: e instanceof ApiError ? e.message : "Erro inesperado." });
    } finally {
      setBusy(false);
    }
  }

  const requestMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.post("/api/expert-meetings", { slotId, professionalName, topic, studentCode: studentCode || undefined });
      setSlotId("");
      setTopic("");
      setStudentCode("");
    }, "Pedido enviado. A equipe do Board foi avisada e você receberá a confirmação por e-mail.");
  };

  const addSlot = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => api.post("/api/expert-meetings/slots", { startsAt: toIso(date, start), endsAt: toIso(date, end) }), "Horário liberado.");
  };

  const saveMeet = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => api.put("/api/expert-meetings/settings", { meetUrl }), "Sala fixa salva.");
  };

  const decide = (id: string, action: "confirm" | "decline") => {
    const note = action === "decline" ? window.prompt("Observação para quem pediu (opcional):") ?? "" : "";
    run(() => api.patch(`/api/expert-meetings/${id}/${action}`, { note }), action === "confirm" ? "Reunião confirmada e e-mails enviados." : "Pedido recusado e horário liberado.");
  };

  if (!me) return <p className="py-16 text-center text-sm text-neutral-800">Carregando agenda...</p>;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 md:p-8">
      <header className="flex items-center gap-3">
        <CalendarClock aria-hidden className="h-7 w-7 text-black" />
        <div>
          <h1 className="text-2xl font-bold text-black">Agenda do Board de experts</h1>
          <p className="text-sm text-neutral-800">
            {isManager ? "Libere horários e confirme os pedidos das escolas." : "Peça uma reunião do Board para discutir um caso."}
          </p>
        </div>
      </header>

      {msg && <Alert tom={msg.tom}>{msg.text}</Alert>}

      {isManager ? (
        <>
          <Card className="flex flex-col gap-4 p-6">
            <h2 className="text-lg font-semibold">Sala fixa (Google Meet)</h2>
            <form onSubmit={saveMeet} className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1">
                <Field id="meet" label="Link permanente da sala" placeholder="https://meet.google.com/abc-defg-hij" value={meetUrl} onChange={(e) => setMeetUrl(e.target.value)} required />
              </div>
              <Button type="submit" disabled={busy}>Salvar sala</Button>
            </form>
            <p className="text-sm text-neutral-800">Crie a sala no Google Meet com sua conta e cole o link aqui. Ele é enviado em todas as confirmações.</p>
          </Card>

          <Card className="flex flex-col gap-4 p-6">
            <h2 className="text-lg font-semibold">Liberar horário</h2>
            <form onSubmit={addSlot} className="grid gap-3 md:grid-cols-4 md:items-end">
              <Field id="data" type="date" label="Data" value={date} onChange={(e) => setDate(e.target.value)} required />
              <Field id="ini" type="time" label="Início" value={start} onChange={(e) => setStart(e.target.value)} required />
              <Field id="fim" type="time" label="Fim" value={end} onChange={(e) => setEnd(e.target.value)} required />
              <Button type="submit" disabled={busy}>Adicionar</Button>
            </form>
            <ul className="divide-y divide-linha">
              {slots.length === 0 && <li className="py-2 text-sm text-neutral-800">Nenhum horário futuro.</li>}
              {slots.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>{fmt(s.startsAt)}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-neutral-800">{s.status === "available" ? "Livre" : s.status === "booked" ? "Reservado" : "Cancelado"}</span>
                    {s.status === "available" && (
                      <Button variant="ghost" className="min-h-9 px-3 text-sm" disabled={busy} onClick={() => run(() => api.delete(`/api/expert-meetings/slots/${s.id}`), "Horário cancelado.")}>
                        Cancelar
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : (
        <Card className="flex flex-col gap-4 p-6">
          <h2 className="text-lg font-semibold">Pedir reunião</h2>
          {notice && <Alert tom="atencao">{notice}</Alert>}
          {slots.length === 0 ? (
            <p className="text-sm text-neutral-800">Não há horários liberados no momento. Tente novamente em breve.</p>
          ) : (
            <form onSubmit={requestMeeting} className="flex flex-col gap-4">
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-semibold">Escolha o horário</legend>
                <div className="grid gap-2 md:grid-cols-2">
                  {slots.map((s) => (
                    <label key={s.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border-[1.5px] px-4 py-3 text-sm ${slotId === s.id ? "border-roxo bg-roxo-50" : "border-input"}`}>
                      <input type="radio" name="slot" value={s.id} checked={slotId === s.id} onChange={() => setSlotId(s.id)} required />
                      {fmt(s.startsAt)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field id="prof" label="Nome do profissional" value={professionalName} onChange={(e) => setProfessionalName(e.target.value)} required minLength={3} maxLength={120} />
              <div className="flex flex-col gap-2">
                <label htmlFor="topic" className="text-sm font-semibold text-black">Breve descrição do problema a discutir</label>
                <textarea id="topic" rows={4} value={topic} onChange={(e) => setTopic(e.target.value)} required minLength={10} maxLength={600}
                  className="rounded-xl border-[1.5px] border-input bg-white px-4 py-3 text-base focus:border-roxo focus:outline-none focus:ring-2 focus:ring-roxo/30" />
                <span className="text-xs text-neutral-800">{topic.length}/600</span>
              </div>
              <Field id="code" label="Código do aluno (opcional)" placeholder="ESCO-2026-XXXX" value={studentCode} onChange={(e) => setStudentCode(e.target.value)} maxLength={64} />
              <Button type="submit" disabled={busy || !slotId}>Solicitar reunião</Button>
            </form>
          )}
        </Card>
      )}

      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">{isManager ? "Pedidos das escolas" : "Meus pedidos"}</h2>
        {meetings.length === 0 && <p className="text-sm text-neutral-800">Nenhum pedido ainda.</p>}
        <ul className="flex flex-col gap-3">
          {meetings.map((m) => (
            <li key={m.id} className="rounded-2xl border border-border p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{fmtShort(m.startsAt)}</strong>
                <Badge estado={STATUS_ESTADO[m.status]}>{STATUS_LABEL[m.status]}</Badge>
              </div>
              <p className="mt-1 text-neutral-800">
                {m.schoolName ? `${m.schoolName} · ` : ""}{m.professionalName}{m.studentCode ? ` · ${m.studentCode}` : ""}
              </p>
              <p className="mt-2">{m.topic}</p>
              {m.status === "confirmed" && m.meetUrl && (
                <a href={m.meetUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 font-semibold text-black underline">
                  <Video aria-hidden className="h-4 w-4" /> Entrar na sala (Google Meet)
                </a>
              )}
              {m.decisionNote && <p className="mt-2 text-neutral-800">Observação: {m.decisionNote}</p>}
              {isManager && m.status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <Button disabled={busy} onClick={() => decide(m.id, "confirm")}>Confirmar</Button>
                  <Button variant="outline" disabled={busy} onClick={() => decide(m.id, "decline")}>Recusar</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
