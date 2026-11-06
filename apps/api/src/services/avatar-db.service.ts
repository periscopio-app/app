import { and, eq } from "drizzle-orm";
import { userAvatars } from "@periscopio/shared";
import { db } from "../db/client";
import type { AvatarStorage } from "./avatar.service";

/**
 * Foto de perfil guardada no próprio Postgres (Neon), na tabela `user_avatars` (migração 0030).
 * Substitui o Supabase Storage: a foto passa a ter o mesmo ciclo de vida do usuário e não depende de bucket externo.
 *
 * A chave que continua em `users.avatar_key` mantém o formato `avatars/<tenant>/<usuário>/<uuid>.<ext>`;
 * o uuid do final é a chave pública opaca da foto (sem nome, e-mail ou documento).
 */
const CHAVE = /^avatars\/([0-9a-f-]{36})\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.(?:jpg|png|webp)$/i;

export function partesDaChave(key: string): { tenantId: string; userId: string; fotoKey: string } | null {
  const m = CHAVE.exec(key);
  return m ? { tenantId: m[1], userId: m[2], fotoKey: m[3].toLowerCase() } : null;
}

/** Endereço relativo, servido pela própria API (o site já repassa /api/* para ela). */
export function urlPublicaDaFoto(fotoKey: string): string {
  return `/api/avatars/${fotoKey}`;
}

export const avatarNoPostgres: AvatarStorage = {
  async put(key, body, contentType) {
    const p = partesDaChave(key);
    if (!p) throw new Error("chave de foto inválida");
    const agora = new Date();
    await db
      .insert(userAvatars)
      .values({ userId: p.userId, tenantId: p.tenantId, key: p.fotoKey, content: body, contentType, sizeBytes: body.length, updatedAt: agora })
      .onConflictDoUpdate({
        target: userAvatars.userId,
        set: { key: p.fotoKey, content: body, contentType, sizeBytes: body.length, updatedAt: agora },
      });
  },
  async remove(key) {
    const p = partesDaChave(key);
    if (!p) return;
    // Só apaga se ainda for esta a foto atual: remover a foto ANTIGA depois de trocar não pode apagar a nova.
    await db.delete(userAvatars).where(and(eq(userAvatars.userId, p.userId), eq(userAvatars.key, p.fotoKey)));
  },
  /** Só devolve endereço se a foto existe no Postgres: chaves antigas (do bucket do Supabase) viram "sem foto" em vez de imagem quebrada. */
  async publicUrl(key) {
    const p = partesDaChave(key);
    if (!p) return null;
    const [row] = await db.select({ k: userAvatars.key }).from(userAvatars).where(and(eq(userAvatars.userId, p.userId), eq(userAvatars.key, p.fotoKey))).limit(1);
    return row ? urlPublicaDaFoto(p.fotoKey) : null;
  },
};

/** Foto pela chave pública. Retorna null se não existir (a rota responde 404 sem dizer nada além disso). */
export async function lerFotoPelaChave(fotoKey: string) {
  const [row] = await db
    .select({ content: userAvatars.content, contentType: userAvatars.contentType, updatedAt: userAvatars.updatedAt })
    .from(userAvatars)
    .where(eq(userAvatars.key, fotoKey))
    .limit(1);
  return row ?? null;
}
