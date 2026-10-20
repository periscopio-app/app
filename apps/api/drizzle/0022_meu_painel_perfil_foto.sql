-- 0022_meu_painel_perfil_foto.sql
-- Painel pessoal do profissional ("Meu painel"):
--  * avatar_key: chave opaca do objeto no bucket de avatares do Supabase (sem nome nem dado pessoal na chave);
--    a URL pública é montada pela API a partir dela. NULL = sem foto.
--  * avatar_updated_at: data da última troca (também serve para renovar o cache da imagem).
--  * bio: apresentação curta opcional, escrita pelo próprio usuário.
-- Idempotente: também é aplicada no boot pelo schema-guard.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_key" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" varchar(280);
