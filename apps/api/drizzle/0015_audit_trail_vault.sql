-- Trilha de auditoria enriquecida (imutável) e cofre de identidade do aluno.
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "user_email" varchar(255);--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "user_agent" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "duration_ms" integer;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "payload" jsonb;--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "action" TYPE varchar(80);--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "tenant_id" DROP NOT NULL;--> statement-breakpoint
-- Imutabilidade: bloqueia UPDATE e DELETE na trilha de auditoria.
CREATE OR REPLACE FUNCTION audit_logs_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs é imutável (append-only)';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_logs_no_update ON "audit_logs";--> statement-breakpoint
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student_identity_vault" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "student_id" uuid NOT NULL UNIQUE REFERENCES "students"("id"),
  "encrypted_full_name" text NOT NULL,
  "encrypted_document" text,
  "encrypted_contact" text,
  "last_access_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
