# Spec — RLS efetivo no Postgres (isolamento por tenant que o banco impõe de verdade)

Data: 08/nov/2026 · Base: `origin/main` em `6d88556` · Branch prevista: `docs/spec-rls-efetivo`
Origem: pedido do PM de proteger fotos e anexos "da mesma forma que os laudos" dentro do Neon.
Regra deste documento: **nenhum código, migração ou configuração é alterado antes da aprovação do PM.** Nada foi executado contra o Neon, o Render ou a `DATABASE_URL` remota. Toda verificação abaixo rodou em um Postgres 16 descartável, local (container Docker, `127.0.0.1`, nome do banco com `test`), com as migrações 0000–0035 aplicadas do zero.

Formato: **Estado verificado → Inventário → Desenho → Papel e `DATABASE_URL` → Rollout → Testes → Decisões do PM**.

---

## 0. Resumo para o PM (2 minutos)

1. **Hoje o RLS não protege nada.** A API conecta como `neondb_owner`, que ignora RLS (no Neon todo papel criado pelo console, CLI ou API entra em `neon_superuser`, que tem `BYPASSRLS`). Além disso, nenhum código da API grava o contexto de tenant na sessão. O isolamento atual está só nos `WHERE tenant_id = ...` das rotas.
2. **Achado novo e mais grave que o pedido:** existem **dois desenhos de política convivendo**. O desenho da 0018 lê `app.tenant_id` e `app.cross_tenant`. As cinco tabelas criadas em 0029–0033 (`professional_term_status`, `user_avatars`, `etiquetas`, `case_returns`, `justification_metrics`) leem outro parâmetro, `app.current_tenant_id`, e não aceitam o contexto do Admin Master. Se a API passasse a gravar só o contexto da 0018, **essas cinco tabelas ficariam vazias** (provado no banco local: com o tenant A no contexto, `users` devolve 1 linha e `user_avatars`, `etiquetas`, `justification_metrics` e `professional_term_status` devolvem 0). A foto sumiria e, pior, `professional_term_status` vazio faz o `termoPendente` bloquear todo usuário clínico com `TERMO_PENDENTE`. O teste `rls.e2e.test.ts` não pega isso porque só conta se existe uma política, não se ela casa com o parâmetro.
   **Requisito obrigatório (R1, por determinação do PM):** essas cinco tabelas **têm** de aceitar o contexto cross-tenant do Admin Master, como as demais. A 0036 faz isso (`OR app_cross_tenant()`), e o teste T2 e a trava T1 o verificam tabela por tabela; sem R1 verde, a fase 2 não avança.
3. **O `schema-guard` reaplica a 0016 a cada boot** e recria, em 37 tabelas, políticas do desenho antigo ao lado das da 0018 (reproduzido localmente). Não vaza entre tenants, mas é incoerente e precisa sair antes de ligar o RLS.
4. **Proposta:** (a) uma migração `0036` que unifica tudo no desenho da 0018 (inofensiva enquanto a API ainda ignora RLS); (b) uma camada `db` com transação por requisição e `set_config(..., true)`; (c) papel `periscopio_app` com login para a API, separado do dono que só migra; (d) flag `RLS_MODE=off|canary|on` com canário por prefixo de rota, começando pelas cinco tabelas do pedido; (e) testes só em Postgres local.
5. **Decisões que preciso de você** estão na seção 8 (8 perguntas, cada uma com minha recomendação). As três que mudam o cronograma: D1 (falhar fechado), D2 (como a API assume o papel) e D3 (o que entra antes da demo).

---

## 1. Estado verificado

### 1.1 O que é fato (com a evidência)

| # | Fato | Evidência |
|---|---|---|
| F1 | A API usa um único `Pool` com `DATABASE_URL` (`apps/api/src/db/client.ts`) e não grava nenhum parâmetro de sessão. | Nenhum `set_config`/`SET LOCAL` em `apps/api/src`; só `src/e2e/rls.e2e.test.ts` e `scripts/audit-db-security.ts` citam os parâmetros. |
| F2 | O papel dono ignora RLS. `periscopio_app` existe, é `NOLOGIN`, sem `BYPASSRLS`, e hoje ninguém o usa. | Migração 0018; teste `o papel da aplicação não é superuser nem ignora RLS`. Documentação do Neon: papéis criados no console/CLI/API são membros de `neon_superuser` (`BYPASSRLS`); papéis criados por SQL não são. |
| F3 | **Dois desenhos de política.** 0018: `tenant_id = app_current_tenant() OR app_cross_tenant()` (parâmetros `app.tenant_id`, `app.cross_tenant`). 0029–0033: `tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`, sem cross-tenant. | `pg_policies` do banco local, seção 2. |
| F4 | A 0016 (desenho antigo) está na lista do `schema-guard`, que roda no boot **e** é chamado por `recordAudit`. Depois da 0018 apagar as políticas antigas, o boot as recria (`<tabela>_tenant_isolation`, `_tenant_select`, `_tenant_insert`). | `schema-guard.service.ts`; reexecução da 0016 no banco local deixou 2 políticas em `students`, `cases`, `clinical_attachments`, `audit_logs`. Em produção deve estar igual: **confirmar com as consultas da seção 4.6**. |
| F5 | Existem 57 tabelas em `public`; **todas** têm RLS ligado e pelo menos uma política. Não há tabela com dado de tenant sem RLS em `public`. | Consulta ao catálogo do banco local. |
| F6 | O dado de autenticação (`neon_auth.user/session/account/verification/twoFactor`) e as views `public.user/session/account/verification/two_factor/twoFactor` ficam **fora** do RLS e do alcance do `periscopio_app` (sem `USAGE` no schema, sem `SELECT` nas views). O Better Auth usa um `Pool` próprio com `DATABASE_URL`. | `has_schema_privilege` / `has_table_privilege`; `auth/index.ts`. |
| F7 | A resolução do ator (`requireActor`) busca `users` por e-mail **antes** de saber o tenant. Com RLS ligado, essa consulta devolveria 0 linhas e ninguém logaria. | `security/actor.ts`; teste local: sem contexto, `SELECT FROM users` devolve 0. |
| F8 | `GET /api/avatars/:key` é público e lê `user_avatars` só pela chave opaca (uuid), sem tenant. | `profile.routes.ts:213`, `avatar-db.service.ts` (`lerFotoPelaChave`). |
| F9 | Outros consumidores do banco: `auth/credentials.ts` (grava em `neon_auth` no boot via `db`), `factory-reset.service.ts` (liga e desliga gatilhos, `DELETE` em tabelas que o papel da app não pode apagar), `scripts/*`, `drizzle-kit migrate`, e **o app web** (`apps/web/app/api/leads/route.ts` abre um `Pool` direto com `DATABASE_URL` no Vercel). | Leitura do código. |
| F10 | Neon pooled = PgBouncer em modo transação: `SET`/`RESET` de sessão não funcionam; só vale parâmetro local à transação. | Documentação do Neon (conexão pooled, "SET LOCAL trap"). |
| F11 | O Drizzle, ao receber um cliente (não um `Pool`), executa `begin`/`commit` reais em `db.transaction()`. Aninhado dentro de uma transação já aberta, o `commit` interno encerraria a transação da requisição e **apagaria o contexto de tenant**. Aninhado em `tx.transaction()` vira `SAVEPOINT`. | Código de `drizzle-orm/node-postgres/session.js` (0.45.2). O desenho da seção 3 usa a transação nativa do Drizzle para herdar os savepoints. |
| F12 | `support_tickets` e `newsletter_subscribers` têm `tenant_id` anulável, e a política deixa **toda linha com `tenant_id IS NULL` visível a todos os tenants**. | `pg_policies` local. Risco de vazamento de conteúdo de chamado sem tenant (D5). |

### 1.2 Correção ao enunciado

A 0028 só adiciona a coluna `clinical_attachments.content` (a tabela e sua política vêm da 0016/0018). As tabelas com política do desenho antigo são as **cinco** criadas em 0029–0033.

### 1.3 O que eu não pude verificar (fica para você ou para a branch do Neon)

- O catálogo de **produção** (políticas duplicadas pelo `schema-guard`, `rolbypassrls` do `neondb_owner`, se `periscopio_app` já existe lá com as mesmas propriedades). Consultas somente leitura na seção 4.6.
- A **região do serviço no Render** (o `render.yaml` não fixa `region`; o padrão do Render é Oregon). O Neon está em `sa-east-1`. Se forem regiões diferentes, cada ida e volta ao banco custa 100–200 ms e o custo de 2 idas extras por requisição (3.2) pesa. Confirme no painel.
- O comportamento real do endpoint **pooled** do Neon com o desenho (só se testa em uma branch do Neon, fase 3).

---

## 2. Inventário

### 2.1 Tabelas com RLS e política (57 de 57 em `public`)

| Grupo | Política | Tabelas | Observação |
|---|---|---|---|
| **G1** — desenho 0018, `FOR ALL` (40) | `tenant_isolation`: `tenant_id = app_current_tenant() OR app_cross_tenant()` | `bi_questions`, `board_supervision`, `case_medical_forms`, `case_specialty_forms`, `case_summaries`, `cases`, `clinical_attachments`, `consent_acceptances`, `consent_terms`, `enrollments`, `evaluations`, `expert_board_settings`, `expert_meeting_requests`, `expert_slots`, `legacy_import_batches`, `legacy_import_rows`, `legacy_patient_complaints`, `legacy_patient_items`, `legacy_patient_locations`, `legacy_patient_services`, `legacy_patients`, `legacy_variable_dictionary`, `lgpd_requests`, `notifications`, `onboarding_invites`, `population_aggregates`, `psych_assessments`, `re_assessments`, `re_optional_step_usage`, `re_step_timings`, `re_time_baselines`, `schools`, `student_identity_vault`, `students`, `symptom_measurements`, `tea_screenings`, `teacher_observations`, `teams`, `user_school_assignments`, `users` | Algumas não têm `UPDATE` e/ou `DELETE` para o papel da app (2.4). |
| **G2** — desenho antigo, `FOR ALL` (5) | `<tabela>_tenant_isolation` lê `app.current_tenant_id`, **sem** cross-tenant | `professional_term_status`, `user_avatars`, `etiquetas`, `case_returns`, `justification_metrics` | **Inconsistentes com G1.** Corrigidas pela 0036. `case_returns` só aceita `INSERT` (gatilho append-only). |
| **G3** — trilhas append-only (3) | `tenant_read` (`SELECT`) e `tenant_insert` (`INSERT`) no desenho 0018; sem `UPDATE`/`DELETE` para a app | `audit_logs`, `case_timeline`, `case_transitions` | `audit_logs.tenant_id` é anulável: evento sem tenant (ex.: pedido público) hoje **não consegue ser gravado** pelo papel da app. A 0036 passa a aceitar `INSERT` com `tenant_id IS NULL` (ninguém lê, só o contexto cross-tenant). |
| **G4** — especiais (9) | ver abaixo | `tenants`, `courses`, `lessons`, `leads`, `newsletter_issues`, `newsletter_subscribers`, `support_tickets`, `privilege_role_grants`, `privilege_user_grants` | — |

Detalhe do G4:

| Tabela | Regra | Comentário |
|---|---|---|
| `tenants` | `SELECT`: `id = app_current_tenant() OR cross`; escrita só `cross` | Criar tenant (`POST /api/admin/instances`, `onboarding`) exige contexto cross-tenant. |
| `courses`, `lessons` | leitura livre; escrita só `cross` | Catálogo comum. |
| `leads` | `INSERT` livre; resto só `cross` | O site público insere sem contexto. |
| `newsletter_issues` | leitura livre; escrita só `cross` | — |
| `newsletter_subscribers`, `support_tickets` | `tenant_id IS NULL OR tenant_id = atual OR cross` | **F12.** Decisão D5. |
| `privilege_role_grants` | leitura: tenant da regra, regra global (UUID zero) ou `cross`; escrita: tenant ou `cross` | Usa `scope_tenant_id`. |
| `privilege_user_grants` | via `EXISTS` em `users` (tenant do usuário-alvo) ou `cross` | Sem coluna de tenant própria. |

### 2.2 Tabelas com dado de tenant e **sem** RLS

Em `public`: **nenhuma** (F5). Fora do RLS, por desenho ou por estarem em outro lugar:

| Onde | O que guarda | Proteção atual | Proposta |
|---|---|---|---|
| `neon_auth.user`, `session`, `account`, `verification`, `twoFactor` | e-mail, hash de senha, sessões, segredos 2FA. **Sem coluna de tenant.** | Privilégio: `periscopio_app` não tem `USAGE`. O Better Auth conecta como dono. | Fases 1–4: continua no dono. Fase 5: papel `periscopio_auth` só com `neon_auth` + views (D7). RLS por tenant não se aplica (não há tenant). |
| Views `public.user/session/account/verification/two_factor/twoFactor` | espelho das de cima | `periscopio_app` sem `SELECT` (testado). | Idem. |
| Schema `drizzle` | diário de migrações | só dono | Nada a fazer. |
| Bucket do Supabase | laudos e fotos **antigos** (legado, antes de 0028/0030) | chave opaca e URL assinada | Fora deste spec. |
| `users.avatar_key` | chave textual do avatar | `users` está em G1 | — |

**Por que o `neon_auth` não tem RLS por tenant** (e por que não recomendo mudar isso):

1. **Não há predicado possível.** As tabelas de autenticação não têm `tenant_id`; o tenant só existe em `public.users`, ligado por e-mail. Uma política por tenant não teria o que comparar.
2. **O login acontece antes de se saber o tenant.** O Better Auth localiza usuário, sessão e senha por e-mail ou token, sem contexto. RLS por tenant bloquearia exatamente essa busca.
3. **Quem acessa é um serviço que não ignora RLS.** O schema é gerenciado pelo Neon Auth / Better Auth; a própria 0018 o deixou de fora de propósito porque o papel do serviço não tem `BYPASSRLS` e, com RLS ligado, o login travaria. Ligar RLS ali é risco de derrubar a autenticação inteira, para um ganho que o privilégio já entrega.
4. **O que protege hoje é privilégio, e é mais forte para este caso:** `periscopio_app` não tem `USAGE` no schema `neon_auth` nem `SELECT` nas views `public.user/session/account/...` (testado). Com a API no papel da app, o hash de senha e as sessões ficam inalcançáveis por qualquer rota de negócio, mesmo com bug.
5. **Lacuna que sobra:** o Better Auth e os jobs de credencial ainda usam o dono. Fecha-se na fase 5 com o papel `periscopio_auth` (D7), só com `neon_auth` + views e sem acesso a `public`.

Se você quiser RLS também ali (por exemplo, "cada usuário só vê a própria linha em `session`"), é viável em teoria, mas exige testar o fluxo de login do Neon Auth em uma branch do Neon antes. Fica como item da seção 9.

Tabela **sem coluna de tenant** com dado de tenant por vínculo: só `privilege_user_grants` (coberta por `EXISTS` em `users`). `lessons`, `courses`, `newsletter_issues` são catálogo global.

### 2.3 O que o RLS **não** cobre (continua no código)

- **Papel e escola.** RLS isola por tenant. "Gestor e admin nunca leem conteúdo clínico", escopo por escola e perfil de especialista continuam em `requireActor`/rotas. Para o banco impor isso também seria preciso gravar `app.actor_role`/`app.school_id` e reescrever as políticas (D4).
- **Referências entre tenants por chave estrangeira.** O Postgres checa FK sem aplicar RLS. Uma rota que grave `case_returns(tenant_id = A, case_id = <caso do B>)` passa no `WITH CHECK` e na FK. A validação de que o `case_id` pertence ao tenant continua obrigatória no código.
- **Admin Master / `admin_platform`** abre o contexto cross-tenant: um erro numa rota administrativa ainda enxerga todos os tenants. É o desenho já descrito na 0018.
- **Conexão do dono.** Tudo que usar `ownerDb`/`withOwner` ignora RLS. Por isso a lista de quem pode usá-lo é pequena, fixa e testada (T7).

### 2.4 Privilégios do `periscopio_app` que não são o conjunto completo (medido)

| Tabela | Falta | Efeito |
|---|---|---|
| `audit_logs`, `case_timeline`, `case_transitions`, `case_returns`, `symptom_measurements`, `re_optional_step_usage` | `UPDATE`, `DELETE` | Intencional (append-only). |
| `case_medical_forms`, `case_specialty_forms`, `justification_metrics` | `DELETE` | Só o reset de fábrica apaga: roda no dono. |
| `re_step_timings`, `re_time_baselines` | `DELETE` (e `UPDATE` em `re_optional_step_usage`/`symptom_measurements` já negado) | Idem. |

Princípio mantido: **nenhum `ALTER DEFAULT PRIVILEGES`.** Tabela nova sem `GRANT` explícito falha alto (`permission denied`) em vez de abrir sem RLS por esquecimento. Cada migração que cria tabela continua dando `ENABLE RLS`, política e `GRANT`, e a trava T1 é endurecida para checar isso.

---

## 3. Desenho: como cada requisição define o tenant com segurança

### 3.1 Contrato único de sessão (decisão fechada)

- `app.tenant_id` (uuid): tenant do ator. Para o Admin Master virtual (`VIRTUAL_ADMIN_ID`) é `00000000-0000-0000-0000-000000000001`.
- `app.cross_tenant` (`'on'` ou vazio): ligado para `admin_platform`, `adm_master` e e-mail de super admin; e nos poucos fluxos de sistema auditados (3.5).
- Funções `app_current_tenant()` e `app_cross_tenant()` (já existem, 0018). **Todas** as políticas passam a usá-las. `app.current_tenant_id` é aposentado.
- Valores só entram por `set_config(nome, valor, true)` (o `true` torna o valor local à transação) e depois de validados (uuid por regex; `cross` é booleano). Nunca `SET` de sessão: com PgBouncer em modo transação o valor vazaria para a requisição seguinte.
- A decisão "este ator é cross-tenant?" fica numa função só (`isCrossTenantActor` em `security/tenancy.ts`, mesmo critério de `canAccessTenant`).

### 3.2 Camada `db` (o que muda em `apps/api/src/db/client.ts`)

Prova de conceito descartável, rodada no Postgres local: 13 requisições concorrentes (A, B e admin) sobre um pool de **2** conexões, `db.transaction()` aninhada com erro, rollback de uma requisição e rota "esquecida" que lê a tabela inteira. Resultado: cada requisição viu só o próprio tenant (o admin viu os dois), a transação aninhada desfez só o interno, e a conexão devolvida ao pool voltou com `app.tenant_id` vazio. O PoC não entra no repositório.

```
requisição ──onRequest──▶ holder = { tx?: undefined }   (AsyncLocalStorage.run)
              │
   requireActor(...) ──▶ resolve o ator (3.4) ──▶ enterTenantContext(holder, ctx)
              │            └ BEGIN; set_config('app.tenant_id'...), set_config('app.cross_tenant'...)
              ▼
   handler usa `db.*` (Proxy) ──▶ holder.tx (transação nativa do Drizzle; db.transaction() = SAVEPOINT)
              │
   onSend (escrita) / onResponse (leitura) ──▶ COMMIT   ·   onError / onRequestAbort ──▶ ROLLBACK
```

Regras de implementação:

1. `db` vira um `Proxy` com o **mesmo tipo** (`NodePgDatabase<typeof schema>`): as chamadas de `db` e as 13 `db.transaction()` das rotas continuam como estão. Fora de contexto, o `Proxy` **recusa** a consulta com `RlsContextMissingError` (D1), em vez de consultar e devolver vazio.
2. A transação é aberta **eagerly** em `requireActor` (o Drizzle monta o builder de forma síncrona; não dá para abrir "no primeiro uso"). Rota que nunca chama `requireActor` não abre transação.
3. A transação é mantida aberta com uma promessa (`done`) resolvida no `onSend`/`onResponse` (commit) ou rejeitada no erro/aborto (rollback). `COMMIT` acontece **antes** de enviar a resposta nas escritas; em `GET` pode ser depois.
4. Salvaguardas: `idle_in_transaction_session_timeout` e `statement_timeout` (no papel de login, ou `SET LOCAL` na abertura no modo A), mais um teto de vida do contexto na aplicação (60 s) que força rollback e libera a conexão.
5. Consultas de uma requisição usam **uma** conexão e se enfileiram: `Promise.all` continua correto, só deixa de ser paralelo. Handlers que chamam serviços externos (RAG, Resend, bucket legado) seguram uma conexão durante a espera: na implementação chamam `releaseContext()` antes da chamada externa.
6. Custo: +2 idas ao banco por requisição autenticada (BEGIN e `set_config`) e +1 (COMMIT) nas escritas. Se medirmos regressão relevante, dá para juntar BEGIN e `set_config` em uma ida (consulta simples com valores já validados), ao custo de implementar o savepoint no lugar do Drizzle. Métrica `rls_ctx_open_ms` desde o primeiro dia.
7. Dois pools: `ownerPool` (`DATABASE_URL`, inalterado) e `appPool` (modo B, seção 4) ou o mesmo pool do dono com `SET LOCAL ROLE periscopio_app` na abertura (modo A). `pool` continua exportado (testes antigos o usam) e aponta para o dono.

### 3.3 Admin Master virtual e leituras cross-tenant

- `requireActor` já devolve o ator virtual sem consultar o banco. Passa a abrir o contexto `{ tenantId: 0001, crossTenant: true }`. O tenant 0001 ("Plataforma Global") é criado por `seedMasterAccounts` no boot; gravações com `tenant_id = 0001` (ex.: auditoria) já dependem dele hoje.
- Qualquer ator com papel `admin_platform`/`adm_master` abre `crossTenant: true`. Os demais abrem só o tenant deles. `municipal_manager` e `school_manager` continuam com o tenant e o filtro de escola feito no código.
- Rotas administrativas que cruzam tenants (`admin-kpis`, `bi` municipal, `management`, `observability`, `population`, `newsletter` e `support` admin, `privileges`, `onboarding/admin/instances`, `factory-reset`) já exigem `admin_platform`/capacidade; ficam cobertas por esse contexto sem edição, e cada uma ganha teste de que o papel comum recebe 403/404.
- `factory-reset` não pode usar o papel da app: liga/desliga gatilhos (`ALTER TABLE ... DISABLE TRIGGER` exige ser dono) e apaga tabelas append-only. Roda em `withOwner('factory-reset')`, mantém a confirmação dupla atual e registra auditoria.

### 3.4 Resolver o ator antes de saber o tenant (F7)

Escolha: **função `SECURITY DEFINER`** `app_resolve_actor(email)`, que devolve só as 8 colunas que o `requireActor` já seleciona, por e-mail exato (`users_email_unique` garante uma linha). `REVOKE ALL ... FROM PUBLIC`, `GRANT EXECUTE` só ao `periscopio_app`, `search_path` fixado. Uma ida ao banco, sem transação, sem parâmetro de sessão.
Alternativa descartada: política `users_self_lookup` baseada em `app.actor_email`. Funciona, mas exige abrir transação antes de saber quem é o ator (+2 idas) e deixa uma política de leitura por e-mail em `users`.
Só depois disso o contexto do tenant é aberto, **antes** de `termoPendente`/`decideCapability` (que leem `professional_term_status` e `privilege_*`).

### 3.5 Rotas sem ator, jobs e boot

Regra: **nenhuma rota pública nem job abre cross-tenant "de graça".** Cada exceção passa por um módulo único (`security/system-context.ts`) com `withSystemContext(reason, fn)`: registra o motivo, incrementa `rls_system_context_total{reason}` e só é importável de uma lista fixa (T7).

| Rota / tarefa | Tabelas | Contexto proposto |
|---|---|---|
| `GET /api/avatars/:key` (pública) | `user_avatars` | **Função `app_avatar_by_key(uuid)`**, `SECURITY DEFINER`: devolve só `content`, `content_type`, `updated_at` da chave exata. Nenhuma política pública na tabela; ninguém lista fotos de outro tenant, só busca por chave opaca (comportamento atual preservado). Testado: com o tenant A no contexto, a função devolve a foto do B pela chave e 0 linhas para chave inexistente, enquanto `SELECT * FROM user_avatars` continua devolvendo só as do A. |
| `GET /health*` | nenhuma (`SELECT 1`) | Sem contexto, funciona com o papel da app. |
| `POST /api/leads` e o app web `api/leads` | `leads` (`INSERT` livre) | Sem contexto. O `Pool` direto do Vercel deve migrar para a API ou para um papel só de `INSERT` em `leads` (D6). |
| `GET /api/schools/by-slug/:slug` (pública) | `schools`, `tenants` | Leitura por slug via função `SECURITY DEFINER` com as colunas públicas. **O ramo de auto-provisionamento** (cria tenant e escola "demo" num GET público) exige escrita em `tenants`: proponho tirá-lo de um GET público (D6). |
| `GET /api/onboarding/validate-invite`, `POST complete-school`, `POST accept-invite` | `onboarding_invites`, `schools`, `users` | Função `app_invite_by_token(token)` devolve o convite (com `tenant_id`); a partir daí o contexto passa a ser **o tenant do convite** (derivado de um artefato verificado, não de entrada do cliente). |
| `POST /api/access/request|set-password`, `GET validate` | `users` | `app_resolve_actor(email)` para localizar; escrita (`access_enabled`) com contexto do tenant do usuário encontrado. |
| `POST /api/lgpd/requests` (pública) | `lgpd_requests` | Contexto do `tenantId` informado, validado como tenant existente (função `app_tenant_exists`). Hoje o cliente escolhe o tenant; mantém o comportamento, agora visível e testado. |
| `POST /api/newsletter/subscribe|unsubscribe`, `POST /api/support/tickets` sem login | `newsletter_subscribers`, `support_tickets` | Linhas com `tenant_id` nulo passam pela política atual; sem contexto. Com ator, contexto do tenant dele. D5 decide a visibilidade das linhas sem tenant. |
| Boot: `ensureSchema()` | DDL | Dono. Recomendo **tirar do boot** e rodar `db:migrate` como `preDeployCommand` no Render (D8). Enquanto existir, `withOwner('schema-guard')`, sem a 0016. |
| Boot: `seedMasterAccounts`, `healCredentialAccounts` | `neon_auth.*`, `users`, `tenants` | `withOwner('boot-masters')`. |
| `otlp-push` (métricas) | nenhuma | Sem banco. |
| Scripts (`seed-*`, `taruma/*`), `db:migrate` | vários | Dono, fora da API. |
| Better Auth (`/api/auth/*`) | `neon_auth.*` | Pool próprio no dono (fases 1–4). |

### 3.6 Migração `0036_rls_policies_unificadas` (rascunho **testado no banco local**, não aplicado em lugar nenhum)

1. Apaga toda política pública chamada `<tabela>_tenant_isolation|_tenant_select|_tenant_insert` (resíduo da 0016/0029–0033).
2. Recria `tenant_isolation` no desenho 0018 nas cinco tabelas do G2.
3. Troca `audit_logs.tenant_insert` por `tenant_id IS NULL OR tenant_id = app_current_tenant() OR app_cross_tenant()`.
4. Cria `app_resolve_actor(text)` e `app_avatar_by_key(uuid)` (`SECURITY DEFINER`, `search_path` fixo, `REVOKE ALL FROM PUBLIC`, `GRANT EXECUTE` ao `periscopio_app`). Futuras, na mesma linha: `app_invite_by_token`, `app_school_by_slug`, `app_tenant_exists`.
5. Idempotente. Entra também em `meta/_journal.json` (o diário vai até a 0035). **Efeito com a API ainda no dono: nenhum** (o dono ignora RLS).

Verificado no banco local, com um login que herda `periscopio_app`: tenant A vê `users=1, user_avatars=1, etiquetas=1, justification_metrics=1, professional_term_status=1`; sem contexto vê 0 e não grava; `cross_tenant` vê os dois; `audit_logs` aceita `INSERT` sem tenant e não o lê.

Reversão (`0036_down`, guardada junto): `DROP FUNCTION` das novas e recriação das políticas antigas das cinco tabelas. Segura enquanto a API estiver no dono.

### 3.7 Mudanças de código previstas (lista fechada)

| Arquivo | Mudança |
|---|---|
| `apps/api/drizzle/0036_*.sql`, `meta/_journal.json` | Seção 3.6. |
| `apps/api/src/db/client.ts` | Divide em `ownerPool`/`appPool`; exporta `db` (Proxy), `ownerDb`, `pool` (dono, compatibilidade). |
| `apps/api/src/db/tenant-context.ts` (novo) | `AsyncLocalStorage`, `enterTenantContext`, `finishContext`, `RlsContextMissingError`, `withOwner`, métricas. |
| `apps/api/src/security/system-context.ts` (novo) | `withSystemContext(reason, fn)` e lista fixa de motivos. |
| `apps/api/src/security/actor.ts` | Usa `app_resolve_actor`; abre o contexto antes de `termoPendente`/capacidades; Admin Master abre cross-tenant. |
| `apps/api/src/security/tenancy.ts` | `isCrossTenantActor` (fonte única). |
| `apps/api/src/app.ts` | Hooks `onRequest`, `onSend`, `onResponse`, `onError`, `onRequestAbort`; mapeia `42501` e `RlsContextMissingError` para erro genérico com `x-request-id`. |
| `apps/api/src/services/schema-guard.service.ts` | Remove `0016_row_level_security.sql` da lista; passa a usar o dono. |
| `apps/api/src/index.ts`, `auth/credentials.ts`, `services/factory-reset.service.ts` | `withOwner(...)` explícito. |
| `apps/api/src/routes/profile.routes.ts`, `services/avatar-db.service.ts` | `lerFotoPelaChave` usa `app_avatar_by_key`. |
| `apps/api/src/routes/{onboarding,access,lgpd,newsletter,support}.routes.ts` | Seção 3.5. |
| `render.yaml` | Chaves `RLS_MODE`, `RLS_CANARY_PREFIXES`, `DATABASE_URL_APP` (esta com `sync: false`, **sem valor**). |
| `apps/api/src/e2e/rls.e2e.test.ts` e novos | Seção 6. |
| `.github/workflows/ci.yml` | Segunda execução dos e2e com `RLS_MODE=on`. |
| `infra/README.md`, `.env.example` | Só nomes de variáveis, sem valores nem hostnames reais. |

Sem dependência nova: `node:async_hooks`, `pg` e `drizzle-orm` já existem.

---

## 4. Papel `periscopio_app` no Neon e troca da `DATABASE_URL` (sem segredo em lugar nenhum)

Eu não gero, leio, registro nem escrevo senha ou string de conexão. Os passos abaixo são executados por você (ou pelo painel do Render); o repositório só ganha **nomes** de variáveis.

### 4.1 Armadilha do Neon (importante)

**Não criar nem redefinir esse papel pelo console, CLI ou API do Neon.** Papéis criados por esses caminhos entram em `neon_superuser` e ganham `BYPASSRLS`, o que anularia o RLS. O `periscopio_app` foi criado por SQL (migração 0018), então **não** é membro de `neon_superuser`. Habilitar login e trocar senha deve ser feito **por SQL**, no SQL Editor do Neon ou `psql`, conectado como dono.

### 4.2 Verificar antes (somente leitura)

```sql
SELECT rolname, rolcanlogin, rolsuper, rolbypassrls,
       pg_has_role(rolname, 'neon_superuser', 'member') AS membro_neon_superuser
FROM pg_roles WHERE rolname IN ('periscopio_app', current_user);
```

Esperado: `periscopio_app` com `rolsuper=false`, `rolbypassrls=false`, `membro_neon_superuser=false`. Se não for assim, **pare**: o papel foi tocado fora das migrações.

### 4.3 Habilitar o login (passo seu; a senha nasce no seu gerenciador de senhas)

```sql
-- Substitua o marcador pela senha gerada no gerenciador (mín. 12 caracteres, misturados).
ALTER ROLE periscopio_app WITH LOGIN PASSWORD '<SENHA_GERADA_NO_GERENCIADOR>';
ALTER ROLE periscopio_app CONNECTION LIMIT 20;
ALTER ROLE periscopio_app SET statement_timeout = '15s';
ALTER ROLE periscopio_app SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE periscopio_app SET lock_timeout = '5s';
```

Não cole a senha no chat, em issue, em commit nem em `.env.example`.

### 4.4 Apontar a API (painel do Render)

1. No serviço `periscopio-api`, em *Environment*, criar `DATABASE_URL_APP` (secret): o mesmo host **pooled** e o mesmo banco da `DATABASE_URL` atual, trocando só usuário e senha pelos do `periscopio_app`. Quem monta é você, no painel.
2. **Não alterar `DATABASE_URL`.** Ela continua sendo o dono e continua servindo `db:migrate`, boot, reset de fábrica e Better Auth. Por isso o rollback é trocar uma flag, sem mexer em segredo.
3. Criar `RLS_MODE=off` (padrão), depois `canary` e `on` conforme a seção 5.
4. Se `RLS_MODE` for `canary` ou `on` e `DATABASE_URL_APP` estiver ausente, a API **recusa subir** (nunca cai para o dono em silêncio).

**Modo A (transição, sem senha nova):** `GRANT periscopio_app TO neondb_owner;` e `RLS_SET_ROLE=periscopio_app`; a API abre cada transação com `SET LOCAL ROLE periscopio_app`. Serve para a branch do Neon e para o canário (ligar e desligar é só variável). Fraqueza: a conexão ainda é do dono (um `RESET ROLE` num SQL injetado o recupera). O alvo final é o **modo B**. Os testes locais usam o modo A e provam `current_user = 'periscopio_app'` (T5).

### 4.5 Rotação sem parada

- Simples: `ALTER ROLE periscopio_app PASSWORD '<NOVA_SENHA>'` (por SQL, pelo motivo de 4.1), atualizar `DATABASE_URL_APP` no Render e reimplantar. Há uma janela curta de reconexão.
- Sem janela: manter `periscopio_app` como papel de políticas (`NOLOGIN`) e criar dois logins que herdam dele: `CREATE ROLE periscopio_app_a LOGIN IN ROLE periscopio_app;` (e `_b`). Gira-se alternando: define a senha do que está parado, aponta o Render, reimplanta, depois `ALTER ROLE ... NOLOGIN` no antigo. **Testado localmente:** o login que herda sofre RLS (`bypassrls=false`), enxerga só o tenant do contexto e herda os `GRANT`.
- Rotação periódica sugerida: a cada 90 dias e sempre que alguém com acesso ao painel sair.

### 4.6 Consultas somente leitura para conferir produção

```sql
-- 1) quem sou eu e se ignoro RLS
SELECT current_user, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user;
-- 2) políticas por estilo (esperado antes da 0036: cinco tabelas no estilo antigo e duplicatas do schema-guard)
SELECT tablename, policyname, cmd,
       CASE WHEN coalesce(qual,'') || coalesce(with_check,'') ILIKE '%app.current_tenant_id%' THEN 'antigo'
            WHEN coalesce(qual,'') || coalesce(with_check,'') ILIKE '%app_current_tenant%' THEN '0018'
            ELSE 'outro' END AS estilo
FROM pg_policies WHERE schemaname = 'public' ORDER BY estilo, tablename;
-- 3) tabelas sem RLS ou sem política
SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
  AND (NOT c.relrowsecurity OR NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname));
```

O script `pnpm --filter @periscopio/api db:security-audit` já existente é somente leitura e cobre parte disso; rode-o só com a `DATABASE_URL` no ambiente do seu terminal, nunca em chat.

---

## 5. Rollout, canário e rollback

### 5.1 Flag `RLS_MODE`

| Valor | Comportamento |
|---|---|
| `off` (padrão) | Igual a hoje: tudo no dono, sem transação por requisição. |
| `canary` | Só as rotas cujo caminho começa por um prefixo de `RLS_CANARY_PREFIXES` usam o papel da app com contexto. O resto continua no dono e é **contado** (`rls_route_mode{mode="owner"}`), para a abertura ser visível. |
| `on` | Tudo no papel da app. Rota sem contexto falha alto (D1). Só `withSystemContext`/`withOwner` fogem, e estão na lista fixa. |

Prefixos do primeiro canário (o que você pediu): `/api/me/photo`, `/api/avatars`, `/api/etiquetas`, `/api/cases/:id/returns` e o que gravar em `clinical_attachments`/`justification_metrics` (a lista final sai do mapa de rotas na implementação).

### 5.2 Fases

| Fase | O que entra | Quem executa | Critério de saída | Reversível por |
|---|---|---|---|---|
| **0** | Aprovação deste spec | PM | Respostas D1–D8 | — |
| **1** | PR `0036` + `schema-guard` sem a 0016 + testes de política (T1, T8). Só código | eu | CI verde | Revert do PR |
| **1b** | Aplicar `0036` no Neon | **PM, com confirmação explícita** (eu não rodo `db:migrate` remoto) | Consultas 4.6 sem política duplicada; app sem mudança visível | `0036_down` |
| **2** | PR da camada `db` + hooks, `RLS_MODE=off` por padrão. Deploy em `off` | eu | e2e completo verde com `RLS_MODE=on` no banco local; deploy em `off` sem diferença | Redeploy anterior |
| **3** | Branch do Neon (cópia da produção) com modo A; e2e **sintético** contra a branch | PM cria a branch; eu rodo só contra ela e só com sua autorização | e2e verde no endpoint pooled; `rls_ctx_open_ms` aceitável | Apagar a branch |
| **4** | Produção em `canary` (5 tabelas do pedido) | PM define as variáveis | 48 h sem `rls_ctx_missing_total`, `rls_denied_total` nem aumento de erro/latência | `RLS_MODE=off` |
| **5** | `RLS_MODE=on`, modo B, Better Auth em papel próprio | PM | 7 dias limpos; alerta ligado | `RLS_MODE=canary` ou `off` |

### 5.3 Rollback

1. **Rápido (minutos, sem dado alterado):** `RLS_MODE=off` no Render e reimplantar. A `DATABASE_URL` nunca mudou.
2. **Migração:** `0036_down`; pode ficar aplicada sem efeito enquanto a API estiver no dono.
3. **Credencial suspeita:** `ALTER ROLE periscopio_app NOLOGIN` desliga o modo B na hora.

### 5.4 Falhar fechado ou aberto (D1)

O banco **sempre** falha fechado: sem contexto, o papel da app lê 0 linhas e não grava (provado). A pergunta é o que a **aplicação** faz quando uma rota toca o banco sem contexto, porque devolver lista vazia em silêncio é o risco apontado ("API retornando vazio").

| Opção | O que acontece | Veredito |
|---|---|---|
| **A. Falha alta e fechada** | O `db` lança `RlsContextMissingError`; a API responde 500 genérico com `x-request-id` (sem detalhe); métrica `rls_ctx_missing_total` e log com a rota. Nada vaza, e o bug aparece no primeiro teste, não como "tela vazia". | **Recomendada.** |
| B. Fechada e silenciosa | A consulta roda, devolve 0 linhas, a rota responde 404/vazio. Seguro, mas esconde o defeito e parece perda de dados. | Só como fallback do banco, não da aplicação. |
| C. Aberta | Sem contexto, cai para o dono. Anula o RLS justamente onde o código esqueceu o contexto. | **Não recomendada.** |

Risco residual de "vazio indevido": política que não casa com o contexto (como a F3). Mitigações: teste de **controle positivo** (T2: o tenant A tem de ver as próprias linhas), trava T1 que lê a definição das políticas, e autoteste no boot em `on` (contexto de tenant inexistente vê 0 tenants; contexto cross vê ≥ 1; `current_user = 'periscopio_app'`; `rolbypassrls = false`; falhou → a API não sobe).

### 5.5 Observabilidade mínima (módulo `observability/metrics` existente)

`rls_ctx_open_ms`, `rls_ctx_missing_total`, `rls_denied_total` (SQLSTATE `42501`), `rls_system_context_total{reason}`, `rls_route_mode{mode}`. Sem rótulo com tenant, e-mail ou id.

---

## 6. Plano de testes (somente Postgres local descartável)

### 6.1 Regras de execução

- `TEST_DATABASE_URL` precisa ser `localhost`/`127.0.0.1`/socket e o nome do banco precisa conter `test`. O `assertSafeTestDatabase` existente já recusa o resto; os testes novos o chamam **antes** de qualquer conexão e também recusam `DATABASE_URL`/`DATABASE_URL_APP` remotos presentes no ambiente.
- Nada roda contra a `DATABASE_URL` remota. `db:migrate` não roda por mim em banco compartilhado sem sua confirmação explícita.
- Banco descartável (o que usei nesta verificação; sem senha, só no loopback):

```bash
docker run -d --rm --name periscopio-rls-pg -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=periscopio_rls_test -p 127.0.0.1:55434:5432 postgres:16
export TEST_DATABASE_URL="postgres://postgres@127.0.0.1:55434/periscopio_rls_test"
pnpm --filter @periscopio/api test
```

- Dados 100% sintéticos (tenants "A (teste)" e "B (teste)", e-mails `@teste.local`).
- Modo de teste local: superusuário local com `RLS_SET_ROLE=periscopio_app` (modo A). Todo teste de isolamento **assevera** `current_user = 'periscopio_app'` e `rolbypassrls = false` dentro da requisição.

### 6.2 Testes

| # | Teste | O que prova | Falha se… |
|---|---|---|---|
| **T1** | **Trava de política (SQL)** — substitui e endurece a trava atual | Toda tabela de `public` tem RLS, ao menos uma política para o papel da app, **toda política de tabela com `tenant_id` referencia `app_current_tenant()` e nenhuma referencia `app.current_tenant_id`**, e toda tabela tem `GRANT` explícito. | Tabela sem política, volta o parâmetro antigo, ou o `schema-guard` recria política antiga. |
| **T2** | **Isolamento por rota "esquecida" (HTTP)** — o pedido central. O teste registra rotas defeituosas `GET /__test/leaky/:tabela`: chamam `requireActor` e depois `db.select().from(tabela)` **sem nenhum `WHERE tenantId`**. Semeia, via dono, uma linha do tenant A e uma do B em `user_avatars`, `clinical_attachments`, `case_returns`, `etiquetas`, `justification_metrics`. | Como usuário do A (`x-test-email`), devolve **só a linha do A** (controle positivo: 1, não 0). Como usuário do B, só a do B. Como `admin_platform`, as duas (cross-tenant por desenho). Sem sessão, 401. | A rota esquecida vê linha de outro tenant, ou vê 0 do próprio (política que não casa). |
| **T2b** | **Escrita "esquecida"** `/__test/leaky-write/:tabela` | `INSERT` com `tenant_id` do B pelo A é recusado (`42501`, resposta genérica); `UPDATE`/`DELETE` sem `WHERE` afetam só as linhas do A; as do B ficam intactas (conferido pelo dono); `case_returns` segue só-inserção. | Escrita atravessa tenant. |
| **T2c** | **Rota sem ator** `/__test/leaky-noactor/:tabela` | Com `RLS_MODE=on` responde erro genérico (D1-A), **zero linhas** no corpo; o mesmo SQL direto pelo papel da app sem contexto devolve 0. | Rota sem contexto devolve dado. |
| **T3** | **Foto pública** `GET /api/avatars/:key` | Sem sessão, devolve a foto de qualquer tenant pela chave exata (comportamento atual); chave inexistente e formato inválido dão 404 igual; com o tenant A no contexto, `SELECT * FROM user_avatars` (rota esquecida) vê só as do A. | O endpoint público quebra, ou a função vira atalho para listar fotos. |
| **T4** | **Higiene do pool** | 50 requisições simultâneas alternando A e B sobre pool de 2 conexões: nenhuma vê dado do outro. Depois, um cliente cru do pool lê `current_setting('app.tenant_id', true)` e `app.cross_tenant`: ambos vazios. Repete após `ROLLBACK` por erro e após requisição abortada. | Parâmetro vaza para a conexão seguinte. |
| **T5** | **Papel de verdade** | `/__test/whoami` devolve `current_user = periscopio_app` e `rolbypassrls = false` na transação da requisição. | O teste estaria rodando como dono e provando nada. |
| **T6** | **Suíte e2e inteira sob RLS** | Todos os e2e existentes passam com `RLS_MODE=on`. Esperado quebrar e corrigir: `GRANT` faltante, boot, `factory-reset` (vai ao dono), `recordAudit` sem tenant, rotas públicas da 3.5. | Rota quebra por falta de contexto ou privilégio. |
| **T7** | **Lista fixa de quem usa dono/sistema** | Teste de código varre `src/` e falha se `ownerDb`, `withOwner` ou `withSystemContext` for importado fora da lista. | Alguém abre uma porta de fuga sem revisão. |
| **T8** | **Falha fechada do banco** | Papel da app sem contexto: 0 linhas e escrita negada em todas as tabelas de G1–G2. | Política deixa passar sem contexto. |
| **T9** | **404 e não 403 informativo** | Pedido por id de recurso de outro tenant (caso, anexo, foto, etiqueta) devolve 404 com corpo idêntico ao de id inexistente. | Resposta revela existência. |

Cobertura mínima por tabela do pedido: `user_avatars` (T2, T2b, T3), `clinical_attachments` (T2, T2b, T9), `case_returns` (T2, T2b), `etiquetas` (T2, T2b, T9), `justification_metrics` (T2, T2b). `clinical_attachments` e `case_returns` precisam de caso e aluno sintéticos nos dois tenants; o `bytea` `content` não vai na resposta das rotas de teste (só `id` e `tenantId`).

### 6.3 CI

`ci.yml` já sobe um Postgres de serviço para os e2e. A mudança é rodar a suíte **duas vezes**: `RLS_MODE=off` e `RLS_MODE=on` com `RLS_SET_ROLE=periscopio_app`, até a flag ser removida. A cada migração nova, T1 obriga política e `GRANT`.

### 6.4 O que não está coberto

Comportamento do endpoint pooled do Neon e latência real entre Render e Neon: só na fase 3 (branch do Neon), por você, com e2e sintético, nunca na produção.

---

## 7. Riscos

| Risco | Prob./Impacto | Tratamento |
|---|---|---|
| Política que não casa esvazia a tela (F3) | Alta sem a 0036 / alto | 0036 + T1 + T2 com controle positivo + autoteste de boot |
| Conexão presa em transação aberta | Média / médio | Teto de 60 s, `idle_in_transaction_session_timeout`, `releaseContext()`, `DB_POOL_MAX` |
| +2 idas ao banco por requisição | Depende da região / médio | `rls_ctx_open_ms`, checar região no Render, otimizar para 1 ida |
| `recordAudit` perdendo evento sem tenant | Média / alto | 0036 item 3 + teste |
| Boot quebra (DDL; escrita em `neon_auth`) | Certa se ignorada / alto | `withOwner`, `schema-guard` sem a 0016, `db:migrate` no pré-deploy |
| `factory-reset` quebra | Certa se ignorada / médio | Roda no dono, com a confirmação atual |
| Funções `SECURITY DEFINER` viram brecha | Baixa / alto | Só colunas necessárias, chave exata, `search_path` fixo, `REVOKE FROM PUBLIC`, T3 |
| Vazamento por FK entre tenants | Baixa / alto | Validação por tenant continua no código |
| Janela até a demo (meados de nov/2026) | — | D3 |

---

## 8. Decisões do PM

Sem resposta eu sigo a recomendada.

| # | Pergunta | Recomendação | Se decidir diferente |
|---|---|---|---|
| **D1** | Rota que toca o banco sem contexto: falhar alto e fechado (500 genérico + alerta), fechado e silencioso (lista vazia) ou cair para o dono? | **Falhar alto e fechado.** Nunca cair para o dono. | Silencioso vira "dado sumiu"; cair para o dono desfaz a proteção. |
| **D2** | Como a API assume o papel: (A) `SET LOCAL ROLE` na conexão do dono ou (B) login próprio `periscopio_app` com `DATABASE_URL_APP`? | **A na branch do Neon e no canário; B como alvo final** (fase 5). | Só A: simples, mas o dono segue na conexão. Só B: exige segredo novo já na fase 3. |
| **D3** | O que entra antes da demo de SP (meados de nov/2026)? | **Fases 1, 1b e 2 (sem efeito visível) e, se a branch do Neon passar, o canário das 5 tabelas do pedido.** `on` para todas as rotas **depois** da demo. | `on` na semana da demo é o maior risco. |
| **D4** | RLS deve também impor "gestor/admin nunca leem conteúdo clínico" (papel e escola no contexto)? | **Não agora.** Fica no código; reavaliar após a fase 5. | Mais forte, mas amplia o escopo a todas as tabelas clínicas e aos testes. |
| **D5** | Linhas de `support_tickets` e `newsletter_subscribers` com `tenant_id` nulo: continuam visíveis a todos os tenants ou só ao cross-tenant? | **Só ao cross-tenant**, com o chamado do próprio autor lido pelo e-mail dele na rota. | Manter preserva a tela de suporte, mas mantém F12. |
| **D6** | Tirar do caminho público o auto-provisionamento de escola "demo" em `GET /api/schools/by-slug/:slug` e mover o `Pool` direto de `apps/web/app/api/leads` para a API (ou um papel só de `INSERT` em `leads`)? | **Sim aos dois**, em PRs separados. | Se mantidos, `by-slug` precisa de cross-tenant em rota pública, e o Vercel segue com credencial de banco. |
| **D7** | Papel próprio `periscopio_auth` (só `neon_auth` + views) para o Better Auth e os jobs de credencial? | **Sim, na fase 5.** Até lá, no dono. | Sem isso o dono segue na API para autenticação. |
| **D8** | `ensureSchema()` sai do boot em favor de `db:migrate` como comando de pré-implantação no Render? | **Sim.** | Se ficar, roda no dono e continua mascarando migração que falha (`etapa ignorada`). |

---

## 9. Fora deste spec

- Impor papel e escola no banco (D4).
- Chaves estrangeiras compostas `(tenant_id, id)` contra referência entre tenants.
- Rotação automática de credencial e alerta de uso do dono fora da lista.
- Migração dos laudos/fotos legados do bucket do Supabase.
- RLS dentro do `neon_auth` (só depois de testar o login do Neon Auth em uma branch do Neon).

## 10. Estimativa (engenharia, sem contar espera por você)

| Fase | Esforço |
|---|---|
| 1 (0036 + `schema-guard` + T1/T8) | ~0,5 dia |
| 2 (camada `db`, hooks, ator, rotas públicas, T2–T7, T9, CI) | ~2 a 3 dias |
| 3 (branch do Neon) | ~0,5 dia + suas ações |
| 4–5 | acompanhamento |

## 11. Verificação feita para este spec (reprodutível)

Banco local `postgres:16` em container, `127.0.0.1`, nome com `test`; migrações 0000–0035 aplicadas por `resetTestDatabase`. Medido: 57 tabelas, todas com RLS e política; 5 no desenho antigo; o contexto da 0018 devolve 0 linhas nelas; reexecutar a 0016 duplica política; `periscopio_app` sem acesso ao `neon_auth`; login que herda `periscopio_app` sofre RLS; rascunho da 0036 aplica sem erro e corrige as cinco tabelas; PoC da camada `db` sem vazamento em pool de 2 conexões. Container removido ao final. Nenhum comando tocou Neon, Render, Vercel ou qualquer `DATABASE_URL` remota.
