-- Link de cadastro coletivo: um link pode servir a vários profissionais (grupo de WhatsApp), com limite de usos.
-- Só estrutura, idempotente: roda a cada boot. Convites antigos ficam com max_uses = 1 (comportamento atual).
ALTER TABLE "onboarding_invites" ADD COLUMN IF NOT EXISTS "max_uses" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "onboarding_invites" ADD COLUMN IF NOT EXISTS "uses_count" integer DEFAULT 0 NOT NULL;
