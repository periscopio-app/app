import type { FastifyInstance } from "fastify";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { newsletterIssues, newsletterSubscribers } from "@periscopio/shared";
import { requireActor } from "../security/actor";
import { isSuperAdminEmail } from "../security/roles";
import { sendEmail } from "../email/raw";

const subscribeSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  name: z.string().trim().min(2, "Nome muito curto").optional(),
  role: z.enum(["professor", "especialista", "medico", "gestor", "outro"]).optional().default("outro"),
});

const issueSchema = z.object({
  title: z.string().trim().min(5, "Título deve ter no mínimo 5 caracteres"),
  summary: z.string().trim().optional(),
  content: z.string().trim().min(20, "Conteúdo deve ter no mínimo 20 caracteres"),
  category: z.enum(["geral", "saude_mental", "diretrizes_pedagogicas", "plataforma_novidades", "artigo_cientifico"]).default("geral"),
  status: z.enum(["rascunho", "publicado"]).default("publicado"),
});

export async function newsletterRoutes(app: FastifyInstance) {
  /**
   * 1. Inscrição na Newsletter (pública ou usuário logado)
   */
  app.post("/api/newsletter/subscribe", async (request, reply) => {
    const parsed = subscribeSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: parsed.error.issues[0]?.message || "Dados de inscrição inválidos." };
    }

    const { email, name, role } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const [existing] = await db
      .select()
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, normalizedEmail))
      .limit(1);

    if (existing) {
      if (existing.status === "cancelado") {
        await db
          .update(newsletterSubscribers)
          .set({ status: "ativo", unsubscribedAt: null, name: name || existing.name, role: role || existing.role })
          .where(eq(newsletterSubscribers.id, existing.id));

        return { success: true, message: "Sua assinatura foi reativada com sucesso!" };
      }
      return { success: true, message: "Este e-mail já está inscrito em nossos boletins." };
    }

    await db.insert(newsletterSubscribers).values({
      email: normalizedEmail,
      name: name || null,
      role: role || "outro",
      status: "ativo",
    });

    // Enviar e-mail de boas-vindas
    await sendEmail({
      to: normalizedEmail,
      subject: "Bem-vindo aos Boletins Científicos e Pedagógicos do Periscópio",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #0284c7; margin-bottom: 12px;">Inscrição Confirmada!</h2>
          <p>Olá${name ? `, <strong>${name}</strong>` : ""},</p>
          <p>Você agora receberá nossos informativos periódicos sobre <strong>saúde mental na infância</strong>, diretrizes pedagógicas, estudos do Board Científico e atualizações do Projeto Periscópio.</p>
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 0; font-size: 13px; color: #166534;">
              🛡️ <strong>Privacidade e LGPD:</strong> Respeitamos integralmente seus dados. Você pode cancelar sua assinatura a qualquer momento com um clique.
            </p>
          </div>
          <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
            Plataforma Periscópio — Saúde & Educação Integradas.
          </p>
        </div>
      `,
    });

    return {
      success: true,
      message: "Inscrição realizada com sucesso! Verifique sua caixa de entrada.",
    };
  });

  /**
   * 2. Cancelamento de inscrição (Opt-out LGPD Art. 8º)
   */
  app.post("/api/newsletter/unsubscribe", async (request, reply) => {
    const { email } = (request.body as { email?: string }) || {};
    if (!email) {
      reply.status(400);
      return { error: "Informe o e-mail para cancelamento." };
    }

    const normalizedEmail = email.toLowerCase().trim();
    await db
      .update(newsletterSubscribers)
      .set({ status: "cancelado", unsubscribedAt: new Date() })
      .where(eq(newsletterSubscribers.email, normalizedEmail));

    return {
      success: true,
      message: "Inscrição cancelada com sucesso. Você não receberá novos comunicados.",
    };
  });

  /**
   * 3. Listar edições publicadas da newsletter (aberto para leitura)
   */
  app.get("/api/newsletter/issues", async () => {
    const issues = await db
      .select({
        id: newsletterIssues.id,
        title: newsletterIssues.title,
        summary: newsletterIssues.summary,
        category: newsletterIssues.category,
        publishedAt: newsletterIssues.publishedAt,
        status: newsletterIssues.status,
      })
      .from(newsletterIssues)
      .where(eq(newsletterIssues.status, "publicado"))
      .orderBy(desc(newsletterIssues.publishedAt))
      .limit(50);

    return { issues };
  });

  /**
   * 4. Detalhes de uma edição da newsletter
   */
  app.get<{ Params: { id: string } }>("/api/newsletter/issues/:id", async (request, reply) => {
    const { id } = request.params;
    const [issue] = await db
      .select()
      .from(newsletterIssues)
      .where(eq(newsletterIssues.id, id))
      .limit(1);

    if (!issue) {
      reply.status(404);
      return { error: "Edição da newsletter não encontrada." };
    }

    return { issue };
  });

  /**
   * 5. Criar nova edição da newsletter (Admin / Board)
   */
  app.post("/api/admin/newsletter/issues", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    if (actor.role !== "admin_platform" && actor.role !== "board" && !isSuperAdminEmail(actor.email)) {
      reply.status(403);
      return { error: "Acesso restrito ao Board e Administradores." };
    }

    const parsed = issueSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: parsed.error.issues[0]?.message || "Dados inválidos." };
    }

    const [newIssue] = await db
      .insert(newsletterIssues)
      .values({
        title: parsed.data.title,
        summary: parsed.data.summary || null,
        content: parsed.data.content,
        category: parsed.data.category,
        status: parsed.data.status,
        authorId: actor.id,
      })
      .returning();

    return { success: true, issue: newIssue };
  });

  /**
   * 6. Disparar edição para todos os assinantes ativos (Resend)
   */
  app.post<{ Params: { id: string } }>("/api/admin/newsletter/issues/:id/send", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    if (actor.role !== "admin_platform" && actor.role !== "board" && !isSuperAdminEmail(actor.email)) {
      reply.status(403);
      return { error: "Acesso restrito ao Board e Administradores." };
    }

    const { id } = request.params;
    const [issue] = await db.select().from(newsletterIssues).where(eq(newsletterIssues.id, id)).limit(1);
    if (!issue) {
      reply.status(404);
      return { error: "Edição não encontrada." };
    }

    const subscribers = await db
      .select({ email: newsletterSubscribers.email, name: newsletterSubscribers.name })
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.status, "ativo"));

    let sentCount = 0;
    for (const sub of subscribers) {
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
          <div style="border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px;">
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #0284c7; letter-spacing: 0.05em;">Boletim Periscópio · ${issue.category.replace(/_/g, " ")}</span>
            <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 6px 0 0 0;">${issue.title}</h1>
          </div>
          ${issue.summary ? `<p style="font-size: 14px; color: #475569; font-style: italic; line-height: 1.6; margin-bottom: 18px;">${issue.summary}</p>` : ""}
          <div style="font-size: 14px; line-height: 1.7; color: #334155; white-space: pre-wrap;">${issue.content}</div>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 28px 0 16px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center;">
            Você está recebendo este e-mail porque se cadastrou na plataforma Periscópio.<br/>
            Caso não queira mais receber, solicite o opt-out em nosso portal.
          </p>
        </div>
      `;

      const result = await sendEmail({
        to: sub.email,
        subject: `[Periscópio] ${issue.title}`,
        html: emailHtml,
      });

      if (result.ok) {
        sentCount++;
      }
    }

    await db
      .update(newsletterIssues)
      .set({ sentCount: sql`${newsletterIssues.sentCount} + ${sentCount}`, updatedAt: new Date() })
      .where(eq(newsletterIssues.id, id));

    return {
      success: true,
      message: `Newsletter enviada com sucesso para ${sentCount} assinante(s).`,
      sentCount,
    };
  });

  /**
   * 7. Listar assinantes da newsletter (Admin)
   */
  app.get("/api/admin/newsletter/subscribers", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    if (actor.role !== "admin_platform" && actor.role !== "board" && !isSuperAdminEmail(actor.email)) {
      reply.status(403);
      return { error: "Acesso restrito ao Administrador." };
    }

    const list = await db
      .select()
      .from(newsletterSubscribers)
      .orderBy(desc(newsletterSubscribers.subscribedAt));

    const totalActive = list.filter((s) => s.status === "ativo").length;

    return {
      subscribers: list,
      total: list.length,
      totalActive,
    };
  });
}
