# Databricks (painel de dados)

Camada analítica **agregada e sintética**. O Postgres (Neon) continua sendo a fonte da verdade. Plano completo: página "Plano de Dados Periscópio".

## Estado
- **Pronto no código (desligado por padrão):** `apps/api/src/services/databricks.service.ts`, rotas `GET /api/admin/data-panel` e `/api/admin/data-panel/:id` (só Admin Master) e a página `/admin/painel-de-dados`.
- **Rascunho, não aplicado:** `sql/01_postgres_bi_views.sql` e `sql/02_databricks_gold.sql`.
- **Não existe ainda:** workspace configurado, carga diária, dados no Databricks.

## Variáveis (servidor da API: Render, serviço periscopio-api, e `.env` local)
| Nome | O que é |
|---|---|
| `DATABRICKS_HOST` | Endereço completo do workspace, começando com `https://` |
| `DATABRICKS_WAREHOUSE_ID` | ID do SQL Warehouse |
| `DATABRICKS_TOKEN` | Credencial da conta de serviço (só leitura em `gold`) |
| `DATABRICKS_CATALOG` | Opcional, padrão `periscopio` |
| `DATABRICKS_MIN_CELL` | Opcional, padrão `5`: células com total menor aparecem como "suprimidas". Valor a validar com o encarregado (DPO) |

Nunca coloque valores reais neste arquivo, no git, em chat ou em teste.

## Regras
- Só agregado e sintético; sem aluno, nome, relato ou pontuação individual.
- Consultas em lista fechada no servidor; o navegador não manda SQL.
- Sem as variáveis, o painel responde "desligado" e diz só o nome do que falta.
