import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import {
  ESP_FORMS_VERSION,
  caseSpecialtyForms,
  caseSummaries,
  caseTimeline,
  formDaEspecialidade,
  isEspecialidadeId,
  normalizarPayloadDef,
  validarPayloadDef,
  ESPECIALIDADE_FORMS,
  ehFormularioDeSumario,
  type EspecialidadeId,
  type FormDef,
} from "@periscopio/shared";
import { requireCapability, type Actor } from "../security/actor";
import { recordAudit } from "../services/audit.service";
import { caseVisibleTo } from "./cases.routes";

const salvarBody = z.object({
  payload: z.record(z.string(), z.unknown()),
  ifUpdatedAt: z.string().datetime().optional(),
});
const reabrirBody = z.object({ reason: z.string().trim().min(3, "Informe o motivo da reabertura").max(500) });

async function secaoDoEspecialista(actor: Actor, sectionId: string) {
  const [section] = await db
    .select()
    .from(caseSummaries)
    .where(and(eq(caseSummaries.id, sectionId), eq(caseSummaries.tenantId, actor.tenantId)))
    .limit(1);
  if (!section) return { ok: false as const, status: 404, mensagem: "Seção não encontrada" };
  // Só o profissional a quem a seção foi delegada lê ou escreve os formulários dela.
  if (section.assignedProfessionalId !== actor.id) return { ok: false as const, status: 403, mensagem: "Esta seção não está atribuída ao seu perfil" };
  return { ok: true as const, section };
}

/**
 * Formulários das especialidades. O especialista preenche somente os formulários da sua seção delegada.
 * O conteúdo clínico nunca vai para a trilha nem para o log de auditoria: só quem fez, quando e qual formulário.
 * Rascunho só o autor enxerga; o médico lê os formulários quando a seção é concluída.
 */
export async function specialtyFormsRoutes(app: FastifyInstance) {
  app.get("/api/cases/sections/:sectionId/forms", async (request, reply) => {
    const actor = await requireCapability(request, reply, "section.read");
    if (!actor) return;
    const { sectionId } = request.params as { sectionId: string };
    const r = await secaoDoEspecialista(actor, sectionId);
    if (!r.ok) return reply.status(r.status).send({ error: r.mensagem });
    const { section } = r;

    const catalogo = isEspecialidadeId(section.specialty) ? ESPECIALIDADE_FORMS[section.specialty] : [];
    const rows = await db
      .select()
      .from(caseSpecialtyForms)
      .where(and(eq(caseSpecialtyForms.sectionId, section.id), eq(caseSpecialtyForms.tenantId, actor.tenantId)));
    const porId = new Map(rows.map((x) => [x.formId, x]));

    return {
      version: ESP_FORMS_VERSION,
      specialty: section.specialty,
      sectionStatus: section.status,
      editavel: section.status !== "concluido",
      forms: catalogo.map((f) => {
        const x = porId.get(f.id);
        const payload = normalizarPayloadDef(f, (x?.payload as Record<string, unknown>) ?? {});
        return {
          id: f.id,
          status: x?.status ?? "nao_iniciado",
          payload,
          updatedAt: x?.updatedAt ?? null,
          completedAt: x?.completedAt ?? null,
          reaberturas: Array.isArray(x?.history) ? (x!.history as unknown[]).length : 0,
        };
      }),
    };
  });

  app.put("/api/cases/sections/:sectionId/forms/:formId", async (request, reply) => {
    const actor = await requireCapability(request, reply, "section.fill");
    if (!actor) return;
    const { sectionId, formId } = request.params as { sectionId: string; formId: string };
    const body = salvarBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "Dados inválidos", issues: body.error.issues });

    const r = await secaoDoEspecialista(actor, sectionId);
    if (!r.ok) return reply.status(r.status).send({ error: r.mensagem });
    const { section } = r;
    const form = formDaEspecialidade(section.specialty, formId);
    if (!form) return reply.status(404).send({ error: "Formulário não encontrado para esta especialidade" });
    if (section.status === "concluido") return reply.status(409).send({ error: "Seção já concluída — somente leitura" });

    const erro = validarPayloadDef(form, body.data.payload);
    if (erro) return reply.status(400).send({ error: erro });
    const payload = normalizarPayloadDef(form, body.data.payload);

    const [atual] = await db
      .select()
      .from(caseSpecialtyForms)
      .where(and(eq(caseSpecialtyForms.sectionId, section.id), eq(caseSpecialtyForms.formId, formId)))
      .limit(1);
    if (atual?.status === "concluido") return reply.status(409).send({ error: "Formulário concluído. Para alterar, reabra com o motivo." });

    if (body.data.ifUpdatedAt && atual) {
      const serverTs = atual.updatedAt ? new Date(atual.updatedAt).toISOString() : null;
      if (serverTs !== body.data.ifUpdatedAt) {
        return reply.status(409).send({ error: "Registro foi modificado por outra sessão. Recarregue e tente novamente." });
      }
    }

    let saved;
    if (atual) {
      [saved] = await db
        .update(caseSpecialtyForms)
        .set({ payload, formVersion: ESP_FORMS_VERSION, updatedAt: new Date() })
        .where(eq(caseSpecialtyForms.id, atual.id))
        .returning();
    } else {
      [saved] = await db
        .insert(caseSpecialtyForms)
        .values({
          tenantId: actor.tenantId,
          caseId: section.caseId,
          sectionId: section.id,
          specialty: section.specialty,
          formId,
          formVersion: ESP_FORMS_VERSION,
          status: "rascunho",
          payload,
          authorId: actor.id,
        })
        .returning();
    }

    await recordAudit(
      {
        tenantId: actor.tenantId,
        userId: actor.id,
        userEmail: actor.email,
        action: "specialty_form.save",
        entityType: "case",
        entityId: section.caseId,
        payload: { formId, specialty: section.specialty },
      },
      request
    );
    return { form: { id: formId, status: saved.status, payload, updatedAt: saved.updatedAt } };
  });

  app.post("/api/cases/sections/:sectionId/forms/:formId/complete", async (request, reply) => {
    const actor = await requireCapability(request, reply, "section.fill");
    if (!actor) return;
    const { sectionId, formId } = request.params as { sectionId: string; formId: string };
    const r = await secaoDoEspecialista(actor, sectionId);
    if (!r.ok) return reply.status(r.status).send({ error: r.mensagem });
    const { section } = r;
    const form = formDaEspecialidade(section.specialty, formId);
    if (!form) return reply.status(404).send({ error: "Formulário não encontrado para esta especialidade" });
    if (section.status === "concluido") return reply.status(409).send({ error: "Seção já concluída — somente leitura" });

    const [atual] = await db
      .select()
      .from(caseSpecialtyForms)
      .where(and(eq(caseSpecialtyForms.sectionId, section.id), eq(caseSpecialtyForms.formId, formId)))
      .limit(1);
    if (!atual) return reply.status(409).send({ error: "Salve o rascunho antes de concluir." });
    if (atual.status === "concluido") return reply.status(409).send({ error: "Formulário já concluído." });
    const payload = normalizarPayloadDef(form, atual.payload as Record<string, unknown>);
    if (Object.keys(payload).length === 0) return reply.status(400).send({ error: "O formulário está em branco. Preencha antes de concluir." });

    const agora = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(caseSpecialtyForms)
        .set({ status: "concluido", completedAt: agora, completedBy: actor.id, updatedAt: agora })
        .where(eq(caseSpecialtyForms.id, atual.id));
      await tx.insert(caseTimeline).values({
        tenantId: actor.tenantId,
        caseId: section.caseId,
        actorId: actor.id,
        event: "specialty_form:completed",
        payload: { sectionId: section.id, formId, specialty: section.specialty, actorRole: actor.role },
      });
    });

    await recordAudit(
      { tenantId: actor.tenantId, userId: actor.id, userEmail: actor.email, action: "specialty_form.complete", entityType: "case", entityId: section.caseId, payload: { formId, specialty: section.specialty } },
      request
    );
    return { form: { id: formId, status: "concluido", completedAt: agora } };
  });

  app.post("/api/cases/sections/:sectionId/forms/:formId/reopen", async (request, reply) => {
    const actor = await requireCapability(request, reply, "section.fill");
    if (!actor) return;
    const { sectionId, formId } = request.params as { sectionId: string; formId: string };
    const body = reabrirBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0]?.message ?? "Dados inválidos" });

    const r = await secaoDoEspecialista(actor, sectionId);
    if (!r.ok) return reply.status(r.status).send({ error: r.mensagem });
    const { section } = r;
    if (!formDaEspecialidade(section.specialty, formId)) return reply.status(404).send({ error: "Formulário não encontrado para esta especialidade" });
    // Com a seção concluída o médico já pode ter lido: só reabre pelo fluxo formal da seção.
    if (section.status === "concluido") return reply.status(409).send({ error: "Seção já concluída — somente leitura" });

    const [atual] = await db
      .select()
      .from(caseSpecialtyForms)
      .where(and(eq(caseSpecialtyForms.sectionId, section.id), eq(caseSpecialtyForms.formId, formId)))
      .limit(1);
    if (!atual || atual.status !== "concluido") return reply.status(409).send({ error: "Só é possível reabrir um formulário concluído." });

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
        .update(caseSpecialtyForms)
        .set({ status: "rascunho", completedAt: null, completedBy: null, history: novoHistorico, updatedAt: agora })
        .where(eq(caseSpecialtyForms.id, atual.id));
      await tx.insert(caseTimeline).values({
        tenantId: actor.tenantId,
        caseId: section.caseId,
        actorId: actor.id,
        event: "specialty_form:reopened",
        payload: { sectionId: section.id, formId, specialty: section.specialty, actorRole: actor.role, reason: body.data.reason },
      });
    });

    await recordAudit(
      { tenantId: actor.tenantId, userId: actor.id, userEmail: actor.email, action: "specialty_form.reopen", entityType: "case", entityId: section.caseId, payload: { formId, specialty: section.specialty } },
      request
    );
    return { form: { id: formId, status: "rascunho" } };
  });

  /**
   * Leitura do médico: SÓ o sumário de cada especialidade (ver ESPECIALIDADE_SUMARIOS), e só de seção JÁ CONCLUÍDA.
   * Os demais formulários são o "bloco de notas" do especialista: nunca saem daqui. Seção em andamento não aparece,
   * nem o rascunho. Só o médico responsável (mesma capacidade do prontuário consolidado).
   */
  app.get("/api/cases/:caseId/specialty-forms", async (request, reply) => {
    const actor = await requireCapability(request, reply, "prontuario.consolidado.read");
    if (!actor) return;
    const { caseId } = request.params as { caseId: string };
    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });

    const secoes = await db
      .select({ id: caseSummaries.id, specialty: caseSummaries.specialty, completedAt: caseSummaries.completedAt })
      .from(caseSummaries)
      .where(and(eq(caseSummaries.caseId, caseId), eq(caseSummaries.tenantId, actor.tenantId), eq(caseSummaries.status, "concluido")));
    const rows = await db
      .select()
      .from(caseSpecialtyForms)
      .where(and(eq(caseSpecialtyForms.caseId, caseId), eq(caseSpecialtyForms.tenantId, actor.tenantId)));

    const out = secoes.map((s) => {
      const esp = s.specialty;
      const catalogo = isEspecialidadeId(esp) ? ESPECIALIDADE_FORMS[esp as EspecialidadeId] : [];
      const sumarios = catalogo.filter((f) => ehFormularioDeSumario(esp, f.id));
      const formularios = sumarios
        .map((f) => {
          const x = rows.find((row) => row.sectionId === s.id && row.formId === f.id);
          if (!x) return null;
          const payload = normalizarPayloadDef(f, x.payload as Record<string, unknown>);
          if (Object.keys(payload).length === 0) return null;
          return { id: f.id, status: x.status, payload, completedAt: x.completedAt };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      return { sectionId: s.id, specialty: esp, completedAt: s.completedAt, sumarioPreenchido: formularios.length > 0, forms: formularios };
    });

    await recordAudit(
      { tenantId: actor.tenantId, userId: actor.id, userEmail: actor.email, action: "specialty_forms.read", entityType: "case", entityId: caseId, payload: { studentCode: visible.student.studentCode } },
      request
    );
    return { version: ESP_FORMS_VERSION, sections: out };
  });
}
