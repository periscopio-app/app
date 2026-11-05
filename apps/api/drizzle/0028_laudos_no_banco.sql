-- 0028_laudos_no_banco.sql
-- Laudos da família passam a ficar no próprio Postgres (coluna content), sem depender do bucket do Supabase.
-- Coluna anulável: laudos antigos (se houver) continuam lidos do bucket. A tabela já tem RLS e entra no reset de fábrica.
-- Idempotente e instantânea (adicionar coluna anulável não reescreve a tabela).

ALTER TABLE public.clinical_attachments ADD COLUMN IF NOT EXISTS content bytea;
