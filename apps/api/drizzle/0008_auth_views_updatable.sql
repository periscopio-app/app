-- Better Auth grava em public."user"/session/account/verification, que sao views
-- sobre neon_auth.*. As regras ON INSERT/UPDATE/DELETE ... DO INSTEAD dessas views
-- nao tem RETURNING, entao o INSERT ... RETURNING do Better Auth falha com
-- 'cannot perform INSERT RETURNING on relation "user"' (cadastro e login quebrados).
-- Sem as regras, views simples sobre uma unica tabela sao auto-atualizaveis e
-- aceitam INSERT/UPDATE/DELETE com RETURNING. Idempotente.
DROP RULE IF EXISTS user_insert ON public."user";--> statement-breakpoint
DROP RULE IF EXISTS user_update ON public."user";--> statement-breakpoint
DROP RULE IF EXISTS user_delete ON public."user";--> statement-breakpoint
DROP RULE IF EXISTS session_insert ON public.session;--> statement-breakpoint
DROP RULE IF EXISTS session_update ON public.session;--> statement-breakpoint
DROP RULE IF EXISTS session_delete ON public.session;--> statement-breakpoint
DROP RULE IF EXISTS account_insert ON public.account;--> statement-breakpoint
DROP RULE IF EXISTS account_update ON public.account;--> statement-breakpoint
DROP RULE IF EXISTS account_delete ON public.account;--> statement-breakpoint
DROP RULE IF EXISTS verification_insert ON public.verification;--> statement-breakpoint
DROP RULE IF EXISTS verification_update ON public.verification;--> statement-breakpoint
DROP RULE IF EXISTS verification_delete ON public.verification;
