-- Reset de fábrica do piloto (23/out/2026): marca quais municípios são de demonstração/teste.
-- Só municípios com demo = true podem ser zerados pelo Admin; municípios reais (Tarumã) nunca.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS demo boolean NOT NULL DEFAULT false;
--> statement-breakpoint
-- O município de demonstração conhecido é marcado; qualquer outro é decisão explícita do Admin.
UPDATE tenants SET demo = true WHERE municipality_code = 'DEMO';
--> statement-breakpoint
-- Trava de dado: garante que Tarumã e a Plataforma Global nunca fiquem marcados como demo.
UPDATE tenants SET demo = false
WHERE id = '00000000-0000-0000-0000-000000000001' OR lower(name) LIKE '%tarum%';
