-- RASCUNHO (Databricks SQL, Unity Catalog). Rodar no workspace só depois da fase 1.
-- A API lê SOMENTE periscopio.gold.* (ver apps/api/src/services/databricks.service.ts). Nomes e colunas precisam bater.

CREATE CATALOG IF NOT EXISTS periscopio;
CREATE SCHEMA IF NOT EXISTS periscopio.bronze;
CREATE SCHEMA IF NOT EXISTS periscopio.silver;
CREATE SCHEMA IF NOT EXISTS periscopio.gold;

-- bronze.* recebe a cópia diária das views bi.* do Postgres (job da Render). gold.* é o que o painel enxerga.
CREATE OR REPLACE VIEW periscopio.gold.casos_por_estado AS
  SELECT estado, CAST(total AS BIGINT) AS total FROM periscopio.bronze.casos_por_estado;
CREATE OR REPLACE VIEW periscopio.gold.casos_por_mes AS
  SELECT mes, CAST(total AS BIGINT) AS total FROM periscopio.bronze.casos_por_mes;
CREATE OR REPLACE VIEW periscopio.gold.casos_por_escola AS
  SELECT escola, CAST(total AS BIGINT) AS total FROM periscopio.bronze.casos_por_escola;
CREATE OR REPLACE VIEW periscopio.gold.delegacoes_por_especialidade AS
  SELECT especialidade, CAST(total AS BIGINT) AS total FROM periscopio.bronze.delegacoes_por_especialidade;

-- Conta de serviço da API: só leitura em gold (nome de exemplo; criar no workspace, segredo só em variável de ambiente).
-- GRANT USE CATALOG ON CATALOG periscopio TO `periscopio-api`;
-- GRANT USE SCHEMA, SELECT ON SCHEMA periscopio.gold TO `periscopio-api`;
