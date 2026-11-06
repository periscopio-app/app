-- 0032_case_returns.sql
-- Devolução formal do médico ao RE: um registro por devolução, com UUID próprio (`return_id`) para auditoria.
-- Somente inserção (o banco bloqueia UPDATE e DELETE), como audit_logs e re_optional_step_usage.
-- A justificativa tem 100 a 150 caracteres (regra do produto); o texto é validado também na API.
-- Idempotente. Tabela nova.

CREATE TABLE IF NOT EXISTS public.case_returns (
  return_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  returned_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  returned_by_role varchar(40) NOT NULL,
  reason text NOT NULL,
  idempotency_key varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_returns_reason_chk CHECK (char_length(btrim(reason)) BETWEEN 100 AND 150)
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS case_returns_case_idx ON public.case_returns (tenant_id, case_id, created_at);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS case_returns_idem_uq ON public.case_returns (tenant_id, case_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION case_returns_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'case_returns é somente inserção: registre uma nova devolução';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS case_returns_no_change ON public.case_returns;
--> statement-breakpoint
CREATE TRIGGER case_returns_no_change
  BEFORE UPDATE OR DELETE ON public.case_returns
  FOR EACH ROW EXECUTE FUNCTION case_returns_append_only();
--> statement-breakpoint

ALTER TABLE public.case_returns ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'case_returns' AND policyname = 'case_returns_tenant_isolation') THEN
    CREATE POLICY case_returns_tenant_isolation ON public.case_returns FOR ALL TO periscopio_app
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
  END IF;
  GRANT SELECT, INSERT ON TABLE public.case_returns TO periscopio_app;
END $$;
