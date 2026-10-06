import type { TimelineEvent } from "@/lib/api";

const EVENT_LABELS: Record<string, string> = {
  "case:created": "Caso aberto",
  "case:closed": "Caso encerrado",
  "section:updated": "Seção atualizada",
  "section:completed": "Seção concluída",
  "journey:rascunho→enviado_re": "Avaliação enviada pela RE",
  "journey:enviado_re→revisao_medica": "Encaminhado para revisão médica",
  "journey:revisao_medica→delegado": "Especialistas delegados",
  "journey:delegado→retornado": "Todas as seções concluídas",
  "journey:retornado→encerrado": "Caso encerrado pelo médico",
  "journey:enviado_re→rascunho": "Devolvido à RE para revisão",
  "consolidated:read": "Consolidado consultado",
};

const ROLE_LABELS: Record<string, string> = {
  ppi: "RE/PpI",
  md1: "Médico(a)",
  specialist: "Especialista",
  admin_platform: "Admin",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

export function AuditTrail({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-tinta-500">
        Nenhum evento registrado ainda.
      </p>
    );
  }

  return (
    <ol aria-label="Trilha de eventos do caso" className="flex flex-col gap-0">
      {events.map((ev, i) => {
        const label = EVENT_LABELS[ev.event] ?? ev.event;
        const reason =
          ev.payload && typeof ev.payload.reason === "string"
            ? ev.payload.reason
            : null;
        const decision =
          ev.payload && typeof ev.payload.decision === "string"
            ? ev.payload.decision
            : null;
        const actorRole =
          ev.actorRole ? (ROLE_LABELS[ev.actorRole] ?? ev.actorRole) : null;
        const isLast = i === events.length - 1;

        return (
          <li key={ev.id} className="relative flex gap-3 pb-5">
            {/* linha vertical */}
            {!isLast && (
              <span
                aria-hidden="true"
                className="absolute left-[9px] top-5 h-full w-px bg-linha"
              />
            )}

            {/* ponto */}
            <span
              aria-hidden="true"
              className="mt-1 h-[18px] w-[18px] shrink-0 rounded-full border-2 border-roxo bg-white"
            />

            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-tinta-900">{label}</span>

              <span className="text-xs text-tinta-500">
                {formatDate(ev.createdAt)}
                {ev.actorName && (
                  <> · {ev.actorName}{actorRole && ` (${actorRole})`}</>
                )}
              </span>

              {reason && (
                <span className="mt-1 text-xs text-tinta-600 italic">"{reason}"</span>
              )}
              {decision && (
                <span className="mt-1 inline-flex w-fit rounded-full bg-ceu-100 px-2 py-0.5 text-xs font-semibold text-ceu-800">
                  Decisão: {decision}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
