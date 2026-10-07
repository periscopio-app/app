-- Agenda do Board de experts: horários, pedidos de reunião e sala fixa do Meet.
CREATE TABLE IF NOT EXISTS "expert_board_settings" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"meet_url" text,
	"notify_email" varchar(255),
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expert_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" varchar(20) DEFAULT 'available' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expert_meeting_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"school_id" uuid,
	"slot_id" uuid NOT NULL,
	"requester_id" uuid NOT NULL,
	"professional_name" text NOT NULL,
	"topic" text NOT NULL,
	"student_code" varchar(64),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"meet_url" text,
	"decision_note" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expert_board_settings" ADD CONSTRAINT "expert_board_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "expert_board_settings" ADD CONSTRAINT "expert_board_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "expert_slots" ADD CONSTRAINT "expert_slots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "expert_slots" ADD CONSTRAINT "expert_slots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "expert_meeting_requests" ADD CONSTRAINT "expert_meeting_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "expert_meeting_requests" ADD CONSTRAINT "expert_meeting_requests_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "expert_meeting_requests" ADD CONSTRAINT "expert_meeting_requests_slot_id_expert_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."expert_slots"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "expert_meeting_requests" ADD CONSTRAINT "expert_meeting_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "expert_meeting_requests" ADD CONSTRAINT "expert_meeting_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "expert_slots_tenant_start_unique" ON "expert_slots" USING btree ("tenant_id","starts_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "expert_meeting_requests_active_slot_unique" ON "expert_meeting_requests" USING btree ("slot_id") WHERE "expert_meeting_requests"."status" in ('pending','confirmed');
