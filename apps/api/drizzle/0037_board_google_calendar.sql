-- 0037_board_google_calendar.sql
-- Board de experts: conexão do Google Agenda/Meet por tenant e registro de como cada reunião ganhou sua sala.
-- Idempotente. O refresh token é guardado CIFRADO (AES-256-GCM, chave GOOGLE_TOKEN_ENC_KEY); nunca em texto puro.

CREATE TABLE IF NOT EXISTS "google_calendar_connections" (
  "tenant_id" uuid PRIMARY KEY NOT NULL,
  "connected_by" uuid,
  "refresh_token_enc" text NOT NULL,
  "scope" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "google_calendar_connections"
    ADD CONSTRAINT "google_calendar_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "google_calendar_connections"
    ADD CONSTRAINT "google_calendar_connections_connected_by_users_id_fk" FOREIGN KEY ("connected_by") REFERENCES "public"."users"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;--> statement-breakpoint
ALTER TABLE "google_calendar_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
BEGIN
  -- O papel da aplicação nasce na 0018; sem ele as políticas ficam para quando existir (mesmo padrão da 0019).
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'periscopio_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_calendar_connections TO periscopio_app';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON public.google_calendar_connections';
    EXECUTE 'CREATE POLICY tenant_isolation ON public.google_calendar_connections FOR ALL TO periscopio_app
      USING (tenant_id = public.app_current_tenant() OR public.app_cross_tenant())
      WITH CHECK (tenant_id = public.app_current_tenant() OR public.app_cross_tenant())';
  END IF;
END
$$;--> statement-breakpoint
ALTER TABLE "expert_meeting_requests" ADD COLUMN IF NOT EXISTS "meet_provider" varchar(20);--> statement-breakpoint
ALTER TABLE "expert_meeting_requests" ADD COLUMN IF NOT EXISTS "google_event_id" text;--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "expert_meeting_requests"
    ADD CONSTRAINT "expert_meeting_requests_meet_provider_check" CHECK ("meet_provider" IS NULL OR "meet_provider" IN ('google', 'fixed', 'jitsi'));
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;
