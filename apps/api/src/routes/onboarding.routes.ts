import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "../db/client";
import { tenants, schools, users, onboardingInvites } from "@periscopio/shared";
import { sendEmail } from "../email";
import { requireActor } from "../security/actor";
import { professionalInviteEmail } from "../email/templates";

export async function onboardingRoutes(app: FastifyInstance) {
  /**
   * 1. Consulta pública da escola por slug (usada pelo frontend White Label)
   */
  app.get("/api/schools/by-slug/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };

    const schoolList = await db
      .select({
        id: schools.id,
        name: schools.name,
        slug: schools.slug,
        status: schools.status,
        branding: schools.branding,
      })
      .from(schools)
      .where(eq(schools.slug, slug))
      .limit(1);

    if (schoolList.length === 0) {
      reply.status(404);
      return { error: "Escola/Instância não encontrada para esta slug." };
    }

    return { school: schoolList[0] };
  });

  /**
   * 2. Setup do SysAdmin: Criação da Instância White Label da Escola
   * Recebe: nome, cnpj, slug, responsavelNome, responsavelEmail, responsavelTelefone
   * Cria: tenant e school, gera Magic Link de onboarding e envia via Resend.
   */
  app.post("/api/admin/instances", async (request, reply) => {
    const actor = await requireActor(request, reply, ["admin_platform"]);
    if (!actor) return;

    const body = request.body as {
      nomeEscola: string;
      cnpj: string;
      slug: string;
      responsavelNome: string;
      responsavelEmail: string;
      responsavelTelefone: string;
      municipalityCode?: string;
    };

    if (
      !body.nomeEscola ||
      !body.cnpj ||
      !body.slug ||
      !body.responsavelNome ||
      !body.responsavelEmail
    ) {
      reply.status(400);
      return {
        error:
          "Dados obrigatórios ausentes: nomeEscola, cnpj, slug, responsavelNome, responsavelEmail.",
      };
    }

    // Normaliza slug (apenas letras minúsculas, números e hífens)
    const normalizedSlug = body.slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-");

    // Verifica unicidade da slug
    const existingSchool = await db
      .select({ id: schools.id })
      .from(schools)
      .where(eq(schools.slug, normalizedSlug))
      .limit(1);

    if (existingSchool.length > 0) {
      reply.status(409);
      return { error: `A slug '${normalizedSlug}' já está em uso por outra escola.` };
    }

    // 1. Cria Tenant (Município / Instituição)
    const [newTenant] = await db
      .insert(tenants)
      .values({
        name: body.nomeEscola,
        municipalityCode: body.municipalityCode || "3550308", // Padrão SP ou fornecido
      })
      .returning();

    // 2. Cria Escola com a slug personalizada
    const [newSchool] = await db
      .insert(schools)
      .values({
        tenantId: newTenant.id,
        name: body.nomeEscola,
        slug: normalizedSlug,
        cnpj: body.cnpj,
        responsavelNome: body.responsavelNome,
        responsavelEmail: body.responsavelEmail,
        responsavelTelefone: body.responsavelTelefone,
        status: "pending_onboarding",
        branding: {
          primaryColor: "#3b82f6",
          schoolName: body.nomeEscola,
        },
      })
      .returning();

    // 3. Gera Token Criptográfico para o Magic Link de Onboarding
    const inviteToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

    await db.insert(onboardingInvites).values({
      tenantId: newTenant.id,
      schoolId: newSchool.id,
      email: body.responsavelEmail,
      token: inviteToken,
      type: "school_manager",
      role: "school_manager",
      expiresAt,
    });

    // 4. Monta a URL personalizada do Magic Link (White Label)
    const baseUrl = process.env.APP_URL || "http://localhost:3000";
    const magicLink = `${baseUrl}/${normalizedSlug}/onboarding?token=${inviteToken}`;

    // 5. Dispara E-mail via Resend
    let emailStatus = "sent";
    try {
      await sendEmail(
        body.responsavelEmail,
        `[Periscópio Saúde] Setup da sua escola: ${body.nomeEscola}`,
        `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
          <h2 style="color: #2563eb;">Bem-vindo(a) ao Periscópio Saúde</h2>
          <p>Olá, <strong>${body.responsavelNome}</strong>,</p>
          <p>A instância exclusiva da sua escola <strong>${body.nomeEscola}</strong> foi configurada com sucesso.</p>
          <p>Para concluir o onboarding e cadastrar a equipe multiprofissional da sua instituição, acesse o link seguro abaixo:</p>
          <div style="margin: 32px 0;">
            <a href="${magicLink}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
              Concluir Onboarding da Escola
            </a>
          </div>
          <p style="font-size: 0.85rem; color: #64748b;">
            Ou cole este link no navegador:<br/>
            <code>${magicLink}</code>
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 0.8rem; color: #94a3b8;">
            Link válido por 7 dias. Dados protegidos conforme a LGPD.
          </p>
        </div>
        `
      );
    } catch {
      emailStatus = "failed";
    }

    return {
      success: true,
      message: "Instância da escola criada com sucesso!",
      school: newSchool,
      magicLink,
      emailStatus,
    };
  });

  /**
   * 3. Validação do Magic Link de Onboarding
   */
  app.get("/api/onboarding/validate-invite", async (request, reply) => {
    const { token, slug } = request.query as { token?: string; slug?: string };

    if (!token) {
      reply.status(400);
      return { error: "Token de convite não informado." };
    }

    const invites = await db
      .select()
      .from(onboardingInvites)
      .where(eq(onboardingInvites.token, token))
      .limit(1);

    if (invites.length === 0) {
      reply.status(404);
      return { valid: false, error: "Convite não encontrado ou inválido." };
    }

    const invite = invites[0];

    if (invite.usedAt) {
      reply.status(400);
      return { valid: false, error: "Este convite já foi utilizado." };
    }

    if (new Date() > new Date(invite.expiresAt)) {
      reply.status(400);
      return { valid: false, error: "Este convite expirou. Solicite um novo link ao administrador." };
    }

    // Busca dados da escola
    const [school] = await db
      .select()
      .from(schools)
      .where(eq(schools.id, invite.schoolId))
      .limit(1);

    // Se a slug foi passada, valida se o convite pertence a esta escola
    if (slug && school && school.slug !== slug) {
      reply.status(403);
      return { valid: false, error: "Este convite não pertence a esta escola." };
    }

    return { valid: true, school: school ? { name: school.name, slug: school.slug, branding: school.branding } : null };
  });

  /**
   * 4. Conclusão do Onboarding pelo Responsável: Cadastro em lote da equipe de profissionais
   */
  app.post("/api/onboarding/complete-school", async (request, reply) => {
    const body = request.body as {
      token: string;
      responsavelPassword?: string;
      professionals: Array<{
        name: string;
        email: string;
        phone: string;
        cpf: string;
        classCode: string; // CRM, CRP, CBO, etc.
        specialty: string; // psicopedagogia | medicina | fonoaudiologia | psicologia | psicomotricidade | servico_social
      }>;
    };

    if (!body.token) {
      reply.status(400);
      return { error: "Token de convite obrigatório." };
    }

    const [invite] = await db
      .select()
      .from(onboardingInvites)
      .where(eq(onboardingInvites.token, body.token))
      .limit(1);

    if (!invite || invite.usedAt || new Date() > new Date(invite.expiresAt)) {
      reply.status(400);
      return { error: "Convite inválido ou expirado." };
    }

    const [school] = await db
      .select()
      .from(schools)
      .where(eq(schools.id, invite.schoolId))
      .limit(1);

    if (!school) {
      reply.status(404);
      return { error: "Escola não encontrada." };
    }

    // 1. Cadastra ou atualiza o Responsável Escolar como usuário
    await db
      .insert(users)
      .values({
        tenantId: school.tenantId,
        schoolId: school.id,
        email: school.responsavelEmail || invite.email,
        name: school.responsavelNome || "Gestor Escolar",
        phone: school.responsavelTelefone,
        role: "school_manager",
        accessEnabled: true, // abriu o link enviado ao e-mail dele
      })
      .onConflictDoNothing();

    // 2. Cadastra os profissionais da equipe multiprofissional
    const registeredProfessionals = [];
    if (body.professionals && Array.isArray(body.professionals)) {
      for (const prof of body.professionals) {
        if (!prof.name || !prof.email) continue;

        // Determina role específica ou specialist
        let role = "specialist";
        if (prof.specialty === "psicopedagogia") role = "ppi";
        if (prof.specialty === "medicina") role = "md1";

        const [createdProf] = await db
          .insert(users)
          .values({
            tenantId: school.tenantId,
            schoolId: school.id,
            name: prof.name,
            email: prof.email.toLowerCase().trim(),
            phone: prof.phone,
            cpf: prof.cpf,
            classCode: prof.classCode,
            specialty: prof.specialty,
            role,
          })
          .onConflictDoNothing()
          .returning();

        registeredProfessionals.push(createdProf);

        // Convite por e-mail: o acesso só é liberado quando o profissional confirma.
        if (createdProf) {
          const inviteToken = randomBytes(32).toString("hex");
          await db.insert(onboardingInvites).values({
            tenantId: school.tenantId,
            schoolId: school.id,
            email: createdProf.email,
            token: inviteToken,
            type: "professional",
            role,
            specialty: prof.specialty,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          });

          const apiPublic = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
          const mail = professionalInviteEmail({
            name: prof.name,
            schoolName: school.name,
            specialty: prof.specialty,
            confirmUrl: `${apiPublic}/api/onboarding/confirm-professional?token=${inviteToken}`,
          });
          try {
            await sendEmail(createdProf.email, mail.subject, mail.html);
          } catch (err) {
            request.log.error({ err }, "falha ao enviar convite de profissional");
          }
        }
      }
    }

    // 3. Marca convite como utilizado e ativa a escola
    await db
      .update(onboardingInvites)
      .set({ usedAt: new Date() })
      .where(eq(onboardingInvites.id, invite.id));

    await db
      .update(schools)
      .set({ status: "active" })
      .where(eq(schools.id, school.id));

    return {
      success: true,
      message: "Onboarding da escola concluído com sucesso!",
      schoolStatus: "active",
      professionalsCount: registeredProfessionals.length,
      professionals: registeredProfessionals,
    };
  });

  /**
   * 5. Confirmação do e-mail do profissional (link do convite enviado pela escola).
   * Libera users.access_enabled e redireciona para o login.
   */
  app.get("/api/onboarding/confirm-professional", async (request, reply) => {
    const { token } = request.query as { token?: string };
    const web = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

    if (!token) return reply.redirect(`${web}/login?convite=invalido`, 302);

    const [invite] = await db
      .select()
      .from(onboardingInvites)
      .where(eq(onboardingInvites.token, token))
      .limit(1);

    if (!invite || invite.type !== "professional") {
      return reply.redirect(`${web}/login?convite=invalido`, 302);
    }
    if (invite.usedAt) return reply.redirect(`${web}/login?convite=confirmado`, 302);
    if (new Date() > new Date(invite.expiresAt)) {
      return reply.redirect(`${web}/login?convite=expirado`, 302);
    }

    await db
      .update(users)
      .set({ accessEnabled: true })
      .where(eq(users.email, invite.email.toLowerCase()));
    await db
      .update(onboardingInvites)
      .set({ usedAt: new Date() })
      .where(eq(onboardingInvites.id, invite.id));

    return reply.redirect(`${web}/login?convite=confirmado`, 302);
  });
}
