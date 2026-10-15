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
   * 2. Autoatendimento Inteligente com RAG (Responde dúvidas comuns antes do ticket)
   */
  app.post("/api/support/ask-rag", async (request, reply) => {
    const askSchema = z.object({
      question: z.string().trim().min(3, "Por favor, digite sua dúvida (mínimo 3 caracteres)."),
      role: z.string().optional(),
    });

    const parsed = askSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: parsed.error.issues[0]?.message || "Pergunta inválida." };
    }

    const { question, role } = parsed.data;
    const qLower = question.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Se houver serviço RAG Python configurado no ambiente, tenta consultar
    let ragSummary: string | null = null;
    const ragBase = process.env.BI_RAG_URL;
    if (ragBase) {
      try {
        const res = await fetch(`${ragBase.replace(/\/$/, "")}/plan`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-service-token": process.env.BI_RAG_TOKEN ?? "" },
          body: JSON.stringify({ question, role: role || "usuario", catalog: {}, examples: [] }),
          signal: AbortSignal.timeout(5_000),
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data && typeof data.summary === "string") {
            ragSummary = data.summary;
          }
        }
      } catch {
        // Fallback gracioso para a base de conhecimento local
      }
    }

    // Base de Conhecimento Semântica do Protocolo Periscópio Saúde
    let answer = "";
    let confidence = 0.9;
    const suggestions: string[] = [];

    if (qLower.includes("fogap") || qLower.includes("responsavel escolar") || qLower.includes("observacao docente")) {
      answer =
        "O formulário **FOGAP (Ficha de Observação Global da Atenção Primária)** é preenchido pelo Responsável Escolar (RE) a partir dos relatos docentes. Após o preenchimento dos domínios da criança e envio, o caso entra automaticamente na fila de **Revisão Médica**. O médico avaliador revisa os dados e pode delegar seções a especialistas multiprofissionais ou solicitar retificação aditiva ao RE.";
      suggestions.push("Como o médico visualiza o FOGAP?", "Quais são os domínios avaliados pelo RE?");
    } else if (
      qLower.includes("escala") ||
      qLower.includes("asq") ||
      qLower.includes("ata") ||
      qLower.includes("abc") ||
      qLower.includes("tea") ||
      qLower.includes("mchat") ||
      qLower.includes("srs")
    ) {
      answer =
        "A plataforma Periscópio integra as escalas padronizadas do protocolo de triagem e saúde mental escolar:\n\n" +
        "• **ATA (Avaliação de Traços Autísticos):** Pontuação de 0 a 45 distribuída em 23 subitens e marcos de início precoce (<36 meses).\n" +
        "• **ASQ (Ages and Stages Questionnaire):** Avalia comunicação verbal e não-verbal, com pontuação adaptativa conforme as perguntas-filtro.\n" +
        "• **ABC (Autism Behavior Checklist):** Soma de 1 a 4 por item até 160 pontos nas 5 áreas de desenvolvimento.\n" +
        "• **M-CHAT e SRS-2:** Registro clínico neutro e validado sem emissão de diagnósticos precipitados.\n\n" +
        "*Lembre-se: As escalas são ferramentas de rastreio e apoio clínico; a conclusão diagnóstica cabe exclusivamente ao médico responsável.*";
      suggestions.push("Como funciona a pontuação da escala ATA?", "Onde consultar o resultado do ASQ?");
    } else if (
      qLower.includes("cofre") ||
      qLower.includes("identidade") ||
      qLower.includes("nome") ||
      qLower.includes("cpf") ||
      qLower.includes("lgpd") ||
      qLower.includes("sigilo")
    ) {
      answer =
        "Em conformidade estrita com o **Art. 37 da LGPD**, todos os alunos são tratados na plataforma através de **códigos pseudonimizados** (ex: `ALU-XXXXXXXX`).\n\n" +
        "O **Cofre de Identidade** mantém o nome civil, CPF e dados dos responsáveis criptografados com chave AES-256 GCM. A desanonimização só é permitida a perfis clínicos autorizados mediante **justificativa clínica formal**, ficando cada acesso registrado de forma perene e imutável na trilha de auditoria para o Encarregado de Dados (DPO).";
      suggestions.push("Como solicitar acesso ao Cofre de Identidade?", "Quem audita os acessos aos dados civis?");
    } else if (
      qLower.includes("board") ||
      qLower.includes("agenda") ||
      qLower.includes("video") ||
      qLower.includes("jitsi") ||
      qLower.includes("meet") ||
      qLower.includes("chamada") ||
      qLower.includes("reuniao")
    ) {
      answer =
        "Para realizar discussão de caso ou supervisão com o **Board de Experts**:\n\n" +
        "1. Acesse o prontuário do aluno ou a página de **Agenda do Board**.\n" +
        "2. Escolha um dos horários (slots) previamente disponibilizados pelos especialistas.\n" +
        "3. Ao confirmar, o sistema persiste a reserva e envia automaticamente um e-mail transacional (Resend) aos participantes.\n" +
        "4. A sala de videochamada gratuita (**Jitsi Meet**) é gerada com link permanente e protegido, garantindo sigilo sem tráfego de dados pessoais do aluno na URL.";
      suggestions.push("Como os especialistas disponibilizam slots na agenda?", "O link da videochamada expira?");
    } else if (
      qLower.includes("100 caracter") ||
      qLower.includes("parecer") ||
      qLower.includes("minimo") ||
      qLower.includes("bloqueado") ||
      qLower.includes("concluir")
    ) {
      answer =
        "Para concluir uma seção ou parecer multiprofissional, o sistema exige um **mínimo de 100 caracteres** no campo de parecer clínico em texto livre. Essa validação Zod é um requisito deontológico (CFM, CRP, CRFa) para assegurar densidade técnica, descrição dos marcos avaliados e fundamentação clínica adequada antes do encerramento da seção.";
      suggestions.push("Posso salvar rascunho com menos de 100 caracteres?", "O que acontece após concluir o parecer?");
    } else if (
      qLower.includes("anexo") ||
      qLower.includes("laudo") ||
      qLower.includes("exame") ||
      qLower.includes("pdf") ||
      qLower.includes("upload")
    ) {
      answer =
        "Os exames complementares e laudos externos são custodiados no **Supabase Storage** sob a estrutura isolada `schools/{escolaId}/{alunoId}/{uuid}.{ext}`. Os links de visualização são assinados com validade estrita de **10 minutos (600s)**, bloqueando acessos públicos ou não autorizados e preservando o sigilo de prontuário.";
      suggestions.push("Quais formatos de arquivo são aceitos para anexos?", "Qual o tamanho máximo de upload?");
    } else if (
      qLower.includes("prazo") ||
      qLower.includes("sla") ||
      qLower.includes("90 dia") ||
      qLower.includes("cras") ||
      qLower.includes("caps") ||
      qLower.includes("ubs") ||
      qLower.includes("intersetorial")
    ) {
      answer =
        "Conforme as diretrizes da **Rede Intersetorial (Saúde, Educação e Assistência Social)** e a Lei 13.935/2019, os casos com necessidade de acolhimento em serviços da rede (CRAS, CAPS Infantil, UBS) possuem meta de acolhimento de **até 90 dias**. A plataforma monitora esse SLA em tempo real no painel intersetorial para prevenir desassistência.";
      suggestions.push("Como registrar contrarreferência do CRAS/CAPS?", "Onde acompanhar o SLA de 90 dias?");
    } else if (
      qLower.includes("login") ||
      qLower.includes("senha") ||
      qLower.includes("acesso") ||
      qLower.includes("recuperar") ||
      qLower.includes("esqueci")
    ) {
      answer =
        "Para recuperar sua senha, clique em **'Esqueci minha senha'** na tela de login e informe seu e-mail cadastrado. Um link temporário e seguro de redefinição será enviado via Resend. Caso você seja um novo profissional convidado, acesse o link enviado pela gestão escolar para realizar seu primeiro acesso e aceite do Termo de Responsabilidade Médica/LGPD.";
      suggestions.push("Quanto tempo dura o link de redefinição de senha?", "Como ativar um novo usuário convidado?");
    } else if (ragSummary) {
      answer = ragSummary;
    } else {
      answer =
        `Entendi sua dúvida sobre **"${question}"**. Nossa base de conhecimento e protocolo clínico cobrem triagem escolar (FOGAP, ATA, ASQ, ABC), agendamento de reuniões com o Board de Especialistas, governança LGPD pelo Cofre de Identidade e fluxo de prontuário multiprofissional.\n\n` +
        "Se o conteúdo acima não esclareceu completamente sua necessidade ou se você estiver enfrentando alguma dificuldade no sistema, clique no botão abaixo para **Abrir um Chamado de Suporte** e nossa equipe técnica responderá prontamente.";
      confidence = 0.6;
    }

    return {
      success: true,
      question,
      answer,
      confidence,
      canOpenTicket: true,
      suggestions,
      source: ragSummary ? "periscopio-rag" : "knowledge-base",
    };
  });

  /**
   * 3. Abertura de Chamado / Relato de Erro do Sistema
   */
  app.post("/api/support/tickets", async (request, reply) => {
    // Pode ser autenticado ou anônimo (caso o usuário esteja com erro de login)
    let actor = null;
    const hasAuth = !!(
      request.headers.authorization ||
      request.headers.cookie ||
      (process.env.NODE_ENV !== "production" && request.headers["x-test-email"])
    );
    if (hasAuth) {
      actor = await requireActor(request, reply);
      if (reply.sent) return;
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
