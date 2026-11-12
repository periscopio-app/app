-- 0036_foto_ate_3mb.sql
-- A foto de perfil do profissional passa de 2 MB para 3 MB (decisão do PM em 11/11/2026).
-- Só troca o limite da restrição de `user_avatars.size_bytes`. Idempotente.
-- Nenhuma linha existente viola a regra nova (o limite só aumenta).

ALTER TABLE public.user_avatars DROP CONSTRAINT IF EXISTS user_avatars_size_chk;
--> statement-breakpoint

ALTER TABLE public.user_avatars
  ADD CONSTRAINT user_avatars_size_chk CHECK (size_bytes > 0 AND size_bytes <= 3145728);
