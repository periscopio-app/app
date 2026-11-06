-- RASCUNHO. NÃO APLICAR sem confirmação (fase 2 do Plano de Dados). Fora da cadeia de migrações do Drizzle de propósito.
-- Views agregadas lidas por um usuário SOMENTE LEITURA que enxerga só estas views. Sem aluno, sem nome, sem dado clínico por pessoa.
-- Conferir os nomes de colunas/tabelas contra packages/shared/src/schema.ts antes de aplicar (há suspeita de drift nas migrações).
-- Dados de produção só entram depois do parecer do encarregado (DPO) e do contrato com o operador. Até lá: base sintética.

CREATE SCHEMA IF NOT EXISTS bi;

-- Exemplos (ajustar às colunas reais de `cases`, `schools`, `case_summaries`):
-- CREATE VIEW bi.casos_por_estado AS
--   SELECT journey_state AS estado, count(*)::int AS total FROM cases GROUP BY journey_state;
-- CREATE VIEW bi.casos_por_mes AS
--   SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS mes, count(*)::int AS total FROM cases GROUP BY 1;
-- CREATE VIEW bi.casos_por_escola AS
--   SELECT s.external_code AS escola, count(*)::int AS total FROM cases c JOIN schools s ON s.id = c.school_id GROUP BY s.external_code;
-- CREATE VIEW bi.delegacoes_por_especialidade AS
--   SELECT specialty AS especialidade, count(*)::int AS total FROM case_summaries GROUP BY specialty;

-- Usuário de leitura (senha vem de variável, nunca neste arquivo):
-- CREATE ROLE bi_reader LOGIN PASSWORD :'BI_READER_PASSWORD';
-- GRANT USAGE ON SCHEMA bi TO bi_reader;
-- GRANT SELECT ON ALL TABLES IN SCHEMA bi TO bi_reader;
