"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Bell, X, CheckCheck, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";

interface Notification {
  id: string;
  eventType: string;
  instrument: string | null;
  specialty: string | null;
  docType: string | null;
  studentCode: string | null;
  transient: boolean;
  readAt: string | null;
  createdAt: string;
  caseId: string | null;
}

const EVENT_LABELS: Record<string, (n: Notification) => string> = {
  "protocolo.enviado":         (n) => `Enviado ao médico. ${n.instrument ? `Instrumento: ${n.instrument.toUpperCase()}.` : ""} A versão ficou somente leitura.`,
  "protocolo.devolvido":       (n) => `O médico devolveu ${n.instrument ?? "o formulário"} do caso ${n.studentCode ?? ""}. O motivo está registrado.`,
  "adendo.enviado":            (n) => `Há um adendo em ${n.instrument ?? "instrumento"}, caso ${n.studentCode ?? ""}.`,
  "delegacao.criada":          (n) => `Você recebeu uma seção do caso ${n.studentCode ?? ""}: ${n.specialty ?? ""}.`,
  "delegacao.devolvida":       (n) => `${n.specialty ?? "Especialidade"} devolveu a seção do caso ${n.studentCode ?? ""}.`,
  "delegacao.todas_devolvidas":(n) => `Todas as seções do caso ${n.studentCode ?? ""} foram devolvidas. O consolidado está disponível.`,
  "pdf.vinculado":             (n) => `Novo documento vinculado ao caso ${n.studentCode ?? ""}: ${n.docType ?? ""}.`,
  "salvar.falhou":             () => "Não foi possível salvar. Seu rascunho continua nesta tela.",
};

function labelFor(n: Notification): string {
  const fn = EVENT_LABELS[n.eventType];
  return fn ? fn(n) : n.eventType;
}

const POLL_INTERVAL_MS = 30_000;

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api.get<{ notifications: Notification[]; unread: number }>("/api/notifications");
      setNotifications(data.notifications);
      setUnread(data.unread);
    } catch {
      // silently ignore — user may not be authenticated yet
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  async function markRead(id: string) {
    try {
      await api.post(`/api/notifications/${id}/read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnread((u) => Math.max(0, u - 1));
    } catch { /* ignore */ }
  }

  async function dismiss(id: string) {
    try {
      await api.post(`/api/notifications/${id}/dismiss`, {});
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnread((u) => {
        const wasUnread = notifications.find((n) => n.id === id && !n.readAt);
        return wasUnread ? Math.max(0, u - 1) : u;
      });
    } catch { /* ignore */ }
  }

  async function markAllRead() {
    try {
      await api.post("/api/notifications/read-all", {});
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      setUnread(0);
    } catch { /* ignore */ }
  }

  const visible = notifications.filter((n) => !n.transient || !n.readAt);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notificações${unread > 0 ? ` — ${unread} não lidas` : ""}`}
        aria-expanded={open}
        className="relative p-2 rounded-lg text-neutral-800 hover:text-black hover:bg-[#F0F9FC] transition"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-roxo-100 border border-roxo text-black text-[10px] font-bold flex items-center justify-center px-1"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Central de notificações"
          className="absolute right-0 top-full mt-2 w-80 max-h-96 flex flex-col bg-white rounded-2xl shadow-2xl border border-[#E1E9ED] z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E1E9ED]">
            <span className="text-sm font-bold text-black">Notificações</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-black hover:underline"
                  title="Marcar todas como lidas"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Tudo lido</span>
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-[#F0F9FC]" aria-label="Fechar">
                <X className="w-4 h-4 text-neutral-800" />
              </button>
            </div>
          </div>

          {/* List */}
          <div
            role="status"
            aria-live="polite"
            aria-label="Lista de notificações"
            className="overflow-y-auto flex-1"
          >
            {visible.length === 0 ? (
              <p className="text-xs text-neutral-800 text-center py-8">Nenhuma notificação pendente.</p>
            ) : (
              visible.map((notif) => (
                <div
                  key={notif.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-[#E1E9ED] last:border-0 transition ${
                    notif.readAt ? "opacity-60" : "bg-[#F8F4FF]"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-black leading-relaxed">{labelFor(notif)}</p>
                    <p className="text-[10px] text-neutral-800 mt-1">
                      {new Date(notif.createdAt).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {!notif.readAt && (
                      <button
                        onClick={() => markRead(notif.id)}
                        className="p-1 rounded hover:bg-[#E1E9ED] text-neutral-800"
                        aria-label="Marcar como lida"
                        title="Marcar como lida"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => dismiss(notif.id)}
                      className="p-1 rounded hover:bg-[#E1E9ED] text-neutral-800"
                      aria-label="Descartar"
                      title="Descartar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
