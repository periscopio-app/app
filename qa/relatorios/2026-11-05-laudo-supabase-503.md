# Relatório de erro — anexar laudo dá 503 (REG-002)

**Data:** 05/nov/2026 · **Gravidade:** média (o laudo é opcional, mas a tela mostrava erro vermelho) · **Status:** corrigido em PR, falta aplicar a migração e fazer o deploy

## Sintoma

Ao anexar um laudo no perfil do RE: `POST /api/cases/<caso>/attachments → 503` e a faixa vermelha "O armazenamento de laudos não está disponível agora".

## Causa

O log da API (Render) mostra, a cada tentativa: `Sem conexão com o Supabase: o endereço não existe (DNS) (ENOTFOUND)`. O endereço do Supabase configurado na Render (`SUPABASE_URL` ou `SUPABASE_PROJECT_REF`) não existe: projeto removido, pausado de forma definitiva ou endereço digitado errado. É a mesma causa da falha do autoteste de armazenamento e do envio de fotos de perfil. O código só repassava o erro.

## Correção

- O laudo passa a ser guardado **no próprio banco** (coluna `clinical_attachments.content`, bytea). Não depende mais do Supabase. Continua protegido por login, município, escola e permissão (`attachments.read/write`); não existe link público.
- A lista mostra só o título do documento; abrir usa o link interno do sistema.
- O cartão é rotulado "Opcional", diz que não é obrigatório para enviar ao médico e não mostra erro vermelho; falha de envio vira aviso neutro.
- Laudos antigos (se algum ficou no bucket) continuam sendo lidos de lá.
- Nada no fluxo do RE ou do médico exige laudo (o E2E `[REG-001d]` envia ao médico sem nenhum anexo).

## Prova

`[REG-002]` em `apps/api/src/e2e/attachments.e2e.test.ts`: com o armazenamento externo "fora do ar" o laudo salva, lista e abre; laudo antigo ainda abre do bucket.

## O que falta fazer (fora do código)

1. **Aplicar a migração antes do deploy:** `apps/api/drizzle/0028_laudos_no_banco.sql` (adiciona uma coluna anulável; instantânea e idempotente).
2. Corrigir `SUPABASE_URL` na Render **só se** quiser fotos de perfil funcionando (usam o Supabase); os laudos não precisam mais dele.
3. Atenção ao tamanho do banco: até 10 MB por laudo no Postgres do Neon.
4. O título mostrado é o nome do arquivo; orientar a família/RE a não usar o nome do aluno no arquivo.
