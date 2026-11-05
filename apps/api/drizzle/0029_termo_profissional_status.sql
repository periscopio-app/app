-- 0029_termo_profissional_status.sql
-- Estado verdadeiro/falso do Termo de Responsabilidade Clínica e LGPD por profissional.
-- A prova do aceite continua em consent_acceptances (hash, IP, navegador) e na trilha de auditoria.
-- Idempotente. Tabela nova: nenhuma consulta existente muda.

CREATE TABLE IF NOT EXISTS public.professional_term_status (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  accepted boolean NOT NULL DEFAULT false,
  accepted_at timestamptz,
  term_id uuid REFERENCES public.consent_terms(id),
  term_version varchar(20),
  acceptance_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- Quem já aceitou antes não precisa aceitar de novo.
INSERT INTO public.professional_term_status (user_id, tenant_id, accepted, accepted_at, term_id, term_version, acceptance_id)
SELECT DISTINCT ON (ca.user_id) ca.user_id, ca.tenant_id, true, ca.accepted_at, ca.term_id, t.version, ca.id
FROM public.consent_acceptances ca
JOIN public.consent_terms t ON t.id = ca.term_id
WHERE ca.user_id IS NOT NULL AND ca.status = 'accepted' AND t.type = 'termo_profissional_lgpd'
ORDER BY ca.user_id, ca.accepted_at DESC
ON CONFLICT (user_id) DO NOTHING;
--> statement-breakpoint

ALTER TABLE public.professional_term_status ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'professional_term_status' AND policyname = 'professional_term_status_tenant_isolation') THEN
    CREATE POLICY professional_term_status_tenant_isolation ON public.professional_term_status FOR ALL TO periscopio_app
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
  END IF;
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.professional_term_status TO periscopio_app;
END $$;
