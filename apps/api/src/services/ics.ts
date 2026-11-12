/**
 * Minimal RFC 5545 (iCalendar) writer for one VEVENT, with no dependency.
 *
 * - Lines end with CRLF and are folded at 75 octets (never inside a multibyte character).
 * - TEXT values escape backslash, semicolon, comma and newline; control characters are dropped.
 * - Times are written in UTC (`...Z`), so no VTIMEZONE is needed and a DST rule can never shift the meeting.
 */
const CRLF = "\r\n";
const MAX_OCTETS = 75;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const UID_RE = /^[A-Za-z0-9@._-]{1,200}$/;
const HTTPS_URL_RE = /^https:\/\/[^\s\u0000-\u001F\u007F]+$/;
const MAILBOX_RE =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

/** Escapes an iCalendar TEXT value (RFC 5545 §3.3.11). */
export function escapeIcsText(value: string): string {
  return value
    .replace(CONTROL_CHARS, "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Parameter values may not contain DQUOTE or control characters; we always quote them. */
export function quoteIcsParam(value: string): string {
  const clean = value.replace(/[\u0000-\u001F\u007F"]/g, "").trim();
  return `"${clean}"`;
}

/** Returns the address when it is a plain, safe mailbox; otherwise null (so it is never written into the file). */
export function safeMailbox(email: string): string | null {
  const value = email.trim();
  return value.length <= 254 && MAILBOX_RE.test(value) ? value : null;
}

/** Folds one content line at 75 octets. Continuation lines start with a space (so they carry 74 octets of content). */
export function foldLine(line: string): string {
  if (Buffer.byteLength(line, "utf8") <= MAX_OCTETS) return line;
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  let limit = MAX_OCTETS;
  for (const ch of line) {
    // `for...of` walks code points, so a multibyte character or surrogate pair is never split.
    const size = Buffer.byteLength(ch, "utf8");
    if (currentBytes + size > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
      limit = MAX_OCTETS - 1;
    }
    current += ch;
    currentBytes += size;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

/** `2026-11-12T17:00:00.000Z` → `20261112T170000Z`. */
export function formatIcsUtc(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid date");
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export type IcsPerson = { email: string; name?: string };

export type IcsEvent = {
  uid: string;
  startsAt: Date;
  endsAt: Date;
  summary: string;
  description?: string;
  location?: string;
  /** https only; anything else is rejected. */
  url?: string;
  organizer?: IcsPerson;
  attendees?: IcsPerson[];
  stamp?: Date;
  sequence?: number;
};

function personLine(property: "ORGANIZER" | "ATTENDEE", person: IcsPerson): string | null {
  const mailbox = safeMailbox(person.email);
  if (!mailbox) return null;
  const params: string[] = [];
  if (property === "ATTENDEE") params.push("CUTYPE=INDIVIDUAL", "ROLE=REQ-PARTICIPANT", "PARTSTAT=NEEDS-ACTION", "RSVP=FALSE");
  if (person.name?.trim()) params.push(`CN=${quoteIcsParam(person.name)}`);
  return `${property}${params.length ? `;${params.join(";")}` : ""}:mailto:${mailbox}`;
}

/** Builds a single-event calendar invitation (METHOD:REQUEST). Throws on a malformed UID, URL or time range. */
export function buildIcs(event: IcsEvent): string {
  if (!UID_RE.test(event.uid)) throw new RangeError("Invalid UID");
  if (!(event.endsAt.getTime() > event.startsAt.getTime())) throw new RangeError("Event must end after it starts");
  if (event.url !== undefined && !HTTPS_URL_RE.test(event.url)) throw new RangeError("Invalid URL");

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Periscopio//Agenda do Board//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${formatIcsUtc(event.stamp ?? new Date())}`,
    `DTSTART:${formatIcsUtc(event.startsAt)}`,
    `DTEND:${formatIcsUtc(event.endsAt)}`,
    `SEQUENCE:${Math.max(0, Math.trunc(event.sequence ?? 0))}`,
    "STATUS:CONFIRMED",
    `SUMMARY:${escapeIcsText(event.summary)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.url) lines.push(`URL:${event.url}`);
  if (event.organizer) {
    const line = personLine("ORGANIZER", event.organizer);
    if (line) lines.push(line);
  }
  for (const attendee of event.attendees ?? []) {
    const line = personLine("ATTENDEE", attendee);
    if (line) lines.push(line);
  }
  lines.push(
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Reunião do Board de experts em 30 minutos",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  );
  return lines.map(foldLine).join(CRLF) + CRLF;
}
