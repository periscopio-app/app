/** Validação do pedido de reunião com o Board. Sem dados identificáveis do aluno. */
export const TOPIC_MIN = 10;
export const TOPIC_MAX = 600;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CPF_RE = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
const PHONE_RE = /(\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}-?\d{4}/;
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const MEET_RE = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

export const MEETING_NOTICE =
  "Não inclua nome ou dados pessoais do aluno. Use apenas o código do aluno (pseudônimo).";

export type MeetingInput = { slotId: string; professionalName: string; topic: string; studentCode: string | null };

export function validateMeetingRequest(
  body: unknown,
): { ok: true; value: MeetingInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Corpo inválido." };
  const b = body as Record<string, unknown>;
  if (typeof b.slotId !== "string" || !UUID_RE.test(b.slotId)) return { ok: false, error: "Horário inválido." };
  const name = typeof b.professionalName === "string" ? b.professionalName.trim() : "";
  if (name.length < 3 || name.length > 120) return { ok: false, error: "Informe o nome do profissional (3 a 120 caracteres)." };
  const topic = typeof b.topic === "string" ? b.topic.trim() : "";
  if (topic.length < TOPIC_MIN) return { ok: false, error: `Descreva o problema em pelo menos ${TOPIC_MIN} caracteres.` };
  if (topic.length > TOPIC_MAX) return { ok: false, error: `A descrição deve ter no máximo ${TOPIC_MAX} caracteres.` };
  if (CPF_RE.test(topic) || PHONE_RE.test(topic) || EMAIL_RE.test(topic)) {
    return { ok: false, error: `A descrição parece conter dado pessoal (CPF, telefone ou e-mail). ${MEETING_NOTICE}` };
  }
  let studentCode: string | null = null;
  if (b.studentCode !== undefined && b.studentCode !== null && b.studentCode !== "") {
    if (typeof b.studentCode !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(b.studentCode.trim())) {
      return { ok: false, error: "Código do aluno inválido." };
    }
    studentCode = b.studentCode.trim();
  }
  return { ok: true, value: { slotId: b.slotId, professionalName: name, topic, studentCode } };
}

export function validateMeetUrl(url: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof url !== "string" || !MEET_RE.test(url.trim())) {
    return { ok: false, error: "Informe um link do Google Meet no formato https://meet.google.com/abc-defg-hij." };
  }
  return { ok: true, value: url.trim() };
}

export function validateSlotRange(
  startsAt: unknown,
  endsAt: unknown,
  now = new Date(),
): { ok: true; start: Date; end: Date } | { ok: false; error: string } {
  const start = new Date(String(startsAt));
  const end = new Date(String(endsAt));
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { ok: false, error: "Data/hora inválida." };
  if (start <= now) return { ok: false, error: "O horário precisa estar no futuro." };
  const mins = (end.getTime() - start.getTime()) / 60000;
  if (mins < 15 || mins > 240) return { ok: false, error: "A duração deve ficar entre 15 e 240 minutos." };
  return { ok: true, start, end };
}
