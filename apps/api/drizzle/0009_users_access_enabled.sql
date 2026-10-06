-- Acesso do profissional só é liberado após confirmar o e-mail do convite da escola.
-- Usuários que já existem continuam com acesso (backfill = true).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "access_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "users" SET "access_enabled" = true;
