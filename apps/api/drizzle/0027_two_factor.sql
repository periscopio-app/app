-- 0027_two_factor.sql
-- Suporte a autenticação em dois fatores (2FA) via OTP por e-mail no Better Auth.
-- Atualiza neon_auth."user" com a coluna "twoFactorEnabled" e recria a view public."user".
-- Cria a tabela neon_auth."twoFactor" e as views públicas public."twoFactor" e public."two_factor".
-- Garante two_factor_enabled na tabela public.users do domínio.
-- Idempotente.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false;
--> statement-breakpoint

ALTER TABLE neon_auth."user" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" boolean DEFAULT false;
--> statement-breakpoint

CREATE OR REPLACE VIEW public."user" AS SELECT * FROM neon_auth."user";
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS neon_auth."twoFactor" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "secret" text NOT NULL,
  "backupCodes" text NOT NULL,
  "userId" uuid NOT NULL REFERENCES neon_auth."user"("id") ON DELETE CASCADE,
  "verified" boolean DEFAULT false NOT NULL,
  "failedVerificationCount" integer DEFAULT 0,
  "lockedUntil" timestamp with time zone
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "twoFactor_userId_idx" ON neon_auth."twoFactor" ("userId");
--> statement-breakpoint

CREATE OR REPLACE VIEW public."twoFactor" AS SELECT * FROM neon_auth."twoFactor";
--> statement-breakpoint

CREATE OR REPLACE VIEW public.two_factor AS SELECT
  "id",
  "userId" as user_id,
  secret,
  "backupCodes" as backup_codes,
  verified,
  "failedVerificationCount" as failed_verification_count,
  "lockedUntil" as locked_until
FROM neon_auth."twoFactor";
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'periscopio_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE neon_auth."twoFactor" TO periscopio_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."twoFactor" TO periscopio_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.two_factor TO periscopio_app;
  END IF;
END $$;

