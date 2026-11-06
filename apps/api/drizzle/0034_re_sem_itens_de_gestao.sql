-- 0034_re_sem_itens_de_gestao.sql
-- O RE deixa de ver Indicadores do piloto (grupo), BI do gestor e Mapa de prevalência. A Agenda do Board sai só do MENU do RE
-- (o RE continua podendo pedir ajuda ao Board dentro do caso). O padrão do catálogo (capabilities.ts) já não inclui `ppi`
-- nas 3 capacidades de gestão; aqui removemos as exceções que ainda LIBERAVAM essas capacidades ao RE, para o padrão voltar a valer. Não cria nenhuma regra de bloqueio:
-- o Administrador Master pode liberar de novo pela tela de privilégios.
-- Idempotente.

DELETE FROM public.privilege_role_grants
WHERE role IN ('ppi', 're', 'responsavel_escolar')
  AND allowed = true
  AND capability IN ('pilot.indicators.view', 'bi.view', 'population.view');
