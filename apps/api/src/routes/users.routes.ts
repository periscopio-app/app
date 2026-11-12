import type { FastifyInstance } from "fastify";
import { eq, desc, and } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import { db } from "../db/client";
import { users, schools, tenants, consentTerms, consentAcceptances } from "@periscopio/shared";
import { requireActor, requireCapability } from "../security/actor";
import { effectiveCapabilities } from "../services/privilege.service";
import { isRole, type Role } from "../security/roles";
import { recordAudit } from "../services/audit.service";
import { MigracaoPendenteError, TermoDesatualizadoError, registrarAceiteProfissional, situacaoDoTermo } from "../services/professional-term.service";
import { errorCauseChain } from "../observability/error-cause";
import { urlDoAvatar } from "../services/avatar.service";
import { sendAccessLinkEmail } from "../services/access-email.service";
import { rejectIfLimited } from "../security/rate-limit";
import { incr } from "../observability/metrics";

/** Perfis de plataforma: não pertencem a um município/instância e por isso podem ser criados sem tenantId. */
const PLATFORM_ROLES: readonly string[] = ["admin_platform", "adm_master"];

export const SYSTEM_ROLES_CATALOG = [
  {
    role: "admin_platform",
    title: "Administrador Master (Plataforma)",
    description: "Gestor da plataforma: instâncias, escolas, usuários e privilégios, com suporte auditado. Não lê prontuário nem faz ato clínico.",
    level: "master",
    permissions: [
      "users:create",
      "users:read",
      "users:update",
      "users:delete",
      "roles:assign",
      "schools:manage",
      "students:register_support",
      "board:agenda_manage",
      "audit:full_access",
    ],
  },
  {
    role: "municipal_manager",
    title: "Gestor(a) Municipal",
    description: "Gestor da rede: vê o sumário do RE e a lista final de alunos encaminhados ao núcleo assistencial, além de indicadores agregados. Não vê prontuário.",
    level: "gestao",
    permissions: [
      "re_summaries:view",
      "nucleo_referrals:view",
      "indicators:aggregate_view",
    ],
  },
  {
    role: "school_manager",
    title: "Gestor(a) Escolar / Direção",
    description: "Direção da unidade escolar: vê, só da própria escola, o sumário do RE e a lista final de alunos encaminhados ao núcleo assistencial. Não vê prontuário.",
    level: "escola",
    permissions: [
      "re_summaries:view_school",
      "nucleo_referrals:view_school",
      "indicators:aggregate_view",
    ],
  },
  {
    role: "teacher",
    title: "Professor(a)",
    description: "Registra sinais e comportamentos observados em sala na Ficha de Observação Escolar.",
    level: "escola",
    permissions: ["observations:create", "observations:my_history"],
  },
  {
    role: "ppi",
    title: "RE — Responsável Escolar",
    description: "Cadastra professores e a si mesmo, acompanha os alunos com dificuldade, completa o FOGAP, monta o sumário e a lista para o núcleo assistencial e pode pedir ajuda ao Board em casos graves.",
    level: "clinico",
    permissions: [
      "students:register",
      "assessments:ppi_write",
      "re_summary:submit",
      "board:request_help",
    ],
  },
  {
    role: "md1",
    title: "Médico(a) / MD1",
    description: "Recebe do RE a lista de encaminhados, avalia, direciona aos especialistas do núcleo, consulta o consolidado e é o único a encerrar o caso.",
    level: "clinico",
    permissions: [
      "cases:medical_review",
      "assessments:md1_write",
      "cases:delegate",
      "cases:close",
      "board:request_help",
    ],
  },
  {
    role: "specialist",
    title: "Especialista Clínico",
    description: "Núcleo assistencial: assistente social, neuropsicologia, psicomotricidade, psicoterapia, fonoaudiologia, psicologia familiar e psicopedagogia clínica. Preenche só a própria seção e vê o sumário concluído dos colegas.",
    level: "clinico",
    permissions: ["cases:assigned_section_write", "cases:peer_summaries_view"],
  },
  {
    role: "board",
    title: "Board Científico",
    description: "Gestão científica: atende os pedidos de ajuda do RE e do médico em casos graves e mantém a agenda. Não lê prontuário.",
    level: "consultoria",
    permissions: ["board:agenda_manage", "board:requests_answer"],
  },
  {
    role: "researcher",
    title: "Pesquisador(a)",
    description: "Acesso a dados quantitativos e indicadores para estudos acadêmicos e mensuração de impacto.",
    level: "pesquisa",
    permissions: ["reports:anonymized_export"],
  },
] as const;

export async function usersRoutes(app: FastifyInstance) {
  /**
   * 0. Perfil do usuário autenticado (qualquer papel)
   */
  app.get("/api/me", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        tenantId: users.tenantId,
        schoolId: users.schoolId,
        avatarKey: users.avatarKey,
        // Hero do painel: cargo/conselho, especialidade, apresentação curta e escola.
        classCode: users.classCode,
        specialty: users.specialty,
        bio: users.bio,
        schoolName: schools.name,
      })
      .from(users)
      .leftJoin(schools, eq(users.schoolId, schools.id))
      .where(eq(users.id, actor.id))
      .limit(1);

    if (!user) { reply.status(404); return { error: "Usuário não encontrado" }; }
    // `capabilities` = o que esta pessoa pode ver/fazer HOJE (padrão + caixinhas do Admin Master).
    const capabilities = await effectiveCapabilities(actor);
    // A chave interna da foto não sai da API: a tela recebe só o link público.
    const { avatarKey, ...publico } = user;
    return { user: { ...publico, avatarUrl: await urlDoAvatar(avatarKey) }, capabilities };
  });

  /**
   * 1a. Listar escolas (para dropdown no cadastro de usuário)
   */
  app.get("/api/admin/schools", async (request, reply) => {
    const actor = await requireCapability(request, reply, "users.manage");
    if (!actor) return;

    const list = await db
      .select({ id: schools.id, name: schools.name, slug: schools.slug, tenantId: schools.tenantId })
      .from(schools)
      .orderBy(schools.name);

    return { schools: list };
  });

  /**
   * 1. Obter catálogo de papéis e regras de privilégios
   */
  app.get("/api/admin/roles", async (request, reply) => {
    const actor = await requireCapability(request, reply, "users.manage");
    if (!actor) return;
    return { roles: SYSTEM_ROLES_CATALOG };
  });

  /**
   * 2. Listar todos os usuários da plataforma
   */
  app.get("/api/admin/users", async (request, reply) => {
    const actor = await requireCapability(request, reply, "users.manage");
    if (!actor) return;

    const list = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        phone: users.phone,
        cpf: users.cpf,
        classCode: users.classCode,
        specialty: users.specialty,
        tenantId: users.tenantId,
        schoolId: users.schoolId,
        schoolName: schools.name,
        tenantName: tenants.name,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(schools, eq(users.schoolId, schools.id))
      .leftJoin(tenants, eq(users.tenantId, tenants.id))
      .orderBy(desc(users.createdAt));

    return { users: list };
  });

  /**
   * 3. Criar novo usuário e associar perfil/privilégios
   */
  app.post("/api/admin/users", async (request, reply) => {
    const actor = await requireCapability(request, reply, "users.manage");
    if (!actor) return;

    const body = request.body as {
      email: string;
      name: string;
      role: Role;
      password?: string;
      phone?: string;
      cpf?: string;
      classCode?: string;
      specialty?: string;
      schoolId?: string;
      tenantId?: string;
      lgpdConsentAccepted?: boolean;
    };

    if (!body.email || !body.name || !body.role) {
      reply.status(400);
      return { error: "Campos obrigatórios: email, name e role." };
    }

    if (!isRole(body.role)) {
      reply.status(400);
      return { error: `Perfil '${body.role}' inválido no sistema.` };
    }

    const email = body.email.toLowerCase().trim();

    // Checar se já existe no public.users
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      reply.status(409);
      return { error: "Já existe um usuário cadastrado com este e-mail." };
    }

    // Quem não é da plataforma precisa de uma instância (município) escolhida e existente. Antes, o padrão era o tenant
    // global, e o especialista criado ali não enxergava nem era visto pelo médico da instância real.
    const platformRole = PLATFORM_ROLES.includes(body.role);
    if (!platformRole && !body.tenantId) {
      reply.status(400);
      return { error: "Informe a instância (município) do usuário: tenantId é obrigatório para este perfil." };
    }
    const tenantId = body.tenantId || "00000000-0000-0000-0000-000000000001";
    if (body.tenantId) {
      const [tenant] = z.string().uuid().safeParse(body.tenantId).success
        ? await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, body.tenantId)).limit(1)
        : [];
      if (!tenant) {
        reply.status(400);
        return { error: "Instância (tenantId) não encontrada." };
      }
    }
    if (body.schoolId) {
      const [school] = z.string().uuid().safeParse(body.schoolId).success
        ? await db.select({ tenantId: schools.tenantId }).from(schools).where(eq(schools.id, body.schoolId)).limit(1)
        : [];
      if (!school || school.tenantId !== tenantId) {
        reply.status(400);
        return { error: "A escola informada não pertence a esta instância." };
      }
    }
    const userId = crypto.randomUUID();
    const initialPassword = body.password || crypto.randomBytes(16).toString("hex");
    const hashedPassword = await hashPassword(initialPassword);

    try {
      // Inserir no neon_auth para login
      const client = await (db as any).$client;
      if (client && client.query) {
        await client.query(
          `INSERT INTO neon_auth.user (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, true, $4, NOW(), NOW())
           ON CONFLICT (id) DO NOTHING`,
          [userId, body.name, email, body.role === "admin_platform" ? "admin" : "user"]
        );

        const accountId = crypto.randomUUID();
        await client.query(
          `INSERT INTO neon_auth.account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
           VALUES ($1, $2, 'credential', $3, $4, NOW(), NOW())`,
          [accountId, userId, userId, hashedPassword]
        );
      }

      // Inserir no public.users
      const [newUser] = await db
        .insert(users)
        .values({
          id: userId,
          email,
          name: body.name,
          role: body.role,
          phone: body.phone,
          cpf: body.cpf,
          classCode: body.classCode,
          specialty: body.specialty,
          tenantId,
          schoolId: body.schoolId || null,
          accessEnabled: true, // criado pelo admin da plataforma (e-mail já marcado como verificado)
        })
        .returning();

      // Registrar termo de consentimento e responsabilidade médica/LGPD se aceito
      if (body.lgpdConsentAccepted) {
        let [profTerm] = await db
          .select()
          .from(consentTerms)
          .where(and(eq(consentTerms.tenantId, tenantId), eq(consentTerms.type, "termo_profissional_lgpd")))
          .limit(1);

        if (!profTerm) {
          [profTerm] = await db
            .insert(consentTerms)
            .values({
              tenantId,
              version: "v1.0",
              type: "termo_profissional_lgpd",
              title: "Termo de Responsabilidade Clínica e Proteção de Dados (LGPD e CFM/CFP)",
              summary: "Compromisso formal de observância do sigilo profissional de saúde e proteção integral de dados sensíveis de crianças e adolescentes.",
              content: "TERMO DE RESPONSABILIDADE CLÍNICA E PROTEÇÃO DE DADOS (LGPD):\n1. Observância integral do sigilo profissional (CFM/CFP).\n2. Tratamento exclusivo para a finalidade de apoio pedagógico e encaminhamento responsável.\n3. Proibição de compartilhamento não autorizado de prontuários e dados de saúde de menores.",
              active: true,
            })
            .onConflictDoNothing()
            .returning();
        }

        if (profTerm) {
          const rawEvidence = `${profTerm.content}|${body.name}|${body.cpf || ""}|${body.role}|${request.ip || "127.0.0.1"}|${new Date().toISOString()}`;
          const evidenceSha256 = crypto.createHash("sha256").update(rawEvidence).digest("hex");
          await db.insert(consentAcceptances).values({
            tenantId,
            termId: profTerm.id,
            userId: newUser.id,
            signerName: body.name,
            signerDocument: body.cpf || null,
            signerRole: body.role,
            signerEmail: email,
            ipAddress: request.ip || "127.0.0.1",
            userAgent: (request.headers["user-agent"] as string) || "Cadastro Inicial",
            evidenceSha256,
            status: "accepted",
          });
        }
      }

      await recordAudit(
        {
          tenantId,
          userId: actor.id,
          userEmail: actor.email,
          action: "user.created",
          entityType: "user",
          entityId: newUser.id,
          payload: {
            createdUserId: newUser.id,
            email: newUser.email,
            role: newUser.role,
            schoolId: newUser.schoolId,
            lgpdConsentAccepted: !!body.lgpdConsentAccepted,
          },
        },
        request
      );

      // Sem senha definida pelo administrador, a pessoa recebe agora o link para criar a própria senha.
      // O resultado do envio vai na resposta: a tela mostra "enviado" ou o motivo, e o botão "Enviar acesso" reenvia.
      let emailStatus: "sent" | "failed" | "skipped" = "skipped";
      let emailError: string | undefined;
      if (!body.password) {
        const sent = await sendAccessLinkEmail({ email, name: body.name }, { invited: true });
        emailStatus = sent.ok ? "sent" : "failed";
        if (sent.ok) {
          incr("access_links_sent");
        } else {
          emailError = sent.error;
          incr("email_send_failures");
          request.log.error({ err: sent.error, userId: newUser.id }, "falha ao enviar o acesso ao usuário criado");
        }
        await recordAudit(
          { tenantId, userId: actor.id, userEmail: actor.email, action: sent.ok ? "access:link_sent" : "access:link_failed", entityType: "users", entityId: newUser.id, payload: { by: "user.created" } },
          request,
        );
      }

      return {
        user: newUser,
        emailStatus,
        ...(emailError ? { emailError } : {}),
        message: body.password
          ? "Usuário criado. Senha definida pelo administrador — comunique por canal seguro fora do sistema."
          : emailStatus === "sent"
            ? "Usuário criado. Enviamos ao e-mail dele o link para criar a senha (vale 7 dias)."
            : `Usuário criado, mas o e-mail NÃO saiu (${emailError}). Use o botão "Enviar acesso" depois de corrigir.`,
      };
    } catch (err: any) {
      request.log.error(err, "Erro ao criar usuário");
      reply.status(500);
      return { error: err.message || "Erro ao criar usuário." };
    }
  });

  /**
   * Situação do Termo de Responsabilidade Clínica e LGPD da conta + o termo vigente (a tela exibe este texto).
   * Um aceite por conta: com `hasAccepted = true` a tela nunca mais mostra a janela.
   */
  app.get("/api/me/professional-consent", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;
    reply.header("Cache-Control", "no-store");
    return situacaoDoTermo(actor);
  });

  /**
   * Registra o aceite da própria conta. A caixa marcada chega como `accepted: true`; sem ela nada é gravado (400).
   * Grava prova (hash, IP, navegador, versão), estado `true` e auditoria na mesma transação.
   */
  app.post("/api/me/professional-consent/accept", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    const corpo = z
      .object({ accepted: z.boolean().optional(), termId: z.string().uuid().optional(), termVersion: z.string().max(20).optional() })
      .safeParse(request.body ?? {});
    if (!corpo.success || corpo.data.accepted !== true) {
      return reply.status(400).send({ error: "Marque a caixa declarando que leu e aceita o termo para continuar." });
    }

    const ip = (request.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || request.ip || "127.0.0.1";
    try {
      const r = await registrarAceiteProfissional(actor, corpo.data, { ip, userAgent: (request.headers["user-agent"] as string) || "Desconhecido" });
      return { success: true, alreadyAccepted: r.jaAceito, acceptedAt: r.acceptedAt, termVersion: r.version, message: "Termo aceito. Este aceite vale para a sua conta." };
    } catch (err) {
      if (err instanceof TermoDesatualizadoError) return reply.status(409).send({ error: err.message });
      if (err instanceof MigracaoPendenteError) return reply.status(503).send({ error: err.message });
      request.log.error({ err, causes: errorCauseChain(err) }, "falha ao registrar aceite do termo profissional");
      return reply.status(503).send({ error: "Não foi possível registrar o aceite agora. Nada foi gravado; tente de novo em instantes." });
    }
  });

  /**
   * 3a. Instâncias (municípios) para escolher onde o usuário atua.
   */
  app.get("/api/admin/tenants", async (request, reply) => {
    const actor = await requireCapability(request, reply, "users.manage");
    if (!actor) return;
    const list = await db
      .select({ id: tenants.id, name: tenants.name, municipalityCode: tenants.municipalityCode, demo: tenants.demo })
      .from(tenants)
      .orderBy(tenants.name);
    return { tenants: list };
  });

  /**
   * 3b. Enviar (ou reenviar) o acesso: o link para a pessoa criar a própria senha, válido por 7 dias.
   * Serve para quem já está cadastrado e não recebeu o e-mail, ou perdeu o link. Mostra o resultado, sem esconder a falha.
   */
  app.post("/api/admin/users/:id/send-access", async (request, reply) => {
    const actor = await requireCapability(request, reply, "users.manage");
    if (!actor) return;
    if (rejectIfLimited(request, reply, "admin_send_access", 60, 60 * 60 * 1000)) return;

    const { id } = request.params as { id: string };
    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) {
      reply.status(404);
      return { error: "Usuário não encontrado." };
    }

    const sent = await sendAccessLinkEmail({ email: target.email, name: target.name }, { invited: true });
    if (sent.ok) incr("access_links_sent");
    else incr("email_send_failures");
    await recordAudit(
      { tenantId: target.tenantId, userId: actor.id, userEmail: actor.email, action: sent.ok ? "access:link_sent" : "access:link_failed", entityType: "users", entityId: target.id, payload: { by: "admin" } },
      request,
    );
    if (!sent.ok) {
      request.log.error({ err: sent.error, userId: target.id }, "falha ao reenviar o acesso");
      reply.status(502);
      return { success: false, emailStatus: "failed", error: `O e-mail não saiu: ${sent.error}` };
    }
    return { success: true, emailStatus: "sent", message: `Link de acesso enviado para ${target.email}.` };
  });

  /**
   * 4. Atualizar perfil/privilégios e dados de um usuário
   */
  app.patch("/api/admin/users/:id", async (request, reply) => {
    const actor = await requireCapability(request, reply, "users.manage");
    if (!actor) return;

    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      role?: Role;
      phone?: string;
      cpf?: string;
      classCode?: string;
      specialty?: string;
      schoolId?: string | null;
      tenantId?: string;
    };

    if (body.role && !isRole(body.role)) {
      reply.status(400);
      return { error: `Perfil '${body.role}' inválido.` };
    }

    const [updated] = await db
      .update(users)
      .set({
        ...(body.name ? { name: body.name } : {}),
        ...(body.role ? { role: body.role } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.cpf !== undefined ? { cpf: body.cpf } : {}),
        ...(body.classCode !== undefined ? { classCode: body.classCode } : {}),
        ...(body.specialty !== undefined ? { specialty: body.specialty } : {}),
        ...(body.schoolId !== undefined ? { schoolId: body.schoolId } : {}),
        ...(body.tenantId ? { tenantId: body.tenantId } : {}),
      })
      .where(eq(users.id, id))
      .returning();

    if (!updated) {
      reply.status(404);
      return { error: "Usuário não encontrado." };
    }

    await recordAudit(
      {
        tenantId: updated.tenantId,
        userId: actor.id,
        userEmail: actor.email,
        action: "user.updated",
        entityType: "user",
        entityId: updated.id,
        payload: {
          updatedUserId: updated.id,
          updatedFields: Object.keys(body),
          newRole: body.role,
          schoolId: body.schoolId,
        },
      },
      request
    );

    return { user: updated, message: "Privilégios e dados atualizados com sucesso." };
  });

  /**
   * 5. Excluir usuário
   */
  app.delete("/api/admin/users/:id", async (request, reply) => {
    const actor = await requireCapability(request, reply, "users.manage");
    if (!actor) return;

    const { id } = request.params as { id: string };

    if (id === actor.id) {
      reply.status(400);
      return { error: "Não é permitido excluir o próprio usuário autenticado." };
    }

    const [targetUser] = await db.select().from(users).where(eq(users.id, id)).limit(1);

    await db.delete(users).where(eq(users.id, id));

    await recordAudit(
      {
        tenantId: targetUser?.tenantId || actor.tenantId,
        userId: actor.id,
        userEmail: actor.email,
        action: "user.deleted",
        entityType: "user",
        entityId: id,
        payload: {
          deletedUserId: id,
          email: targetUser?.email,
          role: targetUser?.role,
        },
      },
      request
    );

    return { success: true, message: "Usuário removido da plataforma." };
  });
}
