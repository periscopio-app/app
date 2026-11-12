-- 0036_gestao_so_admin_master.sql
-- Indicadores do piloto (grupo), BI do gestor e Mapa de prevalência passam a ser só do Administrador Master (decisão do PM, 07/nov/2026).
-- O padrão do catálogo (capabilities.ts) já lista só os perfis de administração; aqui removemos as exceções que ainda LIBERAVAM
-- essas capacidades a outros perfis, para o padrão voltar a valer. Não cria regra de bloqueio: o Administrador Master pode
-- liberar de novo pela tela de privilégios. Idempotente.

DELETE FROM public.privilege_role_grants
WHERE allowed = true
  AND role NOT IN ('admin_platform', 'adm_master')
  AND capability IN ('pilot.indicators.view', 'bi.view', 'population.view');
