CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"escola" text NOT NULL,
	"cargo" varchar(60) NOT NULL,
	"rede" varchar(30) DEFAULT 'privada' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
