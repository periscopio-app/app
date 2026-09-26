CREATE TABLE "case_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"school_id" uuid,
	"case_id" uuid NOT NULL,
	"specialty" varchar(50) NOT NULL,
	"assigned_professional_id" uuid,
	"status" varchar(30) DEFAULT 'pendente' NOT NULL,
	"summary" jsonb,
	"notes" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"token" varchar(120) NOT NULL,
	"type" varchar(30) NOT NULL,
	"role" varchar(40),
	"specialty" varchar(50),
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "slug" varchar(80);--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "cnpj" varchar(20);--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "responsavel_nome" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "responsavel_email" varchar(255);--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "responsavel_telefone" varchar(30);--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "status" varchar(30) DEFAULT 'pending_onboarding';--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "branding" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "school_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" varchar(30);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cpf" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "class_code" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "specialty" varchar(50);--> statement-breakpoint
ALTER TABLE "case_summaries" ADD CONSTRAINT "case_summaries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_summaries" ADD CONSTRAINT "case_summaries_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_summaries" ADD CONSTRAINT "case_summaries_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_summaries" ADD CONSTRAINT "case_summaries_assigned_professional_id_users_id_fk" FOREIGN KEY ("assigned_professional_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_invites" ADD CONSTRAINT "onboarding_invites_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_invites" ADD CONSTRAINT "onboarding_invites_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schools" ADD CONSTRAINT "schools_slug_unique" UNIQUE("slug");