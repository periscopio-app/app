-- 0019_pilot_symptom_measurements.sql
-- Medidas de sintomas por caso para o indicador 5 do piloto (comparação entre a avaliação inicial
-- e a reavaliação do fim do ano letivo, feitas pelo núcleo e pela escola).
-- Guarda só a contagem calculável pela fonte (SNAP-IV, itens 1 a 9 marcados "Bastante" ou "Demais").
-- Não guarda classificação, não guarda rótulo clínico. Só inserção: correção = nova linha, vale a mais recente.
-- Idempotente: também é aplicada no boot pelo schema-guard.

CREATE TABLE IF NOT EXISTS "symptom_measurements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "school_id" uuid NOT NULL REFERENCES "schools"("id"),
  "case_id" uuid NOT NULL REFERENCES "cases"("id"),
  "phase" varchar(15) NOT NULL,
  "source" varchar(10) NOT NULL,
  "measure" varchar(30) DEFAULT 'snap4_itens_1a9' NOT NULL,
  "measure_version" varchar(30) NOT NULL,
  "applied_on" date NOT NULL,
  "answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "marked_count" integer NOT NULL,
  "items_total" integer NOT NULL,
  "recorded_by" uuid NOT NULL REFERENCES "users"("id"),
  "recorded_role" varchar(40) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "symptom_measurements_phase_chk" CHECK ("phase" IN ('inicial', 'reavaliacao')),
  CONSTRAINT "symptom_measurements_source_chk" CHECK ("source" IN ('escola', 'nucleo')),
  CONSTRAINT "symptom_measurements_count_chk" CHECK ("marked_count" >= 0 AND "marked_count" <= "items_total")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "symptom_measurements_case_idx" ON "symptom_measurements" ("case_id", "phase", "source", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "symptom_measurements_tenant_idx" ON "symptom_measurements" ("tenant_id", "school_id");--> statement-breakpoint

CREATE OR REPLACE FUNCTION symptom_measurements_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'symptom_measurements é somente inserção: registre uma nova medida para corrigir';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS symptom_measurements_no_change ON "symptom_measurements";--> statement-breakpoint
CREATE TRIGGER symptom_measurements_no_change
  BEFORE UPDATE OR DELETE ON "symptom_measurements"
  FOR EACH ROW EXECUTE FUNCTION symptom_measurements_append_only();--> statement-breakpoint

ALTER TABLE "symptom_measurements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
BEGIN
  -- O papel da aplicação nasce na 0018; sem ele (banco ainda sem a 0018) as políticas ficam para quando existir.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'periscopio_app') THEN
    EXECUTE 'GRANT SELECT, INSERT ON public.symptom_measurements TO periscopio_app';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON public.symptom_measurements';
    EXECUTE 'CREATE POLICY tenant_isolation ON public.symptom_measurements FOR ALL TO periscopio_app
      USING (tenant_id = public.app_current_tenant() OR public.app_cross_tenant())
      WITH CHECK (tenant_id = public.app_current_tenant() OR public.app_cross_tenant())';
  END IF;
END
$$;
