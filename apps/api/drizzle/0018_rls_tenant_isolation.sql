-- Row Level Security (RLS) em todas as tabelas do schema public.
--
-- O que esta migração faz (fase 1, sem mudar o comportamento da API atual):
--   1. Liga RLS em TODAS as tabelas de public (negação por padrão para qualquer papel
--      que não seja o dono/BYPASSRLS).
--   2. Cria o papel `periscopio_app` (NOLOGIN, sem BYPASSRLS) e as políticas por tenant
--      que valem para ele. A API de hoje conecta como `neondb_owner` (BYPASSRLS), por isso
--      nada muda para ela; o papel só passa a valer quando a API for trocada para ele (fase 2).
--   3. Tabelas de trilha (audit_logs, case_transitions, case_timeline) ficam somente
--      leitura + inserção para o papel da aplicação.
--
-- Contexto de sessão que as políticas leem (definido pela API em cada transação):
--   app.tenant_id    uuid do tenant do ator autenticado
--   app.cross_tenant 'on' para ator admin_platform ou fluxo de sistema auditado (login, convite, lead)
--
-- Fora do escopo de propósito: schema neon_auth (gerenciado pelo Neon Auth; o papel do
-- serviço não tem BYPASSRLS e travaria) e as views public.user/session/account/verification.
-- Idempotente.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'periscopio_app') THEN
    CREATE ROLE periscopio_app NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;
--> statement-breakpoint
-- 0) Substitui o desenho da 0016 (GUC app.current_tenant_id, lista fixa de tabelas, sem contexto cross-tenant).
--    Políticas permissivas se somam (OR); manter as da 0016 deixaria dois desenhos valendo ao mesmo tempo.
--    Nenhum código da API define esses parâmetros ainda, então nada muda para a aplicação.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN (tablename || '_tenant_isolation', tablename || '_tenant_select', tablename || '_tenant_insert')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.app_current_tenant() RETURNS uuid
  LANGUAGE sql STABLE SET search_path = pg_catalog
  AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.app_cross_tenant() RETURNS boolean
  LANGUAGE sql STABLE SET search_path = pg_catalog
  AS $$ SELECT COALESCE(current_setting('app.cross_tenant', true), '') = 'on' $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO periscopio_app;
--> statement-breakpoint
-- 1) Liga RLS em todas as tabelas e dá ao papel da aplicação apenas o DML necessário.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO periscopio_app', t);
  END LOOP;
END
$$;
--> statement-breakpoint
-- 2) Tabelas com tenant_id: isolamento por tenant (leitura e escrita).
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      AND EXISTS (
        SELECT 1 FROM information_schema.columns k
        WHERE k.table_schema = 'public' AND k.table_name = c.relname AND k.column_name = 'tenant_id'
      )
      AND c.relname NOT IN ('audit_logs', 'case_transitions', 'case_timeline')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I FOR ALL TO periscopio_app
         USING (tenant_id = public.app_current_tenant() OR public.app_cross_tenant())
         WITH CHECK (tenant_id = public.app_current_tenant() OR public.app_cross_tenant())', t);
  END LOOP;
END
$$;
--> statement-breakpoint
-- 3) Trilhas append-only: o papel da aplicação lê e insere, nunca altera nem apaga.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['audit_logs', 'case_transitions', 'case_timeline']
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON public.%I FROM periscopio_app', t);
      EXECUTE format('DROP POLICY IF EXISTS tenant_read ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS tenant_insert ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY tenant_read ON public.%I FOR SELECT TO periscopio_app
           USING (tenant_id = public.app_current_tenant() OR public.app_cross_tenant())', t);
      EXECUTE format(
        'CREATE POLICY tenant_insert ON public.%I FOR INSERT TO periscopio_app
           WITH CHECK (tenant_id = public.app_current_tenant() OR public.app_cross_tenant())', t);
    END IF;
  END LOOP;
END
$$;
--> statement-breakpoint
-- 4) Tabelas sem tenant_id.
-- tenants: cada tenant enxerga só a si mesmo; escrita só em contexto cross-tenant.
DROP POLICY IF EXISTS tenants_read ON public.tenants;
--> statement-breakpoint
DROP POLICY IF EXISTS tenants_write ON public.tenants;
--> statement-breakpoint
CREATE POLICY tenants_read ON public.tenants FOR SELECT TO periscopio_app
  USING (id = public.app_current_tenant() OR public.app_cross_tenant());
--> statement-breakpoint
CREATE POLICY tenants_write ON public.tenants FOR ALL TO periscopio_app
  USING (public.app_cross_tenant()) WITH CHECK (public.app_cross_tenant());
--> statement-breakpoint
-- courses/lessons: catálogo do LMS, comum a todos; leitura livre, escrita só cross-tenant.
DROP POLICY IF EXISTS catalog_read ON public.courses;
--> statement-breakpoint
DROP POLICY IF EXISTS catalog_write ON public.courses;
--> statement-breakpoint
CREATE POLICY catalog_read ON public.courses FOR SELECT TO periscopio_app USING (true);
--> statement-breakpoint
CREATE POLICY catalog_write ON public.courses FOR ALL TO periscopio_app
  USING (public.app_cross_tenant()) WITH CHECK (public.app_cross_tenant());
--> statement-breakpoint
DROP POLICY IF EXISTS catalog_read ON public.lessons;
--> statement-breakpoint
DROP POLICY IF EXISTS catalog_write ON public.lessons;
--> statement-breakpoint
CREATE POLICY catalog_read ON public.lessons FOR SELECT TO periscopio_app USING (true);
--> statement-breakpoint
CREATE POLICY catalog_write ON public.lessons FOR ALL TO periscopio_app
  USING (public.app_cross_tenant()) WITH CHECK (public.app_cross_tenant());
--> statement-breakpoint
-- leads: o formulário público do site só insere; leitura e gestão só em contexto cross-tenant.
DROP POLICY IF EXISTS leads_insert ON public.leads;
--> statement-breakpoint
DROP POLICY IF EXISTS leads_admin ON public.leads;
--> statement-breakpoint
CREATE POLICY leads_insert ON public.leads FOR INSERT TO periscopio_app WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY leads_admin ON public.leads FOR ALL TO periscopio_app
  USING (public.app_cross_tenant()) WITH CHECK (public.app_cross_tenant());
--> statement-breakpoint
-- 5) Tabelas de privilégios (migração 0017), sem coluna tenant_id.
-- privilege_role_grants: regra do tenant (scope_tenant_id) ou regra global (UUID zero, só leitura para o tenant).
DROP POLICY IF EXISTS privilege_role_read ON public.privilege_role_grants;
--> statement-breakpoint
DROP POLICY IF EXISTS privilege_role_write ON public.privilege_role_grants;
--> statement-breakpoint
CREATE POLICY privilege_role_read ON public.privilege_role_grants FOR SELECT TO periscopio_app
  USING (scope_tenant_id = public.app_current_tenant()
         OR scope_tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
         OR public.app_cross_tenant());
--> statement-breakpoint
CREATE POLICY privilege_role_write ON public.privilege_role_grants FOR ALL TO periscopio_app
  USING (scope_tenant_id = public.app_current_tenant() OR public.app_cross_tenant())
  WITH CHECK (scope_tenant_id = public.app_current_tenant() OR public.app_cross_tenant());
--> statement-breakpoint
-- privilege_user_grants: exceção por pessoa; vale o tenant do usuário-alvo.
DROP POLICY IF EXISTS privilege_user_isolation ON public.privilege_user_grants;
--> statement-breakpoint
CREATE POLICY privilege_user_isolation ON public.privilege_user_grants FOR ALL TO periscopio_app
  USING (public.app_cross_tenant()
         OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_id AND u.tenant_id = public.app_current_tenant()))
  WITH CHECK (public.app_cross_tenant()
         OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_id AND u.tenant_id = public.app_current_tenant()));
