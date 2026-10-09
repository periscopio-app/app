-- Localização/matrícula das escolas (mapa) e agregados populacionais por escola (sem dado individual).
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "external_code" varchar(30);
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "address" text;
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "latitude" double precision;
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "longitude" double precision;
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "enrollment" integer;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "population_aggregates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source" varchar(60) NOT NULL,
	"reference_year" integer NOT NULL,
	"school_code" varchar(30) NOT NULL,
	"school_label" varchar(120),
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "population_aggregates_unique" ON "population_aggregates" ("tenant_id","source","school_code");
