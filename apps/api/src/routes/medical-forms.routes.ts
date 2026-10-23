import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import {
  MD_FORMS,
  MD_FORMS_VERSION,
  MD_FORM_IDS,
  MD_INSTRUMENTOS_EXTERNOS,
  caseMedicalForms,
  caseTimeline,
  isMdFormId,
  medicoTemConteudo,
  normalizarPayloadMedico,
} from "@periscopio/shared";
import { requireCapability } from "../security/actor";
import { recordAudit } from "../services/audit.service";
import { caseVisibleTo } from "./cases.routes";

/** Estados em que o médico pode escrever: do recebimento até o encerramento. */
const ESTADOS_EDITAVEIS = new Set(["revisao_medica", "delegado", "retornado"]);

const salvarBody = z.object({ payload: z.record(z.unknown()) });
const reabrirBody = z.object({ reason: z.string().trim().min(3, "Informe o motivo da reabertura").max(500) });

/**
 * Formulários do médico. Só texto livre curto (md-0.2, estrutura provisória até a validação clínica).
 * O conteúdo clínico nunca vai para a trilha nem para o log de auditoria: só quem fez, quando e qual seção.
 */
export async function medicalFormsRoutes(app: FastifyInstance) {
  app.get("/api/cases/:caseId/medical-forms", async (request, reply) => {
    const actor = await requireCapability(request, reply, "md.form.read");
    if (!actor) return;
    const { caseId } = request.params as { caseId: string };
    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });

    const rows = await db
      .select()
      .from(caseMedicalForms)
      .where(and(eq(caseMedicalForms.caseId, caseId), eq(caseMedicalForms.tenantId, visible.caseItem.tenantId)));
    const porId = new Map(rows.map((r) => [r.formId, r]));

    return {
      version: MD_FORMS_VERSION,
      caseState: visible.caseItem.journeyState,
      editavel: ESTADOS_EDITAVEIS.has(visible.caseItem.journeyState),
      instrumentosExternos: MD_INSTRUMENTOS_EXTERNOS,
      forms: MD_FORM_IDS.map((id) => {
        const r = porId.get(id);
        return {
          id,
          titulo: MD_FORMS[id].titulo,
          status: r?.status ?? "nao_iniciado",
          payload: r ? normalizarPayloadMedico(id, r.payload) : normalizarPayloadMedico(id, {}),
          updatedAt: r?.updatedAt ?? null,
          completedAt: r?.completedAt ?? null,
          reaberturas: Array.isArray(r?.history) ? (r!.history as unknown[]).length : 0,
        };
      }),
    };
  });

  app.put("/api/cases/:caseId/medical-forms/:formId", async (request, reply) => {
    const actor = await requireCapability(request, reply, "md.form.fill");
    if (!actor) return;
    const { caseId, formId } = request.params as { caseId: string; formId: string };
    if (!isMdFormId(formId)) return reply.status(404).send({ error: "Formulário não encontrado" });
    const body = salvarBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "Dados inválidos", issues: body.error.issues });

    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });
    if (!ESTADOS_EDITAVEIS.has(visible.caseItem.journeyState)) {
      return reply.status(409).send({ error: "Os formulários do médico ficam abertos da revisão médica até o encerramento do caso." });
    }

    const payload = normalizarPayloadMedico(formId, body.data.payload);
    const tenantId = visible.caseItem.tenantId;

    const [atual] = await db
      .select()
      .from(caseMedicalForms)
      .where(and(eq(caseMedicalForms.caseId, caseId), eq(caseMedicalForms.formId, formId)))
      .limit(1);

    if (atual?.status === "concluido") {
      return reply.status(409).send({ error: "Seção concluída. Para alterar, reabra com o motivo." });
    }

    let saved;
    if (atual) {
      [saved] = await db
        .update(caseMedicalForms)
        .set({ payload, formVersion: MD_FORMS_VERSION, updatedAt: new Date() })
        .where(eq(caseMedicalForms.id, atual.id))
        .returning();
    } else {
      [saved] = await db
        .insert(caseMedicalForms)
        .values({ tenantId, caseId, formId, formVersion: MD_FORMS_VERSION, status: "rascunho", payload, authorId: actor.id })
        .returning();
    }

    await recordAudit(
      {
        tenantId,
        userId: actor.id,
        userEmail: actor.email,
        action: "medical_form.save",
        entityType: "case",
        entityId: caseId,
        payload: { formId, studentCode: visible.student.studentCode },
      },
      request
    );

    return { form: { id: formId, status: saved.status, payload, updatedAt: saved.updatedAt } };
  });

  app.post("/api/cases/:caseId/medical-forms/:formId/complete", async (request, reply) => {
    const actor = await requireCapability(request, reply, "md.form.fill");
    if (!actor) return;
    const { caseId, formId } = request.params as { caseId: string; formId: string };
    if (!isMdFormId(formId)) return reply.status(404).send({ error: "Formulário não encontrado" });

    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });
    if (!ESTADOS_EDITAVEIS.has(visible.caseItem.journeyState)) {
      return reply.status(409).send({ error: "Os formulários do médico ficam abertos da revisão médica até o encerramento do caso." });
    }

    const [atual] = await db
      .select()
      .from(caseMedicalForms)
      .where(and(eq(caseMedicalForms.caseId, caseId), eq(caseMedicalForms.formId, formId)))
      .limit(1);
    if (!atual) return reply.status(409).send({ error: "Salve o rascunho antes de concluir." });
    if (atual.status === "concluido") return reply.status(409).send({ error: "Seção já concluída." });
    if (!medicoTemConteudo(normalizarPayloadMedico(formId, atual.payload))) {
      return reply.status(400).send({ error: "A seção está em branco. Escreva o registro antes de concluir." });
    }

    const tenantId = visible.caseItem.tenantId;
    const agora = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(caseMedicalForms)
        .set({ status: "concluido", completedAt: agora, completedBy: actor.id, updatedAt: agora })
        .where(eq(caseMedicalForms.id, atual.id));
      await tx.insert(caseTimeline).values({
        tenantId,
        caseId,
        actorId: actor.id,
        event: "md_form:completed",
        payload: { formId, actorRole: actor.role },
      });
    });

    await recordAudit(
      { tenantId, userId: actor.id, userEmail: actor.email, action: "medical_form.complete", entityType: "case", entityId: caseId, payload: { formId, studentCode: visible.student.studentCode } },
      request
    );
    return { form: { id: formId, status: "concluido", completedAt: agora } };
  });

  app.post("/api/cases/:caseId/medical-forms/:formId/reopen", async (request, reply) => {
    const actor = await requireCapability(request, reply, "md.form.fill");
    if (!actor) return;
    const { caseId, formId } = request.params as { caseId: string; formId: string };
    if (!isMdFormId(formId)) return reply.status(404).send({ error: "Formulário não encontrado" });
    const body = reabrirBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0]?.message ?? "Dados inválidos" });

    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });
    if (!ESTADOS_EDITAVEIS.has(visible.caseItem.journeyState)) {
      return reply.status(409).send({ error: "Os formulários do médico ficam abertos da revisão médica até o encerramento do caso." });
    }

    const [atual] = await db
      .select()
      .from(caseMedicalForms)
      .where(and(eq(caseMedicalForms.caseId, caseId), eq(caseMedicalForms.formId, formId)))
      .limit(1);
    if (!atual || atual.status !== "concluido") return reply.status(409).send({ error: "Só é possível reabrir uma seção concluída." });

    const tenantId = visible.caseItem.tenantId;
    const agora = new Date();
    const historico = Array.isArray(atual.history) ? (atual.history as unknown[]) : [];
    // Guarda a versão que estava concluída: a retificação nunca apaga a resposta original.
    const novoHistorico = [
      ...historico,
      {
        payload: atual.payload,
        completedAt: atual.completedAt,
        completedBy: atual.completedBy,
        reopenedAt: agora.toISOString(),
        reopenedBy: actor.id,
        reason: body.data.reason,
      },
    ];

    await db.transaction(async (tx) => {
      await tx
        .update(caseMedicalForms)
        .set({ status: "rascunho", completedAt: null, completedBy: null, history: novoHistorico, updatedAt: agora })
        .where(eq(caseMedicalForms.id, atual.id));
      await tx.insert(caseTimeline).values({
        tenantId,
        caseId,
        actorId: actor.id,
        event: "md_form:reopened",
        payload: { formId, actorRole: actor.role, reason: body.data.reason },
      });
    });

    await recordAudit(
      { tenantId, userId: actor.id, userEmail: actor.email, action: "medical_form.reopen", entityType: "case", entityId: caseId, payload: { formId, studentCode: visible.student.studentCode } },
      request
    );
    return { form: { id: formId, status: "rascunho" } };
  });
}
