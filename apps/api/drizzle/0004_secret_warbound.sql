CREATE TABLE "case_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"from_state" varchar(30),
	"to_state" varchar(30) NOT NULL,
	"actor_id" uuid,
	"actor_role" varchar(40) NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "re_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"form_code" varchar(60) NOT NULL,
	"form_version" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'rascunho' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"submitted_at" timestamp,
	"submitted_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "journey_state" varchar(30) DEFAULT 'rascunho' NOT NULL;--> statement-breakpoint
ALTER TABLE "case_transitions" ADD CONSTRAINT "case_transitions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_transitions" ADD CONSTRAINT "case_transitions_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_transitions" ADD CONSTRAINT "case_transitions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "re_assessments" ADD CONSTRAINT "re_assessments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "re_assessments" ADD CONSTRAINT "re_assessments_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "re_assessments" ADD CONSTRAINT "re_assessments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "re_assessments" ADD CONSTRAINT "re_assessments_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Partial unique index: um rascunho aberto por (case_id, form_code)
CREATE UNIQUE INDEX "re_assessments_one_draft_per_case_form"
  ON "re_assessments" ("case_id", "form_code")
  WHERE status = 'rascunho';--> statement-breakpoint

-- Índices de performance
CREATE INDEX "idx_cases_tenant_journey" ON "cases" ("tenant_id", "journey_state");--> statement-breakpoint
CREATE INDEX "idx_case_transitions_case_ts" ON "case_transitions" ("case_id", "created_at");--> statement-breakpoint
CREATE INDEX "idx_re_assessments_tenant_case" ON "re_assessments" ("tenant_id", "case_id");--> statement-breakpoint
CREATE INDEX "idx_case_timeline_case_ts" ON "case_timeline" ("case_id", "created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_tenant_ts" ON "audit_logs" ("tenant_id", "created_at");--> statement-breakpoint

-- Imutabilidade: case_timeline
CREATE OR REPLACE FUNCTION immutable_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'tabela % é append-only: UPDATE e DELETE não são permitidos', TG_TABLE_NAME;
END;
$$;--> statement-breakpoint

CREATE TRIGGER "trg_case_timeline_immutable"
  BEFORE UPDATE OR DELETE ON "case_timeline"
  FOR EACH ROW EXECUTE FUNCTION immutable_append_only();--> statement-breakpoint

CREATE TRIGGER "trg_case_transitions_immutable"
  BEFORE UPDATE OR DELETE ON "case_transitions"
  FOR EACH ROW EXECUTE FUNCTION immutable_append_only();--> statement-breakpoint

CREATE TRIGGER "trg_audit_logs_immutable"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION immutable_append_only();--> statement-breakpoint

-- Imutabilidade: re_assessments após envio
-- Permite apenas a transição formal enviado → devolvido (feita pelo médico)
CREATE OR REPLACE FUNCTION re_assessment_lock_after_submit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'enviado' AND NEW.status <> 'devolvido' THEN
    RAISE EXCEPTION 'avaliação enviada é imutável; somente devolução formal pelo médico é permitida';
  END IF;
  IF OLD.status = 'enviado' AND NEW.status = 'devolvido' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'enviado' THEN
    RAISE EXCEPTION 'avaliação enviada é imutável';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER "trg_re_assessments_lock"
  BEFORE UPDATE ON "re_assessments"
  FOR EACH ROW EXECUTE FUNCTION re_assessment_lock_after_submit();