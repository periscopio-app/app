import { randomBytes } from "node:crypto";

const JITSI_BASE_URL = "https://meet.jit.si";

/** Matches only rooms created by generateJitsiRoomUrl (32 hex chars = 128 bits). */
export const JITSI_ROOM_PATTERN = /^https:\/\/meet\.jit\.si\/periscopio-[0-9a-f]{32}$/;

/**
 * Builds an unguessable public Jitsi room URL.
 * The room name carries no tenant, student, case or meeting identifier.
 */
export function generateJitsiRoomUrl(): string {
  return `${JITSI_BASE_URL}/periscopio-${randomBytes(16).toString("hex")}`;
}
