-- 0035_ata_pode_ser_pulada.sql
-- A ATA (passo H) passa a ser opcional, com o mesmo "Não vou aplicar" do SNAP-IV (passo G).
-- A tabela só aceitava o passo 'g': ampliamos a regra para 'g' e 'h'. Registros antigos continuam válidos.
-- Idempotente.

ALTER TABLE public.re_optional_step_usage DROP CONSTRAINT IF EXISTS re_optional_step_usage_step_chk;
--> statement-breakpoint
ALTER TABLE public.re_optional_step_usage ADD CONSTRAINT re_optional_step_usage_step_chk CHECK (step IN ('g', 'h'));
