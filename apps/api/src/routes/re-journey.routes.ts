import type { FastifyInstance } from "fastify";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import {
  FOGAP_FORM_CODE,
  fogapSomenteSumario,
  RE_FORMS,
  RE_PASSOS,
  SNAP4_ITENS,
  isReFormId,
  normalizarPayloadReForm,
  reAssessments,
  reOptionalStepUsage,
  reStepTimings,
  schools,
  users,
  validarPayloadFogap,
  validarPayloadReForm,
  hojeBrasilia,
  type ReFormId,
} from "@periscopio/shared";
import { requireCapability } from "../security/actor";
import { can } from "../services/privilege.service";
import { sugerirObservacoes } from "../services/re-observacoes.service";
import { caseVisibleTo } from "./cases.routes";
import {
  carregarJornada,
  codigoDoPasso,
  escalasDaJornada,
  idadeAPartirDoNascimento,
  montarPayloadFogap,
  salvarMeta,
  versaoDoCodigo,
} from "../services/re-journey.service";
import { recordAudit } from "../services/audit.service";

export { idadeAPartirDoNascimento };

const payloadBody = z.object({ payload: z.record(z.unknown()) });
const sumarioBody = z.object({
  secao_sumario: z.record(z.unknown()),
  secao_encaminhamento: z.record(z.unknown()).optional(),
});
const timingBody = z.object({
  step: z.enum(["a", "b", "c", "d", "e", "f", "g", "h", "i"]),
  seconds: z.number().int().min(1).max(3600),
  novaSessao: z.boolean().optional(),
});

const SOMENTE_LEITURA = "Avaliação já enviada ao médico — somente leitura até a devolução.";

export async function reJourneyRoutes(app: FastifyInstance) {
  /**
   * Formulário único A→I: situação de cada parte, pendências (campos em branco), conteúdo salvo, dados de
   * identificação do aluno (código, escola, série, nascimento) e professores da escola para o Formulário B.
   */
  app.get("/api/cases/:caseId/re-journey", async (request, reply) => {
    const actor = await requireCapability(request, reply, "fogap.read");
    if (!actor) return;
    const { caseId } = request.params as { caseId: string };
    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });

    const j = await carregarJornada(visible.caseItem.tenantId, caseId);

    // Quem só LÊ (médico) recebe apenas o Formulário I (Sumário/FOGAP). Os formulários A a H são o bloco de notas do RE.
    const dono = await can(actor, "fogap.fill");
    if (!dono) {
      const i = j.linhas.i;
      return {
        caseState: visible.caseItem.journeyState,
        somenteSumario: true,
        forms: { i: i ? { status: i.status, payload: fogapSomenteSumario(i.payload), updatedAt: i.updatedAt } : null },
        student: {
          id: visible.student.id,
          studentCode: visible.student.studentCode,
          birthYear: visible.student.birthYear,
          birthMonth: visible.student.birthMonth,
          grade: visible.student.grade ?? null,
        },
      };
    }

    const forms: Record<string, { status: string; payload: unknown; updatedAt: Date } | null> = {};
    for (const p of RE_PASSOS) {
      const r = j.linhas[p.id];
      forms[p.id] = r ? { status: r.status, payload: r.payload, updatedAt: r.updatedAt } : null;
    }

    const [escola] = await db.select({ name: schools.name }).from(schools).where(eq(schools.id, visible.student.schoolId)).limit(1);
    const professores = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.tenantId, visible.caseItem.tenantId), eq(users.schoolId, visible.student.schoolId), eq(users.role, "teacher")));

    return {
      caseState: visible.caseItem.journeyState,
      meta: j.meta,
      situacao: j.situacao,
      escalas: await escalasDaJornada(visible.caseItem.tenantId, caseId, j),
      ata: j.ata,
      forms,
      student: {
        id: visible.student.id,
        studentCode: visible.student.studentCode,
        birthYear: visible.student.birthYear,
        birthMonth: visible.student.birthMonth,
        grade: visible.student.grade ?? null,
        schoolName: escola?.name ?? null,
      },
      professores,
      /** Quando a escola tem um único professor cadastrado, o Formulário B já nasce com o nome dele. */
      professorSugerido: professores.length === 1 ? professores[0] : null,
    };
  });

  /** Salva (rascunho) um dos formulários A a F. Sem ordem obrigatória: o RE preenche como preferir. */
  app.put("/api/cases/:caseId/re-journey/forms/:formId", async (request, reply) => {
    const actor = await requireCapability(request, reply, "fogap.fill");
    if (!actor) return;
    const { caseId, formId } = request.params as { caseId: string; formId: string };
    if (!isReFormId(formId)) return reply.status(404).send({ error: "Formulário desconhecido" });

    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });
    if (visible.caseItem.journeyState !== "rascunho") return reply.status(409).send({ error: SOMENTE_LEITURA });

    const parse = payloadBody.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ error: "Payload inválido", issues: parse.error.issues });
    const payload = normalizarPayloadReForm(formId, parse.data.payload);
    const erro = validarPayloadReForm(formId, payload);
    if (erro) return reply.status(400).send({ error: erro });
    if (formId === "f") {
      const d = payload["data_aplicacao"];
      if (typeof d === "string" && d && d > hojeBrasilia()) {
        return reply.status(400).send({ error: "A data da aplicação do IPPL-R não pode ser futura." });
      }
    }

    const tenantId = visible.caseItem.tenantId;

    // Professor(a) do Formulário B: se veio do cadastro, o servidor confere que é da escola e grava o nome oficial.
    const prof = payload["professor"] as { id?: string | null; nome?: string } | undefined;
    if (formId === "b" && prof && typeof prof === "object" && prof.id) {
      const [u] = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(and(eq(users.id, prof.id), eq(users.tenantId, tenantId), eq(users.schoolId, visible.student.schoolId), eq(users.role, "teacher")))
        .limit(1);
      if (!u) return reply.status(400).send({ error: "Professor(a) não encontrado(a) nesta escola." });
      payload["professor"] = { id: u.id, nome: u.name };
    }

    const j = await carregarJornada(tenantId, caseId);
    const atual = j.linhas[formId as ReFormId];
    if (atual && atual.status !== "rascunho" && atual.status !== "devolvido") {
      return reply.status(409).send({ error: "Formulário já enviado — somente leitura." });
    }

    let row;
    if (atual) {
      [row] = await db
        .update(reAssessments)
        .set({ payload, updatedAt: new Date() })
        .where(eq(reAssessments.id, atual.id))
        .returning();
    } else {
      [row] = await db
        .insert(reAssessments)
        .values({
          tenantId,
          caseId,
          formCode: codigoDoPasso(formId),
          formVersion: versaoDoCodigo(codigoDoPasso(formId)),
          status: "rascunho",
          payload,
          createdBy: actor.id,
        })
        .returning();
    }
    const depois = await carregarJornada(tenantId, caseId);
    return { success: true, form: { status: row.status, payload: row.payload, updatedAt: row.updatedAt }, situacao: depois.situacao };
  });

  /**
   * Formulário I (Sumário do RE). Guarda no registro do FOGAP (`secao_sumario`). Idade, grupo e série vêm do
   * cadastro do aluno: o RE não digita nada disso, e o médico recebe tudo já preenchido.
   */
  app.put("/api/cases/:caseId/re-journey/sumario", async (request, reply) => {
    const actor = await requireCapability(request, reply, "fogap.fill");
    if (!actor) return;
    const { caseId } = request.params as { caseId: string };
    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });
    if (visible.caseItem.journeyState !== "rascunho") return reply.status(409).send({ error: SOMENTE_LEITURA });

    const parse = sumarioBody.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ error: "Payload inválido", issues: parse.error.issues });

    const tenantId = visible.caseItem.tenantId;
    const j = await carregarJornada(tenantId, caseId);
    const atual = j.linhas.i;
    if (atual && atual.status !== "rascunho" && atual.status !== "devolvido") {
      return reply.status(409).send({ error: "Sumário já enviado — somente leitura." });
    }

    const payload = montarPayloadFogap({
      student: visible.student,
      atual: atual?.payload,
      secaoSumario: parse.data.secao_sumario,
      secaoEncaminhamento: parse.data.secao_encaminhamento,
    });
    const erro = validarPayloadFogap(payload);
    if (erro) return reply.status(400).send({ error: erro });

    let row;
    if (atual) {
      [row] = await db.update(reAssessments).set({ payload, updatedAt: new Date() }).where(eq(reAssessments.id, atual.id)).returning();
    } else {
      [row] = await db
        .insert(reAssessments)
        .values({
          tenantId,
          caseId,
          formCode: FOGAP_FORM_CODE,
          formVersion: versaoDoCodigo(FOGAP_FORM_CODE),
          status: "rascunho",
          payload,
          createdBy: actor.id,
        })
        .returning();
    }
    const depois = await carregarJornada(tenantId, caseId);
    return { success: true, form: { status: row.status, payload: row.payload, updatedAt: row.updatedAt }, situacao: depois.situacao };
  });

  /**
   * G (SNAP-IV) é opcional. "Não vou aplicar" trava o bloco e a jornada segue sem preenchimento.
   * Cada uso fica em `re_optional_step_usage` (somente inserção) e na trilha de auditoria.
   */
  app.post("/api/cases/:caseId/re-journey/steps/g/skip", async (request, reply) => {
    const actor = await requireCapability(request, reply, "fogap.fill");
    if (!actor) return;
    const { caseId } = request.params as { caseId: string };
    const body = z.object({ valor: z.boolean() }).safeParse(request.body ?? {});
    if (!body.success) return reply.status(400).send({ error: "Informe valor: true ou false" });

    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });
    if (visible.caseItem.journeyState !== "rascunho") return reply.status(409).send({ error: SOMENTE_LEITURA });

    const tenantId = visible.caseItem.tenantId;
    const j = await carregarJornada(tenantId, caseId);
    if (body.data.valor) {
      const respostas = ((j.linhas.g?.payload as any)?.respostas ?? {}) as Record<string, unknown>;
      if (SNAP4_ITENS.some((it) => respostas[it.id])) {
        return reply.status(409).send({ error: "O SNAP-IV já tem respostas. Conclua o preenchimento ou limpe as respostas antes de pular." });
      }
    }
    if (j.meta.g_pulado !== body.data.valor) {
      await salvarMeta({ tenantId, caseId, userId: actor.id, atual: j.metaRow, meta: { ...j.meta, g_pulado: body.data.valor } });
      await db.insert(reOptionalStepUsage).values({
        tenantId,
        schoolId: visible.student.schoolId,
        caseId,
        step: "g",
        action: body.data.valor ? "pulado" : "retomado",
        userId: actor.id,
        userRole: actor.role,
      });
      await recordAudit(
        {
          tenantId,
          userId: actor.id,
          userEmail: actor.email,
          action: body.data.valor ? "re_journey.snap4_skip" : "re_journey.snap4_resume",
          entityType: "case",
          entityId: caseId,
          payload: { studentCode: visible.student.studentCode },
        },
        request
      );
    }
    const depois = await carregarJornada(tenantId, caseId);
    return { success: true, meta: depois.meta, situacao: depois.situacao };
  });

  /** H (ATA): marcar que o responsável ainda não respondeu; a jornada segue. */
  app.post("/api/cases/:caseId/re-journey/steps/h/await", async (request, reply) => {
    const actor = await requireCapability(request, reply, "fogap.fill");
    if (!actor) return;
    const { caseId } = request.params as { caseId: string };
    const body = z.object({ valor: z.boolean() }).safeParse(request.body ?? {});
    if (!body.success) return reply.status(400).send({ error: "Informe valor: true ou false" });

    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });
    if (visible.caseItem.journeyState !== "rascunho") return reply.status(409).send({ error: SOMENTE_LEITURA });

    const tenantId = visible.caseItem.tenantId;
    const j = await carregarJornada(tenantId, caseId);
    if (body.data.valor && j.ata.enviada) return reply.status(409).send({ error: "A ATA já foi enviada." });
    if (j.meta.h_aguardando !== body.data.valor) {
      await salvarMeta({ tenantId, caseId, userId: actor.id, atual: j.metaRow, meta: { ...j.meta, h_aguardando: body.data.valor } });
      await recordAudit(
        {
          tenantId,
          userId: actor.id,
          userEmail: actor.email,
          action: "re_journey.ata_awaiting",
          entityType: "case",
          entityId: caseId,
          payload: { valor: body.data.valor, studentCode: visible.student.studentCode },
        },
        request
      );
    }
    const depois = await carregarJornada(tenantId, caseId);
    return { success: true, meta: depois.meta, situacao: depois.situacao };
  });

  /**
   * Sugestão de redação para o campo "Observações" a partir do que já foi preenchido (assistente de IA com trava e
   * reserva por regras). Não grava nada: a profissional revisa e decide. O texto da sugestão não vai para a trilha.
   */
  app.post("/api/cases/:caseId/re-journey/forms/:formId/observacoes-sugestao", async (request, reply) => {
    const actor = await requireCapability(request, reply, "fogap.fill");
    if (!actor) return;
    const { caseId, formId } = request.params as { caseId: string; formId: string };
    if (!isReFormId(formId)) return reply.status(404).send({ error: "Formulário desconhecido" });
    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });
    if (visible.caseItem.journeyState !== "rascunho") return reply.status(409).send({ error: SOMENTE_LEITURA });

    const parse = payloadBody.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ error: "Payload inválido" });
    const payload = normalizarPayloadReForm(formId, parse.data.payload);
    const out = await sugerirObservacoes(formId, payload);
    await recordAudit(
      {
        tenantId: visible.caseItem.tenantId,
        userId: actor.id,
        userEmail: actor.email,
        action: "re_journey:observacoes_sugestao",
        entityType: "case",
        entityId: caseId,
        payload: { form: formId, source: out.source },
      },
      request,
    );
    return out;
  });

  /**
   * Tempo ativo de preenchimento (observabilidade). O navegador envia apenas segundos de uso real (aba visível e
   * com interação) por parte A–I. Nenhum conteúdo clínico trafega aqui. Só vale enquanto o caso está em rascunho.
   */
  app.post("/api/cases/:caseId/re-journey/timings", async (request, reply) => {
    const actor = await requireCapability(request, reply, "fogap.fill");
    if (!actor) return;
    const { caseId } = request.params as { caseId: string };
    const body = timingBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "Informe step (a–i) e seconds (1–3600)." });

    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });
    if (visible.caseItem.journeyState !== "rascunho") return reply.status(204).send();

    const agora = new Date();
    await db
      .insert(reStepTimings)
      .values({
        tenantId: visible.caseItem.tenantId,
        schoolId: visible.student.schoolId,
        caseId,
        step: body.data.step,
        userId: actor.id,
        userRole: actor.role,
        activeSeconds: body.data.seconds,
        sessions: 1,
        firstAt: agora,
        lastAt: agora,
      })
      .onConflictDoUpdate({
        target: [reStepTimings.caseId, reStepTimings.step, reStepTimings.userId],
        set: {
          activeSeconds: sql`LEAST(86400, ${reStepTimings.activeSeconds} + ${body.data.seconds})`,
          sessions: body.data.novaSessao ? sql`${reStepTimings.sessions} + 1` : reStepTimings.sessions,
          lastAt: agora,
        },
      });
    return reply.status(204).send();
  });
}
