-- 0016_row_level_security.sql
-- Fase 2 de Proteção de Dados: Row Level Security (RLS) e Isolamento Estrito Multi-tenant
-- Cria papel restrito 'periscopio_app', habilita RLS em todas as tabelas do sistema e define políticas por tenant.

-- 1. Criação do papel de banco restrito
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'periscopio_app') THEN
    CREATE ROLE periscopio_app NOLOGIN;
  END IF;
END $$;

-- 2. Criação das tabelas de consentimento e anexos se ainda não existirem
CREATE TABLE IF NOT EXISTS "consent_terms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "version" varchar(20) NOT NULL,
  "type" varchar(40) DEFAULT 'responsavel_legal' NOT NULL,
  "title" text NOT NULL,
  "summary" text NOT NULL,
  "content" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "published_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "consent_terms_tenant_ver_type_unique" 
  ON "consent_terms" ("tenant_id", "version", "type");

CREATE TABLE IF NOT EXISTS "consent_acceptances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "term_id" uuid NOT NULL REFERENCES "consent_terms"("id"),
  "student_id" uuid REFERENCES "students"("id"),
  "case_id" uuid REFERENCES "cases"("id"),
  "user_id" uuid REFERENCES "users"("id"),
  "signer_name" text NOT NULL,
  "signer_document" varchar(20),
  "signer_role" varchar(40) NOT NULL,
  "signer_email" varchar(255),
  "signer_phone" varchar(30),
  "ip_address" varchar(45),
  "user_agent" text,
  "evidence_sha256" varchar(64) NOT NULL,
  "status" varchar(20) DEFAULT 'accepted' NOT NULL,
  "revoked_at" timestamp with time zone,
  "revoked_reason" text,
  "accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "clinical_attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "case_id" uuid NOT NULL REFERENCES "cases"("id"),
  "student_id" uuid REFERENCES "students"("id"),
  "uploader_id" uuid NOT NULL REFERENCES "users"("id"),
  "storage_key" varchar(255) NOT NULL UNIQUE,
  "original_name" varchar(255) NOT NULL,
  "mime_type" varchar(120) NOT NULL,
  "file_size_bytes" integer NOT NULL,
  "sha256" varchar(64) NOT NULL,
  "category" varchar(50) DEFAULT 'relatorio_clinico' NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 3. Habilitação de RLS e Políticas para Tabelas Operacionais
DO $$
DECLARE
  tbl text;
  tenant_tables text[] := ARRAY[
    'schools', 'teams', 'users', 'user_school_assignments', 'students',
    'student_identity_vault', 'teacher_observations', 'psych_assessments',
    'cases', 'evaluations', 'board_supervision', 'enrollments', 'lgpd_requests',
    'onboarding_invites', 're_assessments', 'case_summaries', 'notifications',
    'expert_board_settings', 'expert_slots', 'expert_meeting_requests',
    'population_aggregates', 'legacy_import_batches', 'legacy_variable_dictionary',
    'legacy_import_rows', 'legacy_patients', 'legacy_patient_locations',
    'legacy_patient_complaints', 'legacy_patient_services', 'legacy_patient_items',
    'bi_questions', 'consent_terms', 'consent_acceptances', 'clinical_attachments'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    -- Ativa RLS se a tabela existir
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl AND table_schema = 'public') THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);

      -- Política de Isolamento Multi-tenant
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = tbl || '_tenant_isolation') THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I FOR ALL TO periscopio_app USING (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid);',
          tbl || '_tenant_isolation',
          tbl
        );
      END IF;

      -- Concessão de permissões operacionais
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO periscopio_app;', tbl);
    END IF;
  END LOOP;
END $$;

-- 4. Políticas Estritas para Trilha de Auditoria (Append-only: SELECT e INSERT apenas, NUNCA UPDATE ou DELETE)
DO $$
DECLARE
  audit_tbl text;
  audit_tables text[] := ARRAY['audit_logs', 'case_timeline', 'case_transitions'];
BEGIN
  FOREACH audit_tbl IN ARRAY audit_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = audit_tbl AND table_schema = 'public') THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', audit_tbl);

      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = audit_tbl AND policyname = audit_tbl || '_tenant_select') THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I FOR SELECT TO periscopio_app USING (tenant_id IS NULL OR tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid);',
          audit_tbl || '_tenant_select',
          audit_tbl
        );
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = audit_tbl AND policyname = audit_tbl || '_tenant_insert') THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I FOR INSERT TO periscopio_app WITH CHECK (tenant_id IS NULL OR tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid);',
          audit_tbl || '_tenant_insert',
          audit_tbl
        );
      END IF;

      -- Apenas SELECT e INSERT para periscopio_app
      EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO periscopio_app;', audit_tbl);
    END IF;
  END LOOP;
END $$;
