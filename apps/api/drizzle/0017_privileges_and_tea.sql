-- 0017_privileges_and_tea.sql
-- (1) Privilégios configuráveis pelo Administrador Master (caixinhas por perfil e por pessoa)
-- (2) Triagem TEA: 5 instrumentos por caso (ATA, ASQ, M-CHAT, SRS-2, ABC), travados após o envio
-- Idempotente: também é aplicada no boot pelo schema-guard.

CREATE TABLE IF NOT EXISTS "privilege_role_grants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scope_tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000000' NOT NULL,
  "role" varchar(40) NOT NULL,
  "capability" varchar(80) NOT NULL,
  "allowed" boolean NOT NULL,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "privilege_role_grants_unique"
  ON "privilege_role_grants" ("scope_tenant_id", "role", "capability");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "privilege_user_grants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "capability" varchar(80) NOT NULL,
  "allowed" boolean NOT NULL,
  "reason" text,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "privilege_user_grants_unique"
  ON "privilege_user_grants" ("user_id", "capability");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "tea_screenings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "case_id" uuid NOT NULL REFERENCES "cases"("id"),
  "instrument" varchar(20) NOT NULL,
  "instrument_version" varchar(30) NOT NULL,
  "status" varchar(20) DEFAULT 'rascunho' NOT NULL,
  "respondent" varchar(30),
  "applied_on" date,
  "answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "scoring" jsonb,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "submitted_by" uuid REFERENCES "users"("id"),
  "submitted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tea_screenings_case_instrument_unique"
  ON "tea_screenings" ("case_id", "instrument");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tea_screenings_tenant_idx" ON "tea_screenings" ("tenant_id");--> statement-breakpoint

CREATE OR REPLACE FUNCTION tea_screening_lock_after_submit() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'enviado' THEN
    IF NEW.answers IS DISTINCT FROM OLD.answers
       OR NEW.instrument IS DISTINCT FROM OLD.instrument
       OR NEW.respondent IS DISTINCT FROM OLD.respondent
       OR NEW.applied_on IS DISTINCT FROM OLD.applied_on
       OR NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'triagem TEA já enviada: respostas não podem ser alteradas';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_tea_screenings_lock" ON "tea_screenings";--> statement-breakpoint
CREATE TRIGGER "trg_tea_screenings_lock" BEFORE UPDATE ON "tea_screenings"
  FOR EACH ROW EXECUTE FUNCTION tea_screening_lock_after_submit();--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'periscopio_app') THEN
    ALTER TABLE "tea_screenings" ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tea_screenings' AND policyname = 'tea_screenings_tenant_isolation') THEN
      CREATE POLICY "tea_screenings_tenant_isolation" ON "tea_screenings" FOR ALL TO periscopio_app
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
    END IF;
    GRANT SELECT, INSERT, UPDATE ON TABLE "tea_screenings" TO periscopio_app;
  END IF;
END $$;
