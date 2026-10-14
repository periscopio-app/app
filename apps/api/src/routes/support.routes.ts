import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { supportTickets } from "@periscopio/shared";
import { requireActor } from "../security/actor";
import { isSuperAdminEmail } from "../security/roles";
import { sendEmail } from "../email/raw";

const createTicketSchema = z.object({
  title: z.string().trim().min(3, "Título deve ter no mínimo 3 caracteres"),
  description: z.string().trim().min(10, "Por favor, detalhe sua dúvida ou o que aconteceu (mínimo 10 caracteres)"),
  category: z.enum(["duvida", "erro_sistema", "sugestao", "urgente"]).default("duvida"),
  pageUrl: z.string().optional(),
  browserInfo: z.string().optional(),
  errorDetails: z.string().optional(),
  userEmail: z.string().email("E-mail para retorno inválido").optional(),
  userName: z.string().optional(),
});

const FAQ_ITEMS = [
  {
    id: "fogap-envio",
    category: "Triagem & FOGAP",
    question: "Como funciona o envio do formulário FOGAP pelo Responsável Escolar (RE)?",
    answer: "O RE preenche a observação dos domínios da criança e submete a avaliação. O caso passa automaticamente para o estado 'Revisão Médica', no qual o médico avaliador revisa os dados e pode encaminhar a especialistas ou solicitar retificação.",
  },
  {
    id: "cofre-identidade",
    category: "LGPD & Sigilo",
    question: "Quem tem acesso aos dados civis (nome, CPF) no Cofre de Identidade?",
    answer: "O sistema opera por padrão sobre o código pseudonimizado. O Cofre de Identidade utiliza criptografia AES-256 GCM e só pode ser descriptografado por profissionais clínicos autorizados mediante justificativa formal obrigatória, ficando permanentemente auditado na trilha da plataforma.",
  },
  {
    id: "agenda-board",
    category: "Videochamadas & Board",
    question: "Como agendar uma reunião de supervisão ou discussão de caso com o Board?",
    answer: "Na aba 'Board & Videochamada' do prontuário ou no painel de reuniões, selecione um slot disponível configurado pelos experts. O sistema enviará um e-mail com a confirmação e disponibilizará o link direto da sala virtual segura (Jitsi/Meet).",
  },
  {
    id: "parecer-100-caracteres",
    category: "Especialistas & Laudos",
    question: "Por que meu parecer clínico exige no mínimo 100 caracteres?",
    answer: "Para garantir a densidade técnica e o rigor multiprofissional exigidos pelos órgãos de classe (CFM, CRP, CRFa), a conclusão do parecer exige fundamentação mínima com contagem em tempo real e validação estrita.",
  },
  {
    id: "anexos-exames",
    category: "Exames & Anexos",
    question: "Onde ficam armazenados os exames e documentos anexados?",
    answer: "Os exames são custodiados no bucket seguro do Supabase Storage sob a pasta estruturada da escola e do aluno, protegidos por URLs assinadas de curta duração (600 segundos), garantindo conformidade com a LGPD e o sigilo em saúde.",
  },
];

export async function supportRoutes(app: FastifyInstance) {
  /**
   * 1. FAQ / Base de Conhecimento Rápida
   */
  app.get("/api/support/faq", async () => {
    return { faq: FAQ_ITEMS };
  });

  /**
   * 2. Abertura de Chamado / Relato de Erro do Sistema
   */
  app.post("/api/support/tickets", async (request, reply) => {
    // Pode ser autenticado ou anônimo (caso o usuário esteja com erro de login)
    let actor = null;
    try {
      actor = await requireActor(request, reply);
    } catch {
      // continua como anônimo se não autenticado
    }

    const parsed = createTicketSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: parsed.error.issues[0]?.message || "Dados do chamado inválidos." };
    }

    const data = parsed.data;
    const userEmail = actor?.email || data.userEmail;
    if (!userEmail) {
      reply.status(400);
      return { error: "Informe seu e-mail para receber o retorno do suporte." };
    }

    const userName = actor?.name || data.userName || "Usuário da Plataforma";
    const userRole = actor?.role || "outro";
    const priority = data.category === "urgente" || data.category === "erro_sistema" ? "alta" : "normal";

    const [ticket] = await db
      .insert(supportTickets)
      .values({
        tenantId: actor?.tenantId || null,
        userId: actor?.id || null,
        userName,
        userEmail,
        userRole,
        category: data.category,
        title: data.title,
        description: data.description,
        pageUrl: data.pageUrl || null,
        browserInfo: data.browserInfo || (request.headers["user-agent"] as string) || null,
        errorDetails: data.errorDetails || null,
        status: "aberto",
        priority,
      })
      .returning();

    // Notificar equipe de suporte/desenvolvimento caso seja erro do sistema ou urgente
    if (data.category === "erro_sistema" || data.category === "urgente") {
      const supportEmail = process.env.SUPPORT_NOTIFY_EMAIL || "suporte@projetoperiscopio.com.br";
      await sendEmail({
        to: supportEmail,
        subject: `[ALERTA DE ${data.category.toUpperCase()}] ${data.title} (${userEmail})`,
        html: `
          <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h3 style="color: #dc2626; margin-top: 0;">Novo incidente reportado no Periscópio</h3>
            <p><strong>Usuário:</strong> ${userName} (${userEmail}) — Perfil: ${userRole}</p>
            <p><strong>Título:</strong> ${data.title}</p>
            <p><strong>Descrição:</strong><br/>${data.description}</p>
            ${data.pageUrl ? `<p><strong>Página de Ocorrência:</strong> ${data.pageUrl}</p>` : ""}
            ${data.errorDetails ? `<div style="background:#fef2f2; border:1px solid #fecaca; padding:10px; border-radius:8px; font-family:monospace; font-size:12px; color:#991b1b;"><pre>${data.errorDetails}</pre></div>` : ""}
            <p style="font-size: 11px; color: #64748b; margin-top: 20px;">Protocolo do chamado: ${ticket.id}</p>
          </div>
        `,
      });
    }

    return {
      success: true,
      ticketId: ticket.id,
      message: "Seu chamado foi registrado com sucesso! Nossa equipe técnica retornará em breve.",
    };
  });

  /**
   * 3. Meus chamados abertos
   */
  app.get("/api/support/my-tickets", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    const tickets = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userEmail, actor.email))
      .orderBy(desc(supportTickets.createdAt));

    return { tickets };
  });

  /**
   * 4. Listar chamados e incidentes (Admin / Suporte)
   */
  app.get("/api/admin/support/tickets", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    if (actor.role !== "admin_platform" && actor.role !== "board" && !isSuperAdminEmail(actor.email)) {
      reply.status(403);
      return { error: "Acesso restrito ao Administrador da Plataforma." };
    }

    const { category, status } = (request.query as { category?: string; status?: string }) || {};

    const list = await db
      .select()
      .from(supportTickets)
      .where(
        and(
          category && category !== "all" ? eq(supportTickets.category, category) : undefined,
          status && status !== "all" ? eq(supportTickets.status, status) : undefined,
        )
      )
      .orderBy(desc(supportTickets.createdAt))
      .limit(100);

    const openCount = list.filter((t) => t.status === "aberto").length;
    const errorCount = list.filter((t) => t.category === "erro_sistema").length;

    return {
      tickets: list,
      metrics: {
        total: list.length,
        openCount,
        errorCount,
      },
    };
  });

  /**
   * 5. Responder ou atualizar chamado (Admin / Suporte)
   */
  app.patch<{
    Params: { id: string };
    Body: { status?: string; resolutionNotes?: string; priority?: string };
  }>("/api/admin/support/tickets/:id", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    if (actor.role !== "admin_platform" && actor.role !== "board" && !isSuperAdminEmail(actor.email)) {
      reply.status(403);
      return { error: "Acesso restrito ao Administrador da Plataforma." };
    }

    const { id } = request.params;
    const { status, resolutionNotes, priority } = request.body || {};

    const [existing] = await db.select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
    if (!existing) {
      reply.status(404);
      return { error: "Chamado não encontrado." };
    }

    const isResolved = status === "resolvido" || status === "fechado";

    const [updated] = await db
      .update(supportTickets)
      .set({
        status: status || existing.status,
        resolutionNotes: resolutionNotes !== undefined ? resolutionNotes : existing.resolutionNotes,
        priority: priority || existing.priority,
        resolvedAt: isResolved ? new Date() : existing.resolvedAt,
        resolvedBy: isResolved ? actor.id : existing.resolvedBy,
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, id))
      .returning();

    // Notificar usuário se houver resposta
    if (resolutionNotes && existing.userEmail) {
      await sendEmail({
        to: existing.userEmail,
        subject: `[Atualização no Chamado] ${existing.title}`,
        html: `
          <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h3 style="color: #0284c7; margin-top: 0;">Atualização no seu chamado de suporte</h3>
            <p>Olá <strong>${existing.userName}</strong>,</p>
            <p>Seu chamado sobre "<em>${existing.title}</em>" foi atualizado para o status <strong>${updated.status}</strong>.</p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 10px; margin: 16px 0;">
              <p style="margin: 0; font-size: 13px; color: #334155;"><strong>Parecer da equipe técnica:</strong></p>
              <p style="margin: 6px 0 0 0; font-size: 14px; color: #0f172a; white-space: pre-wrap;">${resolutionNotes}</p>
            </div>
            <p style="font-size: 12px; color: #64748b;">Protocolo: ${existing.id}</p>
          </div>
        `,
      });
    }

    return { success: true, ticket: updated };
  });
}
