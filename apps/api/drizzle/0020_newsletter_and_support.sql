CREATE TABLE IF NOT EXISTS "newsletter_subscribers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(255) NOT NULL UNIQUE,
  "name" text,
  "role" varchar(50) DEFAULT 'outro' NOT NULL,
  "status" varchar(20) DEFAULT 'ativo' NOT NULL,
  "tenant_id" uuid REFERENCES "tenants"("id"),
  "subscribed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "unsubscribed_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "newsletter_issues" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "summary" text,
  "content" text NOT NULL,
  "category" varchar(50) DEFAULT 'geral' NOT NULL,
  "status" varchar(20) DEFAULT 'publicado' NOT NULL,
  "sent_count" integer DEFAULT 0 NOT NULL,
  "author_id" uuid REFERENCES "users"("id"),
  "published_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "support_tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid,
  "user_id" uuid,
  "user_name" text,
  "user_email" varchar(255) NOT NULL,
  "user_role" varchar(50),
  "category" varchar(40) DEFAULT 'duvida' NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "page_url" text,
  "browser_info" text,
  "error_details" text,
  "status" varchar(20) DEFAULT 'aberto' NOT NULL,
  "priority" varchar(20) DEFAULT 'normal' NOT NULL,
  "resolution_notes" text,
  "resolved_at" timestamp with time zone,
  "resolved_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "newsletter_subscribers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "newsletter_issues" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_tickets" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'periscopio_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "newsletter_subscribers", "newsletter_issues", "support_tickets" TO periscopio_app;
  END IF;
END $$;

