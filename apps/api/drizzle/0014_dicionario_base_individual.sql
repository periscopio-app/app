CREATE TABLE IF NOT EXISTS "legacy_variable_dictionary" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "batch_id" uuid NOT NULL REFERENCES "legacy_import_batches"("id") ON DELETE CASCADE,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "position" integer NOT NULL,
  "sheet_column" varchar(10),
  "variable" varchar(160),
  "column_name" varchar(160),
  "description" text,
  "value" varchar(160),
  "label" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legacy_variable_dictionary_pos" ON "legacy_variable_dictionary" ("batch_id", "position");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legacy_variable_dictionary_var" ON "legacy_variable_dictionary" ("batch_id", "variable");
