import type { Actor } from "./actor";
import { isSuperAdminEmail } from "./roles";

export function canAccessTenant(actor: Actor, tenantId: string) {
  if (actor.role === "admin_platform" || actor.role === "adm_master" || isSuperAdminEmail(actor.email)) {
    return true;
  }
  return actor.tenantId === tenantId;
}

export function canAccessSchool(
  actor: Actor,
  tenantId: string,
  schoolId: string | null
) {
  if (!canAccessTenant(actor, tenantId)) return false;
  if (actor.role === "admin_platform" || actor.role === "adm_master" || isSuperAdminEmail(actor.email)) {
    return true;
  }
  return !actor.schoolId || actor.schoolId === schoolId;
}

