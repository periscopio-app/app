import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildIcs, escapeIcsText, foldLine, formatIcsUtc, quoteIcsParam, safeMailbox } from "./ics";
import { boardMeetingIcs } from "./board-ics";

const octets = (s: string) => Buffer.byteLength(s, "utf8");
const base = { uid: "expert-meeting-abc@projetoperiscopio.com.br", startsAt: new Date("2026-11-12T17:00:00.000Z"), endsAt: new Date("2026-11-12T18:00:00.000Z"), summary: "Teste", stamp: new Date("2026-11-08T12:00:00.000Z") };

describe("ics: escape de TEXT", () => {
  test("escapa vírgula, ponto e vírgula, barra invertida e quebra de linha", () => {
    assert.equal(escapeIcsText("a,b;c\\d\ne\r\nf"), "a\\,b\;c\\\\d\\ne\\nf");
  });
  test("remove caracteres de controle", () => {
    assert.equal(escapeIcsText("a\u0000b\u0007c\u007Fd"), "abcd");
  });
  test("texto hostil não consegue abrir linha nova no arquivo", () => {
    const ics = buildIcs({ ...base, summary: "x\r\nATTENDEE:mailto:evil@x.com\r\nBEGIN:VEVENT", description: "y\nEND:VCALENDAR" });
    const lines = ics.split("\r\n");
    assert.equal(lines.filter((l) => l.startsWith("ATTENDEE")).length, 0);
    assert.equal(lines.filter((l) => l === "BEGIN:VEVENT").length, 1);
    assert.equal(lines.filter((l) => l === "END:VCALENDAR").length, 1);
  });
});

describe("ics: dobra de linha em 75 octetos", () => {
  test("linha curta não muda", () => {
    assert.equal(foldLine("SUMMARY:curto"), "SUMMARY:curto");
  });
  test("linha ASCII longa: nenhuma linha passa de 75 octetos e desdobrar devolve o original", () => {
    const line = "DESCRIPTION:" + "a".repeat(300);
    const folded = foldLine(line);
    const parts = folded.split("\r\n");
    assert.ok(parts.length > 1);
    for (const p of parts) assert.ok(octets(p) <= 75, `${octets(p)} octetos`);
    assert.ok(parts.slice(1).every((p) => p.startsWith(" ")));
    assert.equal(folded.replace(/\r\n /g, ""), line);
  });
  test("multibyte nunca é cortado no meio e o limite vale em octetos", () => {
    const line = "DESCRIPTION:" + "ção–é😀".repeat(40);
    const folded = foldLine(line);
    for (const p of folded.split("\r\n")) assert.ok(octets(p) <= 75, `${octets(p)} octetos`);
    assert.equal(folded.replace(/\r\n /g, ""), line);
    assert.ok(!folded.includes("�"));
  });
  test("exatamente 75 octetos não dobra; 76 dobra", () => {
    assert.equal(foldLine("A".repeat(75)).includes("\r\n"), false);
    assert.equal(foldLine("A".repeat(76)).includes("\r\n"), true);
  });
});

describe("ics: UTC e estrutura", () => {
  test("converte para UTC (Brasília UTC-3 → +3h)", () => {
    assert.equal(formatIcsUtc(new Date("2026-11-12T14:00:00-03:00")), "20261112T170000Z");
    assert.equal(formatIcsUtc(new Date("2026-11-12T23:30:00-03:00")), "20261113T023000Z");
  });
  test("data inválida lança", () => {
    assert.throws(() => formatIcsUtc(new Date("x")), RangeError);
  });
  test("estrutura: CRLF, METHOD:REQUEST, UID estável, horários em UTC", () => {
    const a = buildIcs(base);
    const b = buildIcs(base);
    assert.equal(a, b);
    assert.ok(a.endsWith("\r\n"));
    assert.ok(!/[^\r]\n/.test(a), "só CRLF");
    for (const l of ["BEGIN:VCALENDAR", "VERSION:2.0", "METHOD:REQUEST", `UID:${base.uid}`, "DTSTART:20261112T170000Z", "DTEND:20261112T180000Z", "DTSTAMP:20261108T120000Z", "END:VCALENDAR"]) {
      assert.ok(a.split("\r\n").includes(l), l);
    }
    assert.ok(!a.includes("VTIMEZONE"));
  });
  test("UID, URL e intervalo inválidos são recusados", () => {
    assert.throws(() => buildIcs({ ...base, uid: "a b\r\nX:y" }), RangeError);
    assert.throws(() => buildIcs({ ...base, url: "javascript:alert(1)" }), RangeError);
    assert.throws(() => buildIcs({ ...base, url: "http://insecure.example" }), RangeError);
    assert.throws(() => buildIcs({ ...base, endsAt: base.startsAt }), RangeError);
  });
  test("participante: e-mail inseguro é descartado; nome é sempre entre aspas e sem aspas internas", () => {
    assert.equal(safeMailbox("ok@dominio.com.br"), "ok@dominio.com.br");
    assert.equal(safeMailbox("a@b.com\r\nX:y"), null);
    assert.equal(safeMailbox("a b@c.com"), null);
    assert.equal(safeMailbox("a@b.com;c@d.com"), null);
    assert.equal(quoteIcsParam('Ana "A"; x:y\r\n'), '"Ana A; x:y"');
    const ics = buildIcs({ ...base, attendees: [{ email: "ok@dominio.com.br", name: 'Ana "x"' }, { email: "ruim\r\n@x.com" }] });
    assert.equal(ics.split("\r\n").filter((l) => l.startsWith("ATTENDEE")).length, 1);
  });
  test("o convite do Board é genérico: sem tema, código de aluno ou escola", () => {
    const ics = boardMeetingIcs({
      meetingId: "11111111-2222-3333-4444-555555555555",
      startsAt: base.startsAt,
      endsAt: base.endsAt,
      meetUrl: "https://meet.jit.si/periscopio-0123456789abcdef0123456789abcdef",
      requesterEmail: "re@teste.local",
      organizerEmail: "equipe@projetoperiscopio.com.br",
    });
    const unfolded = ics.replace(/\r\n /g, "");
    assert.ok(unfolded.includes("UID:expert-meeting-11111111-2222-3333-4444-555555555555@projetoperiscopio.com.br"));
    assert.ok(unfolded.includes("mailto:re@teste.local"));
    assert.ok(unfolded.includes("URL:https://meet.jit.si/periscopio-0123456789abcdef0123456789abcdef"));
    assert.ok(!/ESCO|escola|Escola/.test(unfolded));
    for (const line of ics.split("\r\n")) assert.ok(octets(line) <= 75);
  });
});
