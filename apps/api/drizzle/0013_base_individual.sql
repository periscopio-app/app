-- Base individual legada (planilha NEMT de Tarumã): paciente pseudonimizado (nome → UUID),
-- localização como coordenada (endereço nunca guardado), camada bruta sem perda e itens normalizados.
CREATE TABLE IF NOT EXISTS "legacy_import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
	"source" varchar(60) NOT NULL,
	"reference_year" integer NOT NULL,
	"file_sha256" varchar(64) NOT NULL,
	"mapping_sha256" varchar(64) NOT NULL,
	"row_count" integer NOT NULL,
	"columns" jsonb NOT NULL,
	"transformed_columns" jsonb NOT NULL,
	"column_non_null" jsonb NOT NULL,
	"geocoder" varchar(40),
	"legal_basis" text NOT NULL,
	"authorized_by" text NOT NULL,
	"authorization_ref" text,
	"status" varchar(20) DEFAULT 'applied' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legacy_import_batches_file_unique" ON "legacy_import_batches" ("tenant_id","source","file_sha256");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legacy_import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL REFERENCES "legacy_import_batches"("id") ON DELETE CASCADE,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
	"source_row" integer NOT NULL,
	"patient_id" uuid NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legacy_import_rows_batch_row" ON "legacy_import_rows" ("batch_id","source_row");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legacy_patients" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
	"batch_id" uuid NOT NULL REFERENCES "legacy_import_batches"("id") ON DELETE CASCADE,
	"school_id" uuid REFERENCES "schools"("id"),
	"school_code" varchar(30) NOT NULL,
	"source_row" integer NOT NULL,
	"record_number" varchar(60),
	"birth_date" date,
	"current_age" integer,
	"entry_year" integer,
	"guardian_ref" uuid,
	"guardian_relation" varchar(60),
	"religion" varchar(80),
	"parents_occupation" text,
	"economic_class" varchar(60),
	"extra" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legacy_patients_tenant_school" ON "legacy_patients" ("tenant_id","school_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legacy_patients_tenant_entry_year" ON "legacy_patients" ("tenant_id","entry_year");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legacy_patient_locations" (
	"patient_id" uuid PRIMARY KEY NOT NULL REFERENCES "legacy_patients"("id") ON DELETE CASCADE,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
	"status" varchar(20) NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"accuracy" varchar(30),
	"confidence" varchar(20),
	"address_key" varchar(64),
	"provider" varchar(40),
	"permanent" boolean,
	"geocoded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legacy_patient_complaints" (
	"patient_id" uuid NOT NULL REFERENCES "legacy_patients"("id") ON DELETE CASCADE,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
	"complaint" varchar(120) NOT NULL,
	PRIMARY KEY ("patient_id","complaint")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legacy_patient_services" (
	"patient_id" uuid NOT NULL REFERENCES "legacy_patients"("id") ON DELETE CASCADE,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
	"service" varchar(30) NOT NULL,
	"source_column" varchar(80) NOT NULL,
	"value_num" double precision,
	"value_text" text,
	PRIMARY KEY ("patient_id","source_column")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legacy_patient_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL REFERENCES "legacy_patients"("id") ON DELETE CASCADE,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
	"kind" varchar(20) NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legacy_patient_items_unique" ON "legacy_patient_items" ("patient_id","kind","position");
