import type { FastifyInstance } from "fastify";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../db/client";
import { users, schools, tenants } from "@periscopio/shared";
import { requireActor } from "../security/actor";
import { isRole, type Role } from "../security/roles";

export const SYSTEM_ROLES_CATALOG = [
  {
    role: "admin_platform",
    title: "Administrador Master (Plataforma)",
    description: "Acesso irrestrito a todas as instâncias, escolas, casos e usuários. Pode gerenciar regras e privilégios.",
    level: "master",
    permissions: [
      "users:create",
      "users:read",
      "users:update",
      "users:delete",
      "roles:assign",
      "schools:manage",
      "cases:all_access",
      "audit:full_access",
    ],
  },
  {
    role: "municipal_manager",
    title: "Gestor(a) Municipal",
    description: "Visualização consolidada de todas as escolas da rede municipal e indicadores epidemiológicos.",
    level: "gestao",
    permissions: [
      "schools:view_municipal",
      "cases:aggregate_view",
      "reports:generate",
    ],
  },
  {
    role: "school_manager",
    title: "Gestor(a) Escolar / Direção",
    description: "Responsável pela unidade escolar. Recebe e despacha fichas de observação para a equipe técnica.",
    level: "escola",
    permissions: [
      "observations:review",
      "cases:school_view",
      "team:school_manage",
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
    title: "Psicopedagogo(a) / PpI",
    description: "Acolhimento da criança e família, aplicação de instrumentos (ex: MSPSS) e triagem inicial.",
    level: "clinico",
    permissions: [
      "cases:triage",
      "assessments:ppi_write",
      "students:interview",
    ],
  },
  {
    role: "md1",
    title: "Médico(a) / MD1",
    description: "Estratificação clínica de risco, decisão técnica de conduta e encaminhamento responsável ao SUS.",
    level: "clinico",
    permissions: [
      "cases:medical_review",
      "assessments:md1_write",
      "referrals:create",
    ],
  },
  {
    role: "specialist",
    title: "Especialista Clínico",
    description: "Profissional de área correlata (fonoaudiologia, neuropsicologia, etc.) que preenche parecer específico.",
    level: "clinico",
    permissions: ["cases:assigned_section_write"],
  },
  {
    role: "board",
    title: "Board Científico",
    description: "Supervisão acadêmica e consultoria em casos complexos anonimizados.",
    level: "consultoria",
    permissions: ["cases:anonymized_review", "supervision:notes_write"],
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
      .select({ id: users.id, email: users.email, name: users.name, role: users.role, tenantId: users.tenantId, schoolId: users.schoolId })
      .from(users)
      .where(eq(users.id, actor.id))
      .limit(1);

    if (!user) { reply.status(404); return { error: "Usuário não encontrado" }; }
    return { user };
  });

  /**
   * 1a. Listar escolas (para dropdown no cadastro de usuário)
   */
  app.get("/api/admin/schools", async (request, reply) => {
    const actor = await requireActor(request, reply, ["admin_platform"]);
    if (!actor) return;

    const list = await db
      .select({ id: schools.id, name: schools.name, slug: schools.slug })
      .from(schools)
      .orderBy(schools.name);

    return { schools: list };
  });

  /**
   * 1. Obter catálogo de papéis e regras de privilégios
   */
  app.get("/api/admin/roles", async (request, reply) => {
    const actor = await requireActor(request, reply, ["admin_platform"]);
    if (!actor) return;
    return { roles: SYSTEM_ROLES_CATALOG };
  });

  /**
   * 2. Listar todos os usuários da plataforma
   */
  app.get("/api/admin/users", async (request, reply) => {
    const actor = await requireActor(request, reply, ["admin_platform"]);
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
    const actor = await requireActor(request, reply, ["admin_platform"]);
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

    // Tenant padrão se não informado
    const tenantId = body.tenantId || "00000000-0000-0000-0000-000000000001";
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
          [accountId, email, userId, hashedPassword]
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

      return {
        user: newUser,
        message:
          "Usuário criado com sucesso. Comunique a senha inicial por canal seguro fora do sistema.",
      };
    } catch (err: any) {
      request.log.error(err, "Erro ao criar usuário");
      reply.status(500);
      return { error: err.message || "Erro ao criar usuário." };
    }
  });

  /**
   * 4. Atualizar perfil/privilégios e dados de um usuário
   */
  app.patch("/api/admin/users/:id", async (request, reply) => {
    const actor = await requireActor(request, reply, ["admin_platform"]);
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

    return { user: updated, message: "Privilégios e dados atualizados com sucesso." };
  });

  /**
   * 5. Excluir usuário
   */
  app.delete("/api/admin/users/:id", async (request, reply) => {
    const actor = await requireActor(request, reply, ["admin_platform"]);
    if (!actor) return;

    const { id } = request.params as { id: string };

    if (id === actor.id) {
      reply.status(400);
      return { error: "Não é permitido excluir o próprio usuário autenticado." };
    }

    await db.delete(users).where(eq(users.id, id));
    return { success: true, message: "Usuário removido da plataforma." };
  });
}
