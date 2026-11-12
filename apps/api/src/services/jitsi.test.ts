import { test } from "node:test";
import assert from "node:assert/strict";
import { JITSI_ROOM_PATTERN, generateJitsiRoomUrl } from "./jitsi";

test("sala Jitsi: 128 bits aleatórios, sem identificador nenhum", () => {
  const url = generateJitsiRoomUrl();
  assert.match(url, JITSI_ROOM_PATTERN);
  assert.equal(url.length, "https://meet.jit.si/periscopio-".length + 32);
});

test("sala Jitsi: duas chamadas nunca repetem", () => {
  const set = new Set(Array.from({ length: 200 }, generateJitsiRoomUrl));
  assert.equal(set.size, 200);
});

test("o padrão recusa a sala antiga previsível (tenant + reunião)", () => {
  assert.doesNotMatch("https://meet.jit.si/periscopio-board-12345678-abcdef12", JITSI_ROOM_PATTERN);
});
