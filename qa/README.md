# Regressão e CI/CD do Periscópio

Objetivo: **parar de validar o fluxo inteiro à mão a cada entrega.** O que já funciona fica guardado por teste automático. A pessoa que confere só olha o que é novo.

- O que já está garantido: [`CATALOGO_REGRESSAO.md`](CATALOGO_REGRESSAO.md) (gerado dos testes, não editado à mão).
- Erros que já tivemos, com causa e prova: [`relatorios/`](relatorios/).

## As quatro camadas

| Camada | O que pega | Onde | Roda em |
|---|---|---|---|
| Unitário | regra isolada (cálculo, validação, formatação) | `apps/api/src/**/*.test.ts`, `apps/bi-rag/tests` | CI |
| E2E da API | fluxo real: login, permissões, banco, transições, trilha | `apps/api/src/e2e/*.e2e.test.ts` (Postgres descartável) | CI |
| Contrato tela ↔ API | tela chamando rota que não existe ou mudou | `apps/api/src/contract/web-api-contract.test.ts` | CI |
| Manual, só do novo | aparência, texto, usabilidade | checklist no modelo de PR | quem revisa |

## Regras (valem para todo PR)

1. **Bug corrigido = teste que falha sem a correção.** Nome começa com `[REG-NNN]`. Escreva o relatório em `relatorios/AAAA-MM-DD-assunto.md`.
2. **Feature nova = teste pelas mesmas rotas que a tela usa.** Foi um atalho da API no teste que escondeu o erro de 05/nov/2026 (relatório [REG-001](relatorios/2026-11-05-envio-re-422.md)).
3. **Toda rota que a tela chama existe na API.** O teste de contrato confere sozinho; se renomear ou remover rota, ele lista a tela afetada.
4. **Catálogo atualizado:** `pnpm qa:catalogo` e o arquivo vai no mesmo commit. A CI recusa se estiver velho.
5. **PR de produto sem teste não entra.** Exceção: rótulo `sem-teste` com o motivo na descrição (ex.: só texto de tela).
6. **PR que quebra teste existente não é "remendado" em cima.** Fecha-se e abre-se outro, a partir da `main` atual, com a correção. Se a quebra já entrou na `main`, desfaz-se com `git revert` do merge, e a versão correta volta em novo PR.
7. **Dado sintético sempre.** Aluno só por código; nada de nome, CPF, contato ou relato real em teste, seed ou log.

## Comandos

Banco descartável para os E2E (nome precisa conter `test`; nunca aponte para banco compartilhado):

```bash
docker run -d --rm --name periscopio-test-pg -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=periscopio_test -p 55432:5432 postgres:16
```

```bash
export TEST_DATABASE_URL=postgres://postgres@localhost:55432/periscopio_test DATABASE_URL=postgres://postgres@localhost:55432/periscopio_test SUPERADMIN_EMAILS=bruno@oceanoazul.dev.br
```

```bash
pnpm --filter @periscopio/api test
```

Só um arquivo (mais rápido enquanto desenvolve):

```bash
pnpm --filter @periscopio/api exec tsx --test --test-concurrency=1 src/e2e/re-envio-pela-tela.e2e.test.ts
```

Atualizar o catálogo e conferir tipos:

```bash
pnpm qa:catalogo && pnpm typecheck
```

## Configuração recomendada no GitHub (só o dono do repositório faz)

Sem isto, a `main` pode receber PR vermelho ou PR que só quebra depois de combinado com outro (foi o que deixou a `main` com erro de tipos em 04/nov).

- Proteção da branch `main`: exigir PR e **status checks obrigatórios**: `Typecheck & Build`, `API tests & E2E da jornada`, `Assistente do BI (Python)`, `Trava - mudança de produto traz teste`.
- Marcar **"Require branches to be up to date before merging"** ou ligar a **fila de merge** (o workflow já escuta `merge_group`).
- Bloquear push direto na `main`.

## O que fica para conferir à mão

Só o que o PR declara como novo, no campo "Checagem manual" do modelo de PR. Não refazer o roteiro completo da jornada: se um item do roteiro é importante, ele precisa virar teste (regra 1 e 2) e entrar no catálogo.
