-- Perguntas ao BI (NL → plano de consulta) e feedback que alimenta o assistente.
CREATE TABLE IF NOT EXISTS "bi_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
	"user_id" uuid REFERENCES "users"("id"),
	"role" varchar(40) NOT NULL,
	"question" text NOT NULL,
	"plan" jsonb,
	"source" varchar(20) NOT NULL,
	"confidence" real,
	"rating" smallint,
	"corrected_plan" jsonb,
	"approved" boolean DEFAULT false NOT NULL,
	"approved_by" uuid REFERENCES "users"("id"),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bi_questions_tenant_approved" ON "bi_questions" ("tenant_id","approved");
