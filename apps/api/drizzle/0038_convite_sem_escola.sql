-- Link de cadastro unitário: o convite pode existir sem escola (profissional do núcleo, ligado só ao tenant)
-- e sem e-mail pré-definido (quem recebe o link informa o próprio). Só estrutura, idempotente: roda a cada boot.
ALTER TABLE "onboarding_invites" ALTER COLUMN "school_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "onboarding_invites" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "onboarding_invites" ADD COLUMN IF NOT EXISTS "label" varchar(120);
