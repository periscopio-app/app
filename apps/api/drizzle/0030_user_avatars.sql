-- 0030_user_avatars.sql
-- Foto de perfil do profissional passa a ficar no próprio Postgres (Neon), como os laudos (0028).
-- Antes: o arquivo ia para o bucket do Supabase e, se o armazenamento falhava, a foto sumia.
-- `key` é a chave opaca usada na URL pública da foto (sem nome, e-mail ou documento). Só foto de profissional, nunca de aluno.
-- users.avatar_key continua existindo (legado e cópia da chave) para não quebrar leituras antigas.
-- Idempotente. Tabela nova: nenhuma consulta existente muda.

CREATE TABLE IF NOT EXISTS public.user_avatars (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  key uuid NOT NULL DEFAULT gen_random_uuid(),
  content bytea NOT NULL,
  content_type varchar(30) NOT NULL,
  size_bytes integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_avatars_type_chk CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT user_avatars_size_chk CHECK (size_bytes > 0 AND size_bytes <= 2097152)
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS user_avatars_key_uq ON public.user_avatars (key);
--> statement-breakpoint

ALTER TABLE public.user_avatars ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_avatars' AND policyname = 'user_avatars_tenant_isolation') THEN
    CREATE POLICY user_avatars_tenant_isolation ON public.user_avatars FOR ALL TO periscopio_app
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
  END IF;
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_avatars TO periscopio_app;
END $$;
