-- 0027_two_factor.sql
-- Suporte a autenticação em dois fatores (2FA) via OTP por e-mail.
-- Adiciona a tabela two_factor (Better Auth) e a coluna two_factor_enabled em users.
-- Idempotente.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean DEFAULT false;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "two_factor" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "secret" text NOT NULL,
  "backup_codes" text NOT NULL,
  "verified" boolean DEFAULT false NOT NULL,
  "failed_verification_count" integer DEFAULT 0,
  "locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "two_factor_user_id_unique" ON "two_factor" ("user_id");
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'periscopio_app') THEN
    ALTER TABLE "two_factor" ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'two_factor' AND policyname = 'two_factor_owner') THEN
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "two_factor" TO periscopio_app;
      -- O próprio usuário só lê/escreve o próprio registro; admin_platform usa app_cross_tenant().
      CREATE POLICY "two_factor_owner" ON "two_factor" FOR ALL TO periscopio_app
        USING (user_id IN (SELECT id FROM users WHERE tenant_id = public.app_current_tenant()) OR public.app_cross_tenant())
        WITH CHECK (user_id IN (SELECT id FROM users WHERE tenant_id = public.app_current_tenant()) OR public.app_cross_tenant());
    END IF;
  END IF;
END $$;
