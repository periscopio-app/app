# Relatório de erro: schema-guard apagava permissões do Administrador Master a cada boot (REG-023)

**Data:** 12/nov/2026 · **Gravidade:** média (sem perda em produção; `main` ficou vermelha) · **Status:** corrigido em PR

## Sintoma

Depois do merge do PR #149, a CI da `main` (`dcc74d6`) e a de todo PR novo falharam em `bi.e2e.test.ts`: o BI respondia **403** onde se esperava 200 (testes 2, 3, 5, 6, 7 e outros).

## Causa

O PR #149 pôs `0036_gestao_so_admin_master.sql` na lista do schema-guard. O guard roda **a cada boot da API** e a migração é de **dados**: `DELETE FROM privilege_role_grants` das permissões `bi.view`, `pilot.indicators.view` e `population.view` para quem não é administração. No teste, o guard rodava depois de a suíte criar as permissões e apagava todas (daí o 403). Em produção, o efeito seria **desfazer, a cada reinício, o que o Administrador Master liberasse de novo** pela tela de privilégios.

## Impacto real

Produção conferida no banco em 12/nov/2026: nenhuma dessas permissões existe, então o `DELETE` rodou sem apagar nada e ninguém perdeu acesso. Não houve perda de dado. O dano foi a `main` vermelha e o risco latente.

## Por que passou

O PR foi mergeado com a CI ainda em andamento. O teste de `migration-journal` só conferia se o arquivo estava no guard, não o que ele faz.

## Correção

- `0036_gestao_so_admin_master` sai do `SCHEMA_GUARD_FILES` e vai para `MIGRACOES_DE_DADOS_FORA_DO_GUARD` (roda uma vez, por `pnpm db:migrate`; já está no journal).
- Teste `[REG-023]` em `migration-journal.test.ts`: migração nova (idx >= 36) no guard não pode ter `DELETE`, `UPDATE`, `INSERT` nem `TRUNCATE`.
- Regra nova: **no schema-guard só entra migração de estrutura.** Migração de dados fica fora.

## Prova

O teste falha se a migração for recolocada no guard; `bi.e2e.test.ts` (16) e `schema-guard.e2e.test.ts` passam em Postgres descartável.
