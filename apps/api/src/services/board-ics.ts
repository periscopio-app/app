import { buildIcs } from "./ics";

export const BOARD_ICS_FILENAME = "reuniao-board-periscopio.ics";
const ICS_DOMAIN = "projetoperiscopio.com.br";

/**
 * Invitation file for a confirmed Board meeting. The text is deliberately generic: no topic, student code,
 * case id or school name goes into a file that leaves the system and can be forwarded.
 */
export function boardMeetingIcs(input: {
  meetingId: string;
  startsAt: Date;
  endsAt: Date;
  meetUrl: string;
  requesterEmail: string;
  organizerEmail: string;
  stamp?: Date;
}): string {
  return buildIcs({
    uid: `expert-meeting-${input.meetingId}@${ICS_DOMAIN}`,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    summary: "Reunião do Board de experts – Periscópio",
    description: `Reunião com o Board de experts do Periscópio.\nEntre pela sala: ${input.meetUrl}`,
    location: input.meetUrl,
    url: input.meetUrl,
    organizer: { email: input.organizerEmail, name: "Periscópio – Board de experts" },
    attendees: [{ email: input.requesterEmail }],
    stamp: input.stamp,
  });
}

/** Base64 attachment shape used by the e-mail sender. */
export function boardMeetingIcsAttachment(ics: string) {
  return { filename: BOARD_ICS_FILENAME, content: Buffer.from(ics, "utf8").toString("base64"), contentType: "text/calendar; charset=utf-8; method=REQUEST" };
}
