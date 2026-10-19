-- 0021_re_fluxo_continuo_observabilidade.sql
-- 1) Série/ano escolar do aluno (dado operacional, não identifica a criança) + data da última edição.
-- 2) Tempo ativo de preenchimento por formulário (A a I) para medir mediana e ganho de tempo.
--    Guarda só segundos, formulário, caso e profissional. Nenhum conteúdo clínico.
-- 3) Tempo de referência (processo em papel) por formulário, editável pela gestão, para calcular o ganho.
-- 4) Uso de etapa opcional (SNAP-IV "Não vou aplicar"): trilha somente inserção, auditável.
-- Idempotente: também é aplicada no boot pelo schema-guard.

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "grade" varchar(40);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "re_step_timings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "school_id" uuid NOT NULL REFERENCES "schools"("id"),
  "case_id" uuid NOT NULL REFERENCES "cases"("id"),
  "step" varchar(10) NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "user_role" varchar(40) NOT NULL,
  "active_seconds" integer DEFAULT 0 NOT NULL,
  "sessions" integer DEFAULT 1 NOT NULL,
  "first_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "re_step_timings_step_chk" CHECK ("step" IN ('a','b','c','d','e','f','g','h','i')),
  CONSTRAINT "re_step_timings_seconds_chk" CHECK ("active_seconds" >= 0 AND "active_seconds" <= 86400)
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "re_step_timings_case_step_user_uq" ON "re_step_timings" ("case_id", "step", "user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_step_timings_tenant_idx" ON "re_step_timings" ("tenant_id", "school_id", "step");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "re_time_baselines" (
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "step" varchar(10) NOT NULL,
  "baseline_minutes" integer NOT NULL,
  "note" text,
  "updated_by" uuid REFERENCES "users"("id"),
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("tenant_id", "step"),
  CONSTRAINT "re_time_baselines_step_chk" CHECK ("step" IN ('a','b','c','d','e','f','g','h','i')),
  CONSTRAINT "re_time_baselines_minutes_chk" CHECK ("baseline_minutes" >= 0 AND "baseline_minutes" <= 600)
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "re_optional_step_usage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "school_id" uuid NOT NULL REFERENCES "schools"("id"),
  "case_id" uuid NOT NULL REFERENCES "cases"("id"),
  "step" varchar(10) NOT NULL,
  "action" varchar(20) NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "user_role" varchar(40) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "re_optional_step_usage_step_chk" CHECK ("step" IN ('g')),
  CONSTRAINT "re_optional_step_usage_action_chk" CHECK ("action" IN ('pulado', 'retomado'))
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_optional_step_usage_case_idx" ON "re_optional_step_usage" ("case_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_optional_step_usage_tenant_idx" ON "re_optional_step_usage" ("tenant_id", "school_id", "step", "action");--> statement-breakpoint

CREATE OR REPLACE FUNCTION re_optional_step_usage_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 're_optional_step_usage é somente inserção: registre uma nova linha (pulado ou retomado)';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS re_optional_step_usage_no_change ON "re_optional_step_usage";--> statement-breakpoint
CREATE TRIGGER re_optional_step_usage_no_change
  BEFORE UPDATE OR DELETE ON "re_optional_step_usage"
  FOR EACH ROW EXECUTE FUNCTION re_optional_step_usage_append_only();--> statement-breakpoint

ALTER TABLE "re_step_timings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "re_time_baselines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "re_optional_step_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'periscopio_app') THEN
    FOREACH t IN ARRAY ARRAY['re_step_timings', 're_time_baselines', 're_optional_step_usage'] LOOP
      EXECUTE format('GRANT SELECT, INSERT%s ON public.%I TO periscopio_app',
        CASE WHEN t = 're_optional_step_usage' THEN '' ELSE ', UPDATE' END, t);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
      EXECUTE format('CREATE POLICY tenant_isolation ON public.%I FOR ALL TO periscopio_app
        USING (tenant_id = public.app_current_tenant() OR public.app_cross_tenant())
        WITH CHECK (tenant_id = public.app_current_tenant() OR public.app_cross_tenant())', t);
    END LOOP;
  END IF;
END
$$;
