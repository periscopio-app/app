# Migração da base individual de Tarumã (runbook do DBA)

**Regra única de anonimização:** nome do aluno → UUID (HMAC-SHA256, determinístico); endereço → latitude/longitude (Mapbox). Todo o resto da planilha entra no banco, coluna a coluna, por contrato.

## Onde fica cada dado
| Camada | Tabela | Conteúdo |
|---|---|---|
| Lote | `legacy_import_batches` | hash do arquivo e do mapeamento, nº de linhas, colunas, contagem de células preenchidas por coluna, **base legal e quem autorizou** |
| Bruta | `legacy_import_rows` | TODAS as colunas de cada linha (jsonb), exceto nome e endereço |
| Paciente | `legacy_patients` | UUID, escola, prontuário, nascimento, idade, ano de entrada, responsável (UUID), religião, trabalho dos pais, classe econômica |
| Local | `legacy_patient_locations` | lat/long, precisão, status (`ok`, `out_of_area`, `no_address`, `not_found`); o texto do endereço nunca é gravado |
| Queixas / serviços / itens | `legacy_patient_complaints`, `legacy_patient_services`, `legacy_patient_items` | hipóteses, fármacos, antecedentes familiares |

Nenhuma rota da API lê essas tabelas (há teste que garante).

## Passo a passo
1. Máquina autorizada, pasta protegida. Variáveis: `PSEUDONYM_SECRET` (≥32 caracteres, **guardar fora do banco; perdido = UUIDs não reproduzíveis**) e `MAPBOX_TOKEN`.
2. `python3 -I apps/api/scripts/taruma/individual_extract.py suggest <planilha.xlsx> --sheet Dados > mapping.json` e revisar o `mapping.json` (campos `_todo` e `_unmappedColumns`).
3. `python3 -I apps/api/scripts/taruma/individual_extract.py extract <planilha.xlsx> --mapping mapping.json --out individual.ndjson --geocode mapbox   # --no-permanent se a conta Mapbox não for permanente`
4. Simulação: `DATABASE_URL=... pnpm --filter @periscopio/api exec tsx scripts/taruma/load-individual.ts --file individual.ndjson --tenant a6232550-b4f2-4a2f-9fbc-6f8eeb482d0b`
5. Aplicar (uma transação): mesmo comando com `--apply --legal-basis "..." --authorized-by "..." [--authorization-ref "..."]`
6. Conferir a qualquer momento: `... load-individual.ts --verify <batchId>` (linhas, células preenchidas por coluna e agregados vs `population_aggregates`).
7. Apagar o `individual.ndjson` e o cache do geocoder.

Antes do passo 5 aplicar a migração `0013_base_individual.sql` no Neon (não aplicada até aqui).
