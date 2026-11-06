-- 0033_justification_metrics.sql
-- Volumetria das justificativas para o KPI interno do Admin Master. Guarda SÓ contagens agregadas por dia:
-- nunca o texto, nunca o aluno, nunca o autor. `est_tokens` é estimativa (ceil(caracteres / 4)), não tokenizador de modelo.
-- Idempotente. Tabela nova.

CREATE TABLE IF NOT EXISTS public.justification_metrics (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  day date NOT NULL,
  form varchar(40) NOT NULL,
  kind varchar(40) NOT NULL,
  n integer NOT NULL DEFAULT 0,
  chars integer NOT NULL DEFAULT 0,
  words integer NOT NULL DEFAULT 0,
  est_tokens integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, day, form, kind)
);
--> statement-breakpoint

ALTER TABLE public.justification_metrics ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'justification_metrics' AND policyname = 'justification_metrics_tenant_isolation') THEN
    CREATE POLICY justification_metrics_tenant_isolation ON public.justification_metrics FOR ALL TO periscopio_app
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
  END IF;
  GRANT SELECT, INSERT, UPDATE ON TABLE public.justification_metrics TO periscopio_app;
END $$;
