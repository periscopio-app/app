import { and, eq, inArray } from "drizzle-orm";
import { GLOBAL_PRIVILEGE_SCOPE, privilegeRoleGrants, privilegeUserGrants } from "@periscopio/shared";
import { db } from "../db/client";
import { ensureSchema } from "./schema-guard.service";
import {
  CAPABILITIES,
  CAPABILITY_BY_KEY,
  canonicalRole,
  decide,
  type CapabilityDef,
  type Decision,
  type GrantMaps,
} from "../security/capabilities";
import { isSuperAdminEmail } from "../security/roles";

export interface PrivilegeSubject {
  id: string;
  email: string;
  tenantId: string;
  role: string;
  specialty?: string | null;
}

const TTL_MS = 5_000;
const cache = new Map<string, { at: number; grants: GrantMaps }>();

/** Chamado após qualquer alteração de caixinha: a próxima requisição já enxerga a mudança. */
export function invalidatePrivilegeCache(): void {
  cache.clear();
}

export async function loadRoleGrants(tenantId: string, role: string): Promise<Map<string, boolean>> {
  await ensureSchema();
  const rows = await db
    .select({ capability: privilegeRoleGrants.capability, allowed: privilegeRoleGrants.allowed, scope: privilegeRoleGrants.scopeTenantId })
    .from(privilegeRoleGrants)
    .where(
      and(
        eq(privilegeRoleGrants.role, canonicalRole(role)),
        inArray(privilegeRoleGrants.scopeTenantId, [GLOBAL_PRIVILEGE_SCOPE, tenantId])
      )
    );
  const map = new Map<string, boolean>();
  for (const r of rows.filter((x) => x.scope === GLOBAL_PRIVILEGE_SCOPE)) map.set(r.capability, r.allowed);
  for (const r of rows.filter((x) => x.scope !== GLOBAL_PRIVILEGE_SCOPE)) map.set(r.capability, r.allowed); // tenant vence o global
  return map;
}

export async function loadUserGrants(userId: string): Promise<Map<string, boolean>> {
  await ensureSchema();
  const rows = await db
    .select({ capability: privilegeUserGrants.capability, allowed: privilegeUserGrants.allowed })
    .from(privilegeUserGrants)
    .where(eq(privilegeUserGrants.userId, userId));
  return new Map(rows.map((r) => [r.capability, r.allowed]));
}

export async function loadGrants(subject: PrivilegeSubject): Promise<GrantMaps> {
  const key = `${subject.tenantId}|${canonicalRole(subject.role)}|${subject.id}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.grants;
  const [role, user] = await Promise.all([loadRoleGrants(subject.tenantId, subject.role), loadUserGrants(subject.id)]);
  const grants = { role, user };
  cache.set(key, { at: Date.now(), grants });
  return grants;
}

export async function decideCapability(subject: PrivilegeSubject, key: string): Promise<Decision> {
  const cap = CAPABILITY_BY_KEY[key];
  if (!cap) return { allowed: false, source: "default" }; // capacidade desconhecida: negado
  if (isSuperAdminEmail(subject.email)) return { allowed: true, source: "locked" };
  const grants = cap.locked ? { role: new Map(), user: new Map() } : await loadGrants(subject);
  return decide(cap, subject, grants);
}

export async function can(subject: PrivilegeSubject, key: string): Promise<boolean> {
  return (await decideCapability(subject, key)).allowed;
}

/** Lista efetiva (o que a pessoa realmente pode): usada pelo menu e pelos botões da interface. */
export async function effectiveCapabilities(subject: PrivilegeSubject): Promise<string[]> {
  const grants = await loadGrants(subject);
  const superAdmin = isSuperAdminEmail(subject.email);
  return (CAPABILITIES as readonly CapabilityDef[])
    .filter((c) => superAdmin || decide(c, subject, c.locked ? { role: new Map(), user: new Map() } : grants).allowed)
    .map((c) => c.key);
}
