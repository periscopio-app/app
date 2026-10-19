import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import {
  FOGAP_FORM_CODE,
  RE_FORMS,
  RE_PASSOS,
  isReFormId,
  isRePassoId,
  makeFogapPayloadVazio,
  passoEstado,
  prontoParaRevisao,
  reAssessments,
  rotearPorIdade,
  sumarioComPadroes,
  validarPayloadFogap,
  validarPayloadReForm,
  hojeBrasilia,
  type FogapPayload,
  type RePassoId,
} from "@periscopio/shared";
import { requireCapability } from "../security/actor";
import { caseVisibleTo } from "./cases.routes";
import { carregarJornada, codigoDoPasso, salvarMeta, versaoDoCodigo } from "../services/re-journey.service";
import { recordAudit } from "../services/audit.service";

/** Idade em anos e meses a partir do ano/mês de nascimento (o sistema não guarda a data completa). */
export function idadeAPartirDoNascimento(birthYear: number, birthMonth: number, hoje = hojeBrasilia()): { anos: number; meses: number } {
  const [y, m] = hoje.split("-").map(Number);
  const total = y * 12 + m - (birthYear * 12 + birthMonth);
  if (total < 0) return { anos: -1, meses: 0 };
  return { anos: Math.floor(total / 12), meses: total % 12 };
}

const payloadBody = z.object({ payload: z.record(z.unknown()) });
const sumarioBody = z.object({
  secao_sumario: z.record(z.unknown()),
  secao_encaminhamento: z.record(z.unknown()).optional(),
});

export async function reJourneyRoutes(app: FastifyInstance) {
  /** Estado completo da jornada A→I: passos, quem está liberado e o conteúdo salvo de cada formulário. */
  app.get("/api/cases/:caseId/re-journey", async (request, reply) => {
    const actor = await requireCapability(request, reply, "fogap.read");
    if (!actor) return;
    const { caseId } = request.params as { caseId: string };
    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });

    const j = await carregarJornada(visible.caseItem.tenantId, caseId);
    const forms: Record<string, { status: string; payload: unknown; updatedAt: Date } | null> = {};
    for (const p of RE_PASSOS) {
      const r = j.linhas[p.id];
      forms[p.id] = r ? { status: r.status, payload: r.payload, updatedAt: r.updatedAt } : null;
    }
    return {
      caseState: visible.caseItem.journeyState,
      meta: j.meta,
      situacao: j.situacao,
      ata: j.ata,
      forms,
      student: {
        studentCode: visible.student.studentCode,
        birthYear: visible.student.birthYear,
        birthMonth: visible.student.birthMonth,
      },
    };
  });

  /** Salva (rascunho) um dos formulários A a F. O passo precisa estar liberado. */
  app.put("/api/cases/:caseId/re-journey/forms/:formId", async (request, reply) => {
    const actor = await requireCapability(request, reply, "fogap.fill");
    if (!actor) return;
    const { caseId, formId } = request.params as { caseId: string; formId: string };
    if (!isReFormId(formId)) return reply.status(404).send({ error: "Formulário desconhecido" });

    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });
    if (visible.caseItem.journeyState !== "rascunho") {
      return reply.status(409).send({ error: "Avaliação já enviada ao médico — somente leitura até a devolução." });
    }

    const parse = payloadBody.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ error: "Payload inválido", issues: parse.error.issues });
    const erro = validarPayloadReForm(formId, parse.data.payload);
    if (erro) return reply.status(400).send({ error: erro });
    if (formId === "f") {
      const d = parse.data.payload["data_aplicacao"];
      if (typeof d === "string" && d && d > hojeBrasilia()) {
        return reply.status(400).send({ error: "A data da aplicação não pode ser futura." });
      }
    }

    const tenantId = visible.caseItem.tenantId;
    const j = await carregarJornada(tenantId, caseId);
    if (passoEstado(j.situacao, formId) === "bloqueado") {
      return reply.status(409).send({ error: `Conclua o formulário anterior antes de abrir o Formulário ${RE_FORMS[formId].letra}.` });
    }

    const atual = j.linhas[formId];
    if (atual && atual.status !== "rascunho" && atual.status !== "devolvido") {
      return reply.status(409).send({ error: "Formulário já enviado — somente leitura." });
    }

    let row;
    if (atual) {
      [row] = await db
        .update(reAssessments)
        .set({ payload: parse.data.payload, updatedAt: new Date() })
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
          payload: parse.data.payload,
          createdBy: actor.id,
        })
        .returning();
    }
    return { success: true, form: { status: row.status, payload: row.payload, updatedAt: row.updatedAt } };
  });

  /**
   * Formulário I (Sumário do RE). Guarda no registro do FOGAP (`secao_sumario`), com a idade e o grupo
   * calculados a partir do ano/mês de nascimento do aluno — o RE não digita idade.
   */
  app.put("/api/cases/:caseId/re-journey/sumario", async (request, reply) => {
    const actor = await requireCapability(request, reply, "fogap.fill");
    if (!actor) return;
    const { caseId } = request.params as { caseId: string };
    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });
    if (visible.caseItem.journeyState !== "rascunho") {
      return reply.status(409).send({ error: "Avaliação já enviada ao médico — somente leitura até a devolução." });
    }

    const parse = sumarioBody.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ error: "Payload inválido", issues: parse.error.issues });

    const tenantId = visible.caseItem.tenantId;
    const j = await carregarJornada(tenantId, caseId);
    if (passoEstado(j.situacao, "i") === "bloqueado") {
      return reply.status(409).send({ error: "Conclua os formulários anteriores (A a H) antes do Sumário." });
    }
    const atual = j.linhas.i;
    if (atual && atual.status !== "rascunho" && atual.status !== "devolvido") {
      return reply.status(409).send({ error: "Sumário já enviado — somente leitura." });
    }

    const base: FogapPayload = { ...makeFogapPayloadVazio(), ...((atual?.payload as Partial<FogapPayload>) ?? {}) };
    const idade = idadeAPartirDoNascimento(visible.student.birthYear ?? 0, visible.student.birthMonth ?? 1);
    const rota = rotearPorIdade(idade.anos, idade.meses);
    const payload: FogapPayload = {
      ...base,
      fogap_state: rota.estado,
      grupo: "grupo" in rota ? rota.grupo : null,
      idade_anos: idade.anos >= 0 ? idade.anos : null,
      idade_meses: idade.anos >= 0 ? idade.meses : null,
      total_meses: "total_meses" in rota ? rota.total_meses : null,
      secao_sumario: sumarioComPadroes({ ...(parse.data.secao_sumario as object) }),
      secao_encaminhamento: (parse.data.secao_encaminhamento as unknown as FogapPayload["secao_encaminhamento"] | undefined) ?? base.secao_encaminhamento,
    };
    const erro = validarPayloadFogap(payload);
    if (erro) return reply.status(400).send({ error: erro });

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
          formCode: FOGAP_FORM_CODE,
          formVersion: versaoDoCodigo(FOGAP_FORM_CODE),
          status: "rascunho",
          payload,
          createdBy: actor.id,
        })
        .returning();
    }
    return { success: true, form: { status: row.status, payload: row.payload, updatedAt: row.updatedAt } };
  });

  /** Conclui um passo (libera o próximo). Precisa ter algo salvo; em branco continua permitido. */
  app.post("/api/cases/:caseId/re-journey/steps/:passo/conclude", async (request, reply) => {
    const actor = await requireCapability(request, reply, "fogap.fill");
    if (!actor) return;
    const { caseId, passo } = request.params as { caseId: string; passo: string };
    if (!isRePassoId(passo)) return reply.status(404).send({ error: "Passo desconhecido" });

    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });
    if (visible.caseItem.journeyState !== "rascunho") {
      return reply.status(409).send({ error: "Avaliação já enviada ao médico — somente leitura até a devolução." });
    }

    const tenantId = visible.caseItem.tenantId;
    const j = await carregarJornada(tenantId, caseId);
    const estado = passoEstado(j.situacao, passo);
    const letra = RE_PASSOS.find((p) => p.id === passo)!.letra;
    if (estado === "bloqueado") {
      return reply.status(409).send({ error: `Conclua os formulários anteriores antes do Formulário ${letra}.` });
    }

    if (passo === "h") {
      if (!j.ata.enviada) {
        return reply.status(422).send({
          error: "A ATA ainda não foi enviada. Envie a ATA ou marque \"Aguardando o responsável\" para seguir.",
        });
      }
    } else {
      const linha = j.linhas[passo];
      if (!linha) {
        return reply.status(422).send({ error: `Salve o Formulário ${letra} antes de concluir.` });
      }
      if (passo === "i") {
        const { pronto, pendencias } = prontoParaRevisao(linha.payload as FogapPayload);
        if (!pronto) {
          return reply.status(422).send({
            error: "Não é possível concluir o Sumário: a idade do aluno precisa estar na faixa do piloto (6 a 9 anos e 11 meses).",
            pendencias,
          });
        }
      }
    }

    const meta = { ...j.meta, concluidos: { ...j.meta.concluidos, [passo]: new Date().toISOString() } };
    if (passo === "g") meta.g_pulado = false;
    if (passo === "h") meta.h_aguardando = false;
    await salvarMeta({ tenantId, caseId, userId: actor.id, atual: j.metaRow, meta });

    await recordAudit(
      {
        tenantId,
        userId: actor.id,
        userEmail: actor.email,
        action: "re_journey.step_concluded",
        entityType: "case",
        entityId: caseId,
        payload: { passo, studentCode: visible.student.studentCode },
      },
      request
    );

    const depois = await carregarJornada(tenantId, caseId);
    return { success: true, meta: depois.meta, situacao: depois.situacao };
  });

  /** G (SNAP-IV) é opcional: pular ou voltar atrás. */
  app.post("/api/cases/:caseId/re-journey/steps/g/skip", async (request, reply) => {
    return alterarFlag(request, reply, "g_pulado");
  });

  /** H (ATA): marcar que o responsável ainda não respondeu; a jornada segue. */
  app.post("/api/cases/:caseId/re-journey/steps/h/await", async (request, reply) => {
    return alterarFlag(request, reply, "h_aguardando");
  });

  async function alterarFlag(request: any, reply: any, flag: "g_pulado" | "h_aguardando") {
    const actor = await requireCapability(request, reply, "fogap.fill");
    if (!actor) return;
    const { caseId } = request.params as { caseId: string };
    const body = z.object({ valor: z.boolean() }).safeParse(request.body ?? {});
    if (!body.success) return reply.status(400).send({ error: "Informe valor: true ou false" });

    const visible = await caseVisibleTo(actor, caseId);
    if (!visible) return reply.status(404).send({ error: "Caso não encontrado" });
    if (visible.caseItem.journeyState !== "rascunho") {
      return reply.status(409).send({ error: "Avaliação já enviada ao médico — somente leitura até a devolução." });
    }

    const passo: RePassoId = flag === "g_pulado" ? "g" : "h";
    const tenantId = visible.caseItem.tenantId;
    const j = await carregarJornada(tenantId, caseId);
    if (passoEstado(j.situacao, passo) === "bloqueado") {
      return reply.status(409).send({ error: "Conclua os formulários anteriores primeiro." });
    }
    if (body.data.valor && j.meta.concluidos[passo]) {
      return reply.status(409).send({ error: "Este formulário já foi concluído." });
    }
    if (flag === "h_aguardando" && body.data.valor && j.ata.enviada) {
      return reply.status(409).send({ error: "A ATA já foi enviada." });
    }

    const meta = { ...j.meta, [flag]: body.data.valor };
    await salvarMeta({ tenantId, caseId, userId: actor.id, atual: j.metaRow, meta });

    await recordAudit(
      {
        tenantId,
        userId: actor.id,
        userEmail: actor.email,
        action: flag === "g_pulado" ? "re_journey.snap4_skip" : "re_journey.ata_awaiting",
        entityType: "case",
        entityId: caseId,
        payload: { valor: body.data.valor, studentCode: visible.student.studentCode },
      },
      request
    );

    const depois = await carregarJornada(tenantId, caseId);
    return { success: true, meta: depois.meta, situacao: depois.situacao };
  }
}

