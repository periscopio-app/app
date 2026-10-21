-- 0023_formularios_do_medico.sql
-- Formulários do médico (anamnese, exame, genograma, hipótese e conduta, encaminhamentos, seguimento, sumário).
-- Estrutura provisória md-0.1: um campo de texto livre curto por seção, até a validação clínica das perguntas.
-- `history` guarda a versão anterior quando o médico reabre uma seção concluída (nunca sobrescreve sem rastro).
-- Idempotente: também é aplicada no boot pelo schema-guard.

CREATE TABLE IF NOT EXISTS "case_medical_forms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "case_id" uuid NOT NULL REFERENCES "cases"("id"),
  "form_id" varchar(40) NOT NULL,
  "form_version" varchar(30) NOT NULL,
  "status" varchar(20) DEFAULT 'rascunho' NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "history" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "author_id" uuid NOT NULL REFERENCES "users"("id"),
  "completed_by" uuid REFERENCES "users"("id"),
  "completed_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "case_medical_forms_status_chk" CHECK ("status" IN ('rascunho', 'concluido'))
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "case_medical_forms_case_form_uq" ON "case_medical_forms" ("case_id", "form_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "case_medical_forms_tenant_idx" ON "case_medical_forms" ("tenant_id", "case_id");--> statement-breakpoint

ALTER TABLE "case_medical_forms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'periscopio_app') THEN
    GRANT SELECT, INSERT, UPDATE ON public."case_medical_forms" TO periscopio_app;
    DROP POLICY IF EXISTS tenant_isolation ON public."case_medical_forms";
    CREATE POLICY tenant_isolation ON public."case_medical_forms" FOR ALL TO periscopio_app
      USING (tenant_id = public.app_current_tenant() OR public.app_cross_tenant())
      WITH CHECK (tenant_id = public.app_current_tenant() OR public.app_cross_tenant());
  END IF;
END
$$;
