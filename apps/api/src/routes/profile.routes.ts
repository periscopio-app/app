import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { users, schools, tenants, lgpdRequests } from "@periscopio/shared";
import { requireActor } from "../security/actor";
import { ROLE_HUMAN_LABELS } from "../security/roles";
import { recordAudit } from "../services/audit.service";
import {
  chaveDoAvatar,
  chavePertenceAoUsuario,
  getAvatarStorage,
  urlDoAvatar,
  validarFoto,
} from "../services/avatar.service";
import { mascararCpf, normalizarTelefone, perfilPatchSchema, textoOuNulo } from "../services/profile.service";
import { metricasDoUsuario } from "../services/profile-metrics.service";

/**
 * "Meu painel": cada pessoa lê e edita os próprios dados, troca a foto e vê as métricas do seu trabalho.
 * Toda rota age só sobre o usuário da sessão (nunca recebe id na URL), então não há como mexer na conta de outra pessoa.
 */
export async function profileRoutes(app: FastifyInstance) {
  async function carregarPerfil(userId: string) {
    const [row] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        specialty: users.specialty,
        classCode: users.classCode,
        phone: users.phone,
        cpf: users.cpf,
        bio: users.bio,
        avatarKey: users.avatarKey,
        avatarUpdatedAt: users.avatarUpdatedAt,
        tenantId: users.tenantId,
        schoolId: users.schoolId,
        schoolName: schools.name,
        tenantName: tenants.name,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(schools, eq(users.schoolId, schools.id))
      .leftJoin(tenants, eq(users.tenantId, tenants.id))
      .where(eq(users.id, userId))
      .limit(1);
    return row ?? null;
  }

  async function montarResposta(row: NonNullable<Awaited<ReturnType<typeof carregarPerfil>>>) {
    const [pedido] = await db
      .select({ id: lgpdRequests.id, createdAt: lgpdRequests.createdAt })
      .from(lgpdRequests)
      .where(and(eq(lgpdRequests.requesterEmail, row.email.toLowerCase()), eq(lgpdRequests.kind, "deletion"), eq(lgpdRequests.status, "pending")))
      .orderBy(desc(lgpdRequests.createdAt))
      .limit(1);

    return {
      profile: {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        roleLabel: ROLE_HUMAN_LABELS[row.role] ?? row.role,
        specialty: row.specialty,
        classCode: row.classCode,
        phone: row.phone,
        cpfMasked: mascararCpf(row.cpf),
        bio: row.bio,
        avatarUrl: await urlDoAvatar(row.avatarKey),
        avatarUpdatedAt: row.avatarUpdatedAt,
        school: row.schoolId ? { id: row.schoolId, name: row.schoolName } : null,
        tenantName: row.tenantName,
        createdAt: row.createdAt,
        deletionRequest: pedido ? { protocol: pedido.id, createdAt: pedido.createdAt } : null,
        // o que a pessoa pode editar aqui; o resto é definido pela gestão da plataforma
        editable: ["name", "phone", "bio"],
      },
    };
  }

  /** Ler o próprio perfil. */
  app.get("/api/me/profile", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;
    const row = await carregarPerfil(actor.id);
    if (!row) {
      reply.status(404);
      return { error: "Esta conta administrativa não tem cadastro de perfil para editar." };
    }
    return montarResposta(row);
  });

  /** Atualizar nome, telefone e apresentação. Apagar um campo = enviar null ou texto vazio. */
  app.patch("/api/me/profile", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    const parsed = perfilPatchSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.status(400);
      const campoExtra = parsed.error.issues.find((i) => i.code === "unrecognized_keys");
      return {
        error: campoExtra
          ? "Só nome, telefone e apresentação podem ser alterados aqui. Para os demais dados, fale com a gestão da plataforma."
          : parsed.error.issues[0]?.message ?? "Dados inválidos.",
      };
    }
    const dados = parsed.data;
    if (Object.keys(dados).length === 0) {
      reply.status(400);
      return { error: "Nada para atualizar." };
    }

    const atual = await carregarPerfil(actor.id);
    if (!atual) {
      reply.status(404);
      return { error: "Esta conta administrativa não tem cadastro de perfil para editar." };
    }

    const set: Partial<{ name: string; phone: string | null; bio: string | null }> = {};
    const campos: string[] = [];
    if (dados.name !== undefined && dados.name !== atual.name) {
      set.name = dados.name;
      campos.push("name");
    }
    if (dados.phone !== undefined) {
      const tel = normalizarTelefone(dados.phone);
      if (!tel.ok) {
        reply.status(400);
        return { error: tel.error };
      }
      if (tel.value !== (atual.phone ?? null)) {
        set.phone = tel.value;
        campos.push("phone");
      }
    }
    if (dados.bio !== undefined) {
      const bio = textoOuNulo(dados.bio);
      if (bio !== (atual.bio ?? null)) {
        set.bio = bio;
        campos.push("bio");
      }
    }

    if (campos.length > 0) {
      await db.update(users).set(set).where(eq(users.id, actor.id));
      // A trilha guarda só QUAIS campos mudaram, nunca os valores.
      await recordAudit(
        { tenantId: actor.tenantId, userId: actor.id, userEmail: actor.email, action: "profile.updated", entityType: "user", entityId: actor.id, payload: { fields: campos } },
        request
      );
    }
    const novo = await carregarPerfil(actor.id);
    return montarResposta(novo!);
  });

  /** Enviar ou trocar a foto (base64, até 2 MB). A foto antiga é apagada do Supabase. */
  app.put("/api/me/photo", { bodyLimit: 4 * 1024 * 1024 }, async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    const atual = await carregarPerfil(actor.id);
    if (!atual) {
      reply.status(404);
      return { error: "Esta conta administrativa não tem cadastro de perfil para editar." };
    }

    const body = (request.body ?? {}) as { dataBase64?: unknown };
    const foto = validarFoto(body.dataBase64);
    if (!foto.ok) {
      reply.status(foto.status);
      return { error: foto.error };
    }

    const key = chaveDoAvatar(actor.tenantId, actor.id, foto.format.ext);
    let storage;
    try {
      storage = await getAvatarStorage();
      await storage.put(key, foto.bytes, foto.format.contentType);
    } catch (err) {
      request.log.error({ err }, "falha ao enviar foto ao armazenamento");
      reply.status(503);
      return { error: "O armazenamento de fotos não está disponível agora. Tente de novo em instantes; se persistir, avise o suporte." };
    }

    const agora = new Date();
    try {
      await db.update(users).set({ avatarKey: key, avatarUpdatedAt: agora }).where(eq(users.id, actor.id));
    } catch (err) {
      request.log.error({ err }, "falha ao salvar a chave da foto");
      await storage.remove(key).catch(() => undefined);
      reply.status(503);
      return { error: "Não foi possível salvar a foto agora. Tente de novo." };
    }

    if (chavePertenceAoUsuario(atual.avatarKey, actor.tenantId, actor.id)) {
      await storage.remove(atual.avatarKey!).catch((err) => request.log.warn({ err }, "foto antiga não removida"));
    }

    await recordAudit(
      { tenantId: actor.tenantId, userId: actor.id, userEmail: actor.email, action: "profile.photo_updated", entityType: "user", entityId: actor.id, payload: { format: foto.format.ext, bytes: foto.bytes.length } },
      request
    );
    return { avatarUrl: await urlDoAvatar(key), avatarUpdatedAt: agora };
  });

  /** Remover a foto. */
  app.delete("/api/me/photo", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    const atual = await carregarPerfil(actor.id);
    if (!atual) {
      reply.status(404);
      return { error: "Esta conta administrativa não tem cadastro de perfil para editar." };
    }
    if (!atual.avatarKey) return { avatarUrl: null };

    await db.update(users).set({ avatarKey: null, avatarUpdatedAt: new Date() }).where(eq(users.id, actor.id));
    if (chavePertenceAoUsuario(atual.avatarKey, actor.tenantId, actor.id)) {
      try {
        await (await getAvatarStorage()).remove(atual.avatarKey);
      } catch (err) {
        request.log.warn({ err }, "arquivo da foto não removido do armazenamento");
      }
    }
    await recordAudit(
      { tenantId: actor.tenantId, userId: actor.id, userEmail: actor.email, action: "profile.photo_removed", entityType: "user", entityId: actor.id },
      request
    );
    return { avatarUrl: null };
  });

  /** Pedir a eliminação da própria conta (LGPD art. 18). Quem decide e executa é a governança de dados, com auditoria. */
  app.post("/api/me/deletion-request", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    const email = actor.email.toLowerCase();
    const [aberto] = await db
      .select({ id: lgpdRequests.id, createdAt: lgpdRequests.createdAt })
      .from(lgpdRequests)
      .where(and(eq(lgpdRequests.requesterEmail, email), eq(lgpdRequests.kind, "deletion"), eq(lgpdRequests.status, "pending")))
      .limit(1);
    if (aberto) return { protocol: aberto.id, createdAt: aberto.createdAt, alreadyOpen: true };

    const [novo] = await db
      .insert(lgpdRequests)
      .values({ tenantId: actor.tenantId, requesterEmail: email, kind: "deletion", status: "pending" })
      .returning();
    await recordAudit(
      { tenantId: actor.tenantId, userId: actor.id, userEmail: actor.email, action: "lgpd.request_submitted", entityType: "lgpd_request", entityId: novo.id, payload: { kind: "deletion", origin: "meu_painel" } },
      request
    );
    return { protocol: novo.id, createdAt: novo.createdAt, alreadyOpen: false };
  });

  /** Métricas do próprio trabalho, conforme o perfil. */
  app.get("/api/me/metrics", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;
    return { metrics: await metricasDoUsuario(actor) };
  });
}
