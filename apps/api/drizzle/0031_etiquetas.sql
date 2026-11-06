-- 0031_etiquetas.sql
-- Catálogo de etiquetas do tenant, cadastrado só pelo Administrador Master. O RE escolhe; nunca digita etiqueta livre.
-- `grupo` separa as listas (ex.: 'dificuldades_persistentes'). Desativar em vez de apagar, para registros antigos continuarem legíveis.
-- Idempotente. Tabela nova.

CREATE TABLE IF NOT EXISTS public.etiquetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  grupo varchar(40) NOT NULL,
  rotulo varchar(80) NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT etiquetas_grupo_chk CHECK (grupo ~ '^[a-z][a-z0-9_]{1,39}$'),
  CONSTRAINT etiquetas_rotulo_chk CHECK (char_length(btrim(rotulo)) BETWEEN 2 AND 80)
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS etiquetas_tenant_grupo_rotulo_uq ON public.etiquetas (tenant_id, grupo, lower(btrim(rotulo)));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS etiquetas_tenant_grupo_idx ON public.etiquetas (tenant_id, grupo, ativo);
--> statement-breakpoint

ALTER TABLE public.etiquetas ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'etiquetas' AND policyname = 'etiquetas_tenant_isolation') THEN
    CREATE POLICY etiquetas_tenant_isolation ON public.etiquetas FOR ALL TO periscopio_app
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
  END IF;
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.etiquetas TO periscopio_app;
END $$;
