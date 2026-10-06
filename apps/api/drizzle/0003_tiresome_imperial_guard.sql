CREATE TABLE "student_identity_vault" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"encrypted_full_name" text NOT NULL,
	"encrypted_document" text,
	"encrypted_contact" text,
	"last_access_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "student_identity_vault_student_id_unique" UNIQUE("student_id")
);
--> statement-breakpoint
CREATE TABLE "user_school_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"role" varchar(40) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "event_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "correlation_id" varchar(120);--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "ip_address" varchar(45);--> statement-breakpoint
ALTER TABLE "case_timeline" ADD COLUMN "event_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "case_timeline" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "case_timeline" ADD COLUMN "previous_version_id" uuid;--> statement-breakpoint
ALTER TABLE "case_timeline" ADD COLUMN "correlation_id" varchar(120);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "age_bracket" varchar(20);--> statement-breakpoint
ALTER TABLE "student_identity_vault" ADD CONSTRAINT "student_identity_vault_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_identity_vault" ADD CONSTRAINT "student_identity_vault_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_school_assignments" ADD CONSTRAINT "user_school_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_school_assignments" ADD CONSTRAINT "user_school_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_school_assignments" ADD CONSTRAINT "user_school_assignments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;