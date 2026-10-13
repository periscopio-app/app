import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, ilike, like, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import {
  auditLogs,
  GLOBAL_PRIVILEGE_SCOPE,
  privilegeRoleGrants,
  privilegeUserGrants,
  schools,
  tenants,
  users,
} from "@periscopio/shared";
import { requireActor, requireCapability } from "../security/actor";
import {
  CAPABILITIES,
  CAPABILITY_BY_KEY,
  CAPABILITY_GROUP_LABELS,
  CONFIGURABLE_ROLES,
  CONFIGURABLE_ROLE_LABELS,
  canonicalRole,
  decide,
  defaultAllowed,
  type CapabilityDef,
  type ConfigurableRole,
} from "../security/capabilities";
import { effectiveCapabilities, invalidatePrivilegeCache, loadRoleGrants, loadUserGrants } from "../services/privilege.service";
import { recordAudit } from "../services/audit.service";
import { ensureSchema } from "../services/schema-guard.service";

const uuid = z.string().uuid();
const scopeSchema = z.union([z.literal("global"), uuid]);

const tri = z.union([z.boolean(), z.null()]); // true = marcado, false = desmarcado, null = voltar ao padrão

const roleChangeSchema = z.object({
  scope: scopeSchema.default("global"),
  role: z.enum(CONFIGURABLE_ROLES),
  capability: z.string().min(3).max(80),
  allowed: tri,
});

const rolePutSchema = z.object({
  changes: z.array(roleChangeSchema).min(1).max(200),
  /** Obrigatório ao LIGAR uma capacidade sensível (a tela pergunta "tem certeza?"). */
  confirmSensitive: z.boolean().optional(),
  reason: z.string().max(300).optional(),
});

const userPutSchema = z.object({
  capability: z.string().min(3).max(80),
  allowed: tri,
  reason: z.string().max(300).optional(),
  confirmSensitive: z.boolean().optional(),
});

function scopeId(scope: string): string {
  return scope === "global" ? GLOBAL_PRIVILEGE_SCOPE : scope;
}

function defaultCell(cap: CapabilityDef, role: ConfigurableRole): { allowed: boolean; partial: boolean } {
  if (cap.defaultSpecialties && role === "specialist") {
    return { allowed: false, partial: true }; // só algumas especialidades
  }
  return { allowed: defaultAllowed(cap, role), partial: false };
}

export async function privilegesRoutes(app: FastifyInstance) {
  /** Catálogo: perfis (colunas), grupos e capacidades (linhas) com o padrão de fábrica. */
  app.get("/api/admin/privileges/catalog", async (request, reply) => {
    const actor = await requireCapability(request, reply, "privileges.manage");
    if (!actor) return;
    const tenantRows = await db.select({ id: tenants.id, name: tenants.name }).from(tenants).orderBy(asc(tenants.name));
    return {
      roles: CONFIGURABLE_ROLES.map((r) => ({ key: r, label: CONFIGURABLE_ROLE_LABELS[r] })),
      groups: Object.entries(CAPABILITY_GROUP_LABELS).map(([key, label]) => ({ key, label })),
      capabilities: (CAPABILITIES as readonly CapabilityDef[]).map((c) => ({
        key: c.key,
        group: c.group,
        label: c.label,
        description: c.description,
        sensitive: !!c.sensitive,
        locked: !!c.locked,
        defaultSpecialties: c.defaultSpecialties ?? null,
        defaults: Object.fromEntries(CONFIGURABLE_ROLES.map((r) => [r, defaultCell(c, r)])),
      })),
      tenants: tenantRows,
    };
  });

  /** Matriz de um escopo (global ou uma rede): padrão, marcação do Admin e efeito final por perfil. */
  app.get("/api/admin/privileges/matrix", async (request, reply) => {
    const actor = await requireCapability(request, reply, "privileges.manage");
    if (!actor) return;
    await ensureSchema();
    const scope = scopeSchema.safeParse((request.query as { scope?: string }).scope ?? "global");
    if (!scope.success) return reply.status(400).send({ error: "Escopo inválido" });

    const rows = await db
      .select({ role: privilegeRoleGrants.role, capability: privilegeRoleGrants.capability, allowed: privilegeRoleGrants.allowed })
      .from(privilegeRoleGrants)
      .where(eq(privilegeRoleGrants.scopeTenantId, scopeId(scope.data)));
    const overrides: Record<string, Record<string, boolean>> = {};
    for (const r of rows) (overrides[r.capability] ??= {})[r.role] = r.allowed;

    // Quando o escopo é uma rede, a regra global também conta como base.
    let globalOverrides: Record<string, Record<string, boolean>> = {};
    if (scope.data !== "global") {
      const g = await db
        .select({ role: privilegeRoleGrants.role, capability: privilegeRoleGrants.capability, allowed: privilegeRoleGrants.allowed })
        .from(privilegeRoleGrants)
        .where(eq(privilegeRoleGrants.scopeTenantId, GLOBAL_PRIVILEGE_SCOPE));
      for (const r of g) (globalOverrides[r.capability] ??= {})[r.role] = r.allowed;
    }

    return {
      scope: scope.data,
      cells: (CAPABILITIES as readonly CapabilityDef[]).map((c) => ({
        capability: c.key,
        byRole: Object.fromEntries(
          CONFIGURABLE_ROLES.map((r) => {
            const def = defaultCell(c, r);
            const own = overrides[c.key]?.[r];
            const inherited = globalOverrides[c.key]?.[r];
            const effective = c.locked ? r === "admin_platform" : own ?? inherited ?? def.allowed;
            return [r, { default: def.allowed, partial: def.partial && own === undefined && inherited === undefined, override: own ?? null, inherited: inherited ?? null, effective }];
          })
        ),
      })),
    };
  });

  /** Marca / desmarca caixinhas por perfil (lote). null = volta ao padrão de fábrica. */
  app.put("/api/admin/privileges/roles", async (request, reply) => {
    const actor = await requireCapability(request, reply, "privileges.manage");
    if (!actor) return;
    await ensureSchema();

    const parsed = rolePutSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Dados inválidos", issues: parsed.error.issues.slice(0, 5) });
    const { changes, confirmSensitive, reason } = parsed.data;

    for (const ch of changes) {
      const cap = CAPABILITY_BY_KEY[ch.capability];
      if (!cap) return reply.status(400).send({ error: `Capacidade desconhecida: ${ch.capability}` });
      if (cap.locked) return reply.status(400).send({ error: `"${cap.label}" é exclusiva do Administrador Master e não pode ser alterada.` });
    }
    const sensitiveOn = changes.filter((ch) => ch.allowed === true && CAPABILITY_BY_KEY[ch.capability]?.sensitive && !defaultAllowed(CAPABILITY_BY_KEY[ch.capability]!, ch.role));
    if (sensitiveOn.length > 0 && !confirmSensitive) {
      return reply.status(409).send({
        error: "Estas caixinhas liberam dado sensível a um perfil que não o via por padrão. Confirme para continuar.",
        needsConfirmation: true,
        sensitive: sensitiveOn.map((c) => ({ role: c.role, capability: c.capability })),
      });
    }

    for (const ch of changes) {
      const scope = scopeId(ch.scope);
      if (ch.allowed === null) {
        await db
          .delete(privilegeRoleGrants)
          .where(and(eq(privilegeRoleGrants.scopeTenantId, scope), eq(privilegeRoleGrants.role, ch.role), eq(privilegeRoleGrants.capability, ch.capability)));
      } else {
        await db
          .insert(privilegeRoleGrants)
          .values({ scopeTenantId: scope, role: ch.role, capability: ch.capability, allowed: ch.allowed, updatedBy: actor.id.startsWith("0000") ? null : actor.id })
          .onConflictDoUpdate({
            target: [privilegeRoleGrants.scopeTenantId, privilegeRoleGrants.role, privilegeRoleGrants.capability],
            set: { allowed: ch.allowed, updatedBy: actor.id.startsWith("0000") ? null : actor.id, updatedAt: new Date() },
          });
      }
      await recordAudit(
        {
          tenantId: actor.tenantId,
          userId: actor.id,
          userEmail: actor.email,
          action: CAPABILITY_BY_KEY[ch.capability]?.sensitive ? "privilege.role_set.sensitive" : "privilege.role_set",
          entityType: "privilege_role_grant",
          payload: { scope: ch.scope, role: ch.role, capability: ch.capability, to: ch.allowed === null ? "padrao" : ch.allowed, reason: reason ?? null },
        },
        request
      );
    }
    invalidatePrivilegeCache();
    return { success: true, changed: changes.length };
  });

  /** Busca pessoas para a aba "por pessoa". */
  app.get("/api/admin/privileges/users", async (request, reply) => {
    const actor = await requireCapability(request, reply, "privileges.manage");
    if (!actor) return;
    const { q, tenantId } = request.query as { q?: string; tenantId?: string };
    const term = q?.trim();
    const where = [
      tenantId && z.string().uuid().safeParse(tenantId).success ? eq(users.tenantId, tenantId) : undefined,
      term ? or(ilike(users.name, `%${term.replace(/[%_]/g, "")}%`), ilike(users.email, `%${term.replace(/[%_]/g, "")}%`)) : undefined,
    ].filter(Boolean) as ReturnType<typeof eq>[];
    const list = await db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role, specialty: users.specialty, schoolName: schools.name })
      .from(users)
      .leftJoin(schools, eq(users.schoolId, schools.id))
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(users.name))
      .limit(100);
    const overrides = await db.select({ userId: privilegeUserGrants.userId }).from(privilegeUserGrants);
    const count = new Map<string, number>();
    for (const o of overrides) count.set(o.userId, (count.get(o.userId) ?? 0) + 1);
    return { users: list.map((u) => ({ ...u, roleLabel: CONFIGURABLE_ROLE_LABELS[canonicalRole(u.role)], overrides: count.get(u.id) ?? 0 })) };
  });

  /** Situação completa de UMA pessoa: padrão, regra do perfil, exceção dela e efeito final. */
  app.get("/api/admin/privileges/users/:userId", async (request, reply) => {
    const actor = await requireCapability(request, reply, "privileges.manage");
    if (!actor) return;
    const { userId } = request.params as { userId: string };
    if (!uuid.safeParse(userId).success) return reply.status(400).send({ error: "Usuário inválido" });
    const [u] = await db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role, specialty: users.specialty, tenantId: users.tenantId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!u) return reply.status(404).send({ error: "Usuário não encontrado" });
    const [roleGrants, userGrants] = await Promise.all([loadRoleGrants(u.tenantId, u.role), loadUserGrants(u.id)]);
    return {
      user: { ...u, roleLabel: CONFIGURABLE_ROLE_LABELS[canonicalRole(u.role)] },
      capabilities: (CAPABILITIES as readonly CapabilityDef[]).map((c) => {
        const d = decide(c, u, { role: roleGrants, user: userGrants });
        return {
          key: c.key,
          group: c.group,
          label: c.label,
          description: c.description,
          sensitive: !!c.sensitive,
          locked: !!c.locked,
          default: defaultAllowed(c, u.role, u.specialty),
          roleOverride: roleGrants.get(c.key) ?? null,
          userOverride: userGrants.get(c.key) ?? null,
          effective: d.allowed,
          source: d.source,
        };
      }),
    };
  });

  /** Exceção por pessoa: true = libera só para ela, false = bloqueia só para ela, null = remove a exceção. */
  app.put("/api/admin/privileges/users/:userId", async (request, reply) => {
    const actor = await requireCapability(request, reply, "privileges.manage");
    if (!actor) return;
    await ensureSchema();
    const { userId } = request.params as { userId: string };
    if (!uuid.safeParse(userId).success) return reply.status(400).send({ error: "Usuário inválido" });
    const parsed = userPutSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Dados inválidos" });
    const { capability, allowed, reason, confirmSensitive } = parsed.data;

    const cap = CAPABILITY_BY_KEY[capability];
    if (!cap) return reply.status(400).send({ error: `Capacidade desconhecida: ${capability}` });
    if (cap.locked) return reply.status(400).send({ error: `"${cap.label}" é exclusiva do Administrador Master e não pode ser alterada.` });

    const [target] = await db.select({ id: users.id, role: users.role, specialty: users.specialty, email: users.email, tenantId: users.tenantId }).from(users).where(eq(users.id, userId)).limit(1);
    if (!target) return reply.status(404).send({ error: "Usuário não encontrado" });

    if (allowed === true && cap.sensitive && !defaultAllowed(cap, target.role, target.specialty) && !confirmSensitive) {
      return reply.status(409).send({
        error: "Esta caixinha libera dado sensível a quem não o via por padrão. Confirme para continuar.",
        needsConfirmation: true,
        sensitive: [{ userId, capability }],
      });
    }

    if (allowed === null) {
      await db.delete(privilegeUserGrants).where(and(eq(privilegeUserGrants.userId, userId), eq(privilegeUserGrants.capability, capability)));
    } else {
      const by = actor.id.startsWith("0000") ? null : actor.id;
      await db
        .insert(privilegeUserGrants)
        .values({ userId, capability, allowed, reason: reason ?? null, updatedBy: by })
        .onConflictDoUpdate({
          target: [privilegeUserGrants.userId, privilegeUserGrants.capability],
          set: { allowed, reason: reason ?? null, updatedBy: by, updatedAt: new Date() },
        });
    }
    await recordAudit(
      {
        tenantId: target.tenantId,
        userId: actor.id,
        userEmail: actor.email,
        action: cap.sensitive ? "privilege.user_set.sensitive" : "privilege.user_set",
        entityType: "privilege_user_grant",
        entityId: userId,
        payload: { capability, to: allowed === null ? "padrao" : allowed, reason: reason ?? null },
      },
      request
    );
    invalidatePrivilegeCache();
    return { success: true };
  });

  /** Últimas alterações de privilégio (quem mudou o quê). */
  app.get("/api/admin/privileges/audit", async (request, reply) => {
    const actor = await requireCapability(request, reply, "privileges.manage");
    if (!actor) return;
    const rows = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        userEmail: auditLogs.userEmail,
        payload: auditLogs.payload,
        entityId: auditLogs.entityId,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(like(auditLogs.action, "privilege.%"))
      .orderBy(desc(auditLogs.createdAt))
      .limit(60);
    return { events: rows };
  });

  /** O que EU posso (usado pelo menu e pelos botões; também devolvido em /api/me). */
  app.get("/api/me/capabilities", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;
    return { capabilities: await effectiveCapabilities(actor) };
  });
}
