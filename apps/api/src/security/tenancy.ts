import type { Actor } from "./actor";

export function canAccessTenant(actor: Actor, tenantId: string) {
  return actor.role === "admin_platform" || actor.tenantId === tenantId;
}

export function canAccessSchool(
  actor: Actor,
  tenantId: string,
  schoolId: string | null
) {
  if (!canAccessTenant(actor, tenantId)) return false;
  return actor.role === "admin_platform" || !actor.schoolId || actor.schoolId === schoolId;
}
