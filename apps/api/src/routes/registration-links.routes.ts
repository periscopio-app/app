import type { FastifyInstance } from "fastify";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { z } from "zod";
import { db } from "../db/client";
import { ALLOWED_SPECIALTIES, onboardingInvites, schools, tenants, users } from "@periscopio/shared";
import { requireCapability } from "../security/actor";
import { rejectIfLimited } from "../security/rate-limit";
import { recordAudit } from "../services/audit.service";
import { upsertCredential } from "../auth/credentials";
import { incr } from "../observability/metrics";

/**
 * Link de cadastro unitário: o administrador gera um link por profissional, envia por onde quiser (WhatsApp, e-mail
 * pessoal) e a pessoa abre, informa o próprio e-mail (qualquer domínio) e cria a senha. Cada link vale para UM cadastro
 * e já define instância (tenant), perfil e especialidade, então a pessoa não escolhe nada disso.
 *
 * Segurança: quem tem o link pode cadastrar um e-mail de sua escolha, então o link é segredo (32 bytes aleatórios),
 * vale para um uso e expira. Um e-mail que já tem conta é recusado: o link nunca redefine a senha de outra pessoa.
 */
const TYPE = "professional_self";
const ROLES_BY_LINK = ["specialist", "md1", "ppi"] as const;
type LinkRole = (typeof ROLES_BY_LINK)[number];
const EXPIRY_DAYS_DEFAULT = 7;
const EXPIRY_DAYS_MAX = 30;

const createSchema = z.object({
  tenantId: z.string().uuid("Escolha a instância (município)."),
  role: z.enum(ROLES_BY_LINK, { error: "Perfil inválido para o link de cadastro." }),
  specialty: z.enum(ALLOWED_SPECIALTIES).optional(),
  schoolId: z.string().uuid().optional(),
  label: z.string().trim().max(120).optional(),
  email: z.string().trim().toLowerCase().email().max(255).optional(),
  expiresInDays: z.number().int().min(1).max(EXPIRY_DAYS_MAX).optional(),
});

const registerSchema = z.object({
  token: z.string().min(20).max(200),
  name: z.string().trim().min(3, "Informe o nome completo.").max(200),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(255),
  password: z.string().min(8, "A senha deve ter entre 8 e 128 caracteres.").max(128, "A senha deve ter entre 8 e 128 caracteres."),
  phone: z.string().trim().max(30).optional(),
  classCode: z.string().trim().max(50).optional(),
  acceptedTerms: z.literal(true, { error: "Aceite os termos de uso e a política de privacidade para continuar." }),
});

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function linkUrl(token: string): string {
  return `${appUrl()}/cadastro?token=${encodeURIComponent(token)}`;
}

/** O médico é sempre a especialidade "medicina"; o RE (ppi) não tem especialidade clínica. */
function resolveSpecialty(role: LinkRole, specialty: string | undefined): { ok: true; specialty: string | null } | { ok: false; error: string } {
  if (role === "md1") return { ok: true, specialty: "medicina" };
  if (role === "ppi") return { ok: true, specialty: null };
  if (!specialty) return { ok: false, error: "Escolha a especialidade do profissional." };
  if (specialty === "medicina") return { ok: false, error: "Médico usa o perfil Médico (md1), não o de especialista." };
  return { ok: true, specialty };
}

async function emailAlreadyHasAccount(email: string): Promise<boolean> {
  const [inPublic] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
  if (inPublic) return true;
  const client = await (db as any).$client;
  if (!client?.query) return false;
  const res = await client.query(`SELECT 1 FROM neon_auth."user" WHERE lower(email) = $1 LIMIT 1`, [email]);
  return res.rows.length > 0;
}

type InviteState = "valid" | "used" | "expired" | "missing";

async function findLink(token: string) {
  const [invite] = await db
    .select()
    .from(onboardingInvites)
    .where(and(eq(onboardingInvites.token, token), eq(onboardingInvites.type, TYPE)))
    .limit(1);
  if (!invite) return { invite: null, state: "missing" as InviteState };
  if (invite.usedAt) return { invite, state: "used" as InviteState };
  if (new Date() > new Date(invite.expiresAt)) return { invite, state: "expired" as InviteState };
  return { invite, state: "valid" as InviteState };
}

const STATE_MESSAGE: Record<Exclude<InviteState, "valid">, string> = {
  missing: "Link de cadastro não encontrado. Confira se copiou o endereço inteiro.",
  used: "Este link já foi utilizado. Se você já se cadastrou, entre com o seu e-mail e senha.",
  expired: "Este link expirou. Peça um novo a quem o enviou.",
};

export async function registrationLinkRoutes(app: FastifyInstance) {
  /** Gera o link. */
  app.post("/api/admin/registration-links", async (request, reply) => {
    const actor = await requireCapability(request, reply, "users.manage");
    if (!actor) return;

    const parsed = createSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.status(400);
      return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }
    const body = parsed.data;

    const spec = resolveSpecialty(body.role, body.specialty);
    if (!spec.ok) {
      reply.status(400);
      return { error: spec.error };
    }

    const [tenant] = await db.select({ id: tenants.id, name: tenants.name }).from(tenants).where(eq(tenants.id, body.tenantId)).limit(1);
    if (!tenant) {
      reply.status(400);
      return { error: "Instância (município) não encontrada." };
    }

    if (body.role === "ppi" && !body.schoolId) {
      reply.status(400);
      return { error: "O RE atua em uma escola: escolha a escola." };
    }
    if (body.schoolId) {
      const [school] = await db.select({ tenantId: schools.tenantId }).from(schools).where(eq(schools.id, body.schoolId)).limit(1);
      if (!school || school.tenantId !== tenant.id) {
        reply.status(400);
        return { error: "A escola escolhida não pertence a esta instância." };
      }
    }

    if (body.email && (await emailAlreadyHasAccount(body.email))) {
      reply.status(409);
      return { error: "Este e-mail já tem cadastro. Use o botão “Enviar acesso” na lista de usuários." };
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + (body.expiresInDays ?? EXPIRY_DAYS_DEFAULT) * 24 * 60 * 60 * 1000);
    const [invite] = await db
      .insert(onboardingInvites)
      .values({
        tenantId: tenant.id,
        schoolId: body.schoolId ?? null,
        email: body.email ?? null,
        token,
        type: TYPE,
        role: body.role,
        specialty: spec.specialty,
        label: body.label || null,
        expiresAt,
      })
      .returning();

    await recordAudit(
      { tenantId: tenant.id, userId: actor.id, userEmail: actor.email, action: "registration_link:created", entityType: "onboarding_invites", entityId: invite.id, payload: { role: body.role, specialty: spec.specialty, schoolId: body.schoolId ?? null, expiresAt: expiresAt.toISOString() } },
      request,
    );
    incr("registration_links_created");

    return { id: invite.id, url: linkUrl(token), expiresAt, tenantName: tenant.name };
  });

  /** Lista os links (os pendentes trazem o endereço para copiar de novo). */
  app.get("/api/admin/registration-links", async (request, reply) => {
    const actor = await requireCapability(request, reply, "users.manage");
    if (!actor) return;

    const rows = await db
      .select({
        id: onboardingInvites.id,
        token: onboardingInvites.token,
        label: onboardingInvites.label,
        role: onboardingInvites.role,
        specialty: onboardingInvites.specialty,
        email: onboardingInvites.email,
        expiresAt: onboardingInvites.expiresAt,
        usedAt: onboardingInvites.usedAt,
        createdAt: onboardingInvites.createdAt,
        tenantName: tenants.name,
        schoolName: schools.name,
      })
      .from(onboardingInvites)
      .leftJoin(tenants, eq(onboardingInvites.tenantId, tenants.id))
      .leftJoin(schools, eq(onboardingInvites.schoolId, schools.id))
      .where(eq(onboardingInvites.type, TYPE))
      .orderBy(desc(onboardingInvites.createdAt))
      .limit(100);

    const now = new Date();
    return {
      links: rows.map(({ token, ...r }) => {
        const status = r.usedAt ? "used" : now > new Date(r.expiresAt) ? "expired" : "pending";
        return { ...r, status, url: status === "pending" ? linkUrl(token) : null };
      }),
    };
  });

  /** Revoga um link ainda não usado (expira na hora; o registro fica para o histórico). */
  app.post("/api/admin/registration-links/:id/revoke", async (request, reply) => {
    const actor = await requireCapability(request, reply, "users.manage");
    if (!actor) return;
    const { id } = request.params as { id: string };
    if (!z.string().uuid().safeParse(id).success) {
      reply.status(404);
      return { error: "Link não encontrado." };
    }

    const [revoked] = await db
      .update(onboardingInvites)
      .set({ expiresAt: new Date() })
      .where(and(eq(onboardingInvites.id, id), eq(onboardingInvites.type, TYPE), isNull(onboardingInvites.usedAt), gt(onboardingInvites.expiresAt, new Date())))
      .returning();
    if (!revoked) {
      reply.status(404);
      return { error: "Link não encontrado, já usado ou já expirado." };
    }
    await recordAudit(
      { tenantId: revoked.tenantId, userId: actor.id, userEmail: actor.email, action: "registration_link:revoked", entityType: "onboarding_invites", entityId: revoked.id },
      request,
    );
    return { success: true };
  });

  /** Público: o que a pessoa vê ao abrir o link (sem dados de quem foi convidado além do que ela mesma vai confirmar). */
  app.get("/api/onboarding/registration-link", async (request, reply) => {
    if (rejectIfLimited(request, reply, "registration_link_validate", 60, 60 * 60 * 1000)) return;
    const { token } = request.query as { token?: string };
    if (!token || typeof token !== "string" || token.length > 200) {
      reply.status(400);
      return { valid: false, error: STATE_MESSAGE.missing };
    }

    const { invite, state } = await findLink(token);
    if (!invite || state !== "valid") {
      reply.status(state === "missing" ? 404 : 400);
      return { valid: false, error: STATE_MESSAGE[state === "valid" ? "missing" : state] };
    }

    const [tenant] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, invite.tenantId)).limit(1);
    const [school] = invite.schoolId ? await db.select({ name: schools.name }).from(schools).where(eq(schools.id, invite.schoolId)).limit(1) : [];
    return {
      valid: true,
      role: invite.role,
      specialty: invite.specialty,
      tenantName: tenant?.name ?? null,
      schoolName: school?.name ?? null,
      email: invite.email, // se o administrador fixou o e-mail, a tela o mostra travado
      expiresAt: invite.expiresAt,
    };
  });

  /** Público: a pessoa se cadastra com o link. */
  app.post("/api/onboarding/register", async (request, reply) => {
    if (rejectIfLimited(request, reply, "registration_link_register", 20, 60 * 60 * 1000)) return;

    const parsed = registerSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.status(400);
      return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }
    const body = parsed.data;

    const { invite, state } = await findLink(body.token);
    if (!invite || state !== "valid") {
      reply.status(state === "missing" ? 404 : 400);
      return { error: STATE_MESSAGE[state === "valid" ? "missing" : state] };
    }

    if (invite.email && invite.email.toLowerCase() !== body.email) {
      reply.status(400);
      return { error: "Este link foi gerado para outro e-mail. Use o e-mail indicado ou peça um novo link." };
    }
    if ((invite.role === "specialist" || invite.role === "md1") && !body.classCode) {
      reply.status(400);
      return { error: "Informe o registro no conselho de classe (CRM, CRP, CREFONO...)." };
    }
    if (await emailAlreadyHasAccount(body.email)) {
      // Não redefinimos a senha de quem já existe: o link só cria contas novas.
      reply.status(409);
      return { error: "Este e-mail já tem cadastro. Entre pela tela de login ou use “Primeiro acesso / esqueci a senha”." };
    }

    // Reserva o link antes de criar a conta: duas pessoas abrindo o mesmo link ao mesmo tempo, só uma passa.
    const [claimed] = await db
      .update(onboardingInvites)
      .set({ usedAt: new Date() })
      .where(and(eq(onboardingInvites.id, invite.id), isNull(onboardingInvites.usedAt), gt(onboardingInvites.expiresAt, new Date())))
      .returning();
    if (!claimed) {
      reply.status(400);
      return { error: STATE_MESSAGE.used };
    }

    let createdUserId: string | null = null;
    try {
      const [created] = await db
        .insert(users)
        .values({
          tenantId: invite.tenantId,
          schoolId: invite.schoolId,
          name: body.name,
          email: body.email,
          phone: body.phone || null,
          classCode: body.classCode || null,
          specialty: invite.specialty,
          role: invite.role ?? "specialist",
          accessEnabled: true, // o administrador entregou o link a esta pessoa
        })
        .returning();
      createdUserId = created.id;

      await upsertCredential({ email: body.email, name: body.name, password: body.password });

      await recordAudit(
        { tenantId: invite.tenantId, userId: created.id, userEmail: body.email, action: "registration_link:used", entityType: "users", entityId: created.id, payload: { inviteId: invite.id, role: created.role, specialty: created.specialty, acceptedTerms: true } },
        request,
      );
      incr("registration_links_used");
      return { success: true, message: "Cadastro concluído. Entre com o seu e-mail e a senha que acabou de criar." };
    } catch (err) {
      // Desfaz o que ficou pela metade e devolve o link, para a pessoa poder tentar de novo.
      request.log.error({ err }, "falha ao concluir o cadastro por link");
      if (createdUserId) await db.delete(users).where(eq(users.id, createdUserId)).catch(() => undefined);
      await db.update(onboardingInvites).set({ usedAt: null }).where(eq(onboardingInvites.id, invite.id)).catch(() => undefined);
      reply.status(500);
      return { error: "Não foi possível concluir o cadastro agora. Nada foi salvo; tente de novo em instantes." };
    }
  });
}
