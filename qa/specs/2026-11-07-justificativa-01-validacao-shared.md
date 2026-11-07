# Spec J-01 — Validação da justificativa em `packages/shared` (modo rascunho)

**Data:** 07/nov/2026 · **Status:** ✅ aprovado pelo PM em 07/nov/2026 · **Tipo:** T (técnico, sem critério clínico)
**Branch:** `feat/justificativa-obrigatoria-shared-api` · **Base:** `mudancas_demo_sp_presencial`
**Regressão:** REG-016 (existente) + REG-023 (novo, modo rascunho)
**Relacionados:** J-02 (motor e campo no front), J-03 (corpus, bloqueado). Origem: T1 do spec de 06/nov.

## 1. Problema

A regra do PM (100 a 150 caracteres, ≥ 5 palavras, sem enchimento nem dado pessoal) só faz sentido quando a pessoa **termina** o texto. O formulário do RE salva rascunho enquanto ela digita (R4). Se o rascunho exigir 100 caracteres, o salvamento automático falha a cada tecla. Se não validar nada, `lorem ipsum`, CPF ou e-mail ficam gravados no caso.

## 2. Decisão

`validarJustificativa(bruto, { rascunho?: boolean })` tem dois modos. Um único arquivo (`packages/shared/src/justificativa.ts`), usado por web e API. **Quem decide é a API.** Sem IA, sem chamada externa: o mesmo texto dá sempre o mesmo resultado.

| Regra | Final (`rascunho: false`, padrão) | Rascunho (`rascunho: true`) |
|---|---|---|
| Texto vazio | recusa (faltam 100) | **aceita** (conta 0) |
| Mínimo 100 caracteres | recusa | não se aplica |
| Máximo 150 caracteres | recusa | **recusa** |
| Mínimo 5 palavras com ≥ 2 letras | recusa | não se aplica |
| ≥ 60% dos caracteres são letras | recusa | não se aplica |
| `lorem`, `ipsum`, `dolor sit`, `consectetur`, `adipiscing` | recusa | **recusa** |
| E-mail, URL, CPF, telefone, número longo | recusa | **recusa** |
| Mesmo caractere 4× seguido | recusa | **recusa** |
| Mínimo 4 palavras diferentes | recusa | não se aplica |
| Mesma palavra em > 40% das palavras | recusa | não se aplica |
| Palavra ≥ 5 letras sem vogal, 6+ consoantes seguidas, sequência de teclado | recusa | **recusa** |

Regra de ouro do rascunho: **aceita o que está incompleto, nunca o que já está errado.**

## 3. Contrato

```ts
validarJustificativa(bruto: unknown, opcoes?: { rascunho?: boolean }): JustificativaResultado
// { ok: true, texto, caracteres, palavras, tokensEstimados } | { ok: false, motivo, caracteres }

justificativaSchema          // zod, modo final (já existe)
justificativaRascunhoSchema  // zod, modo rascunho (NOVO): mesma função, { rascunho: true }
medirJustificativa(texto)    // só contagens; o texto não sai daqui (inalterado)
```

- Sem migração. Sem rota nova. Sem papel novo.
- Mensagens curtas e observáveis, no mesmo texto na web e na API. Nenhuma mensagem cita o conteúdo digitado.

## 4. Casos de aceite (todos sintéticos, sem aluno real)

| # | Entrada | Final | Rascunho |
|---|---|---|---|
| 1 | `""` | ❌ faltam 100 | ✅ |
| 2 | `"Observei que o aluno"` (20 car.) | ❌ faltam 80 | ✅ |
| 3 | Frase coerente de 120 caracteres, 18 palavras | ✅ | ✅ |
| 4 | Frase coerente de 151 caracteres | ❌ passou 1 | ❌ passou 1 |
| 5 | `"lorem ipsum dolor sit amet…"` com 120 caracteres | ❌ | ❌ |
| 6 | Frase coerente + `fulano@exemplo.com` | ❌ dado pessoal | ❌ |
| 7 | Frase coerente + `(11) 91234-5678` | ❌ dado pessoal | ❌ |
| 8 | `"aaaaaaaa…"` | ❌ repetição | ❌ |
| 9 | `"asdf qwer zxcv hjkl …"` com 110 caracteres | ❌ sem sentido | ❌ |
| 10 | Mesma palavra repetida 12× com 120 caracteres | ❌ repete demais | ✅ (ainda é rascunho) |
| 11 | `"   texto   com   espaços   "` | normaliza (espaços viram um) | idem |
| 12 | `null`, `undefined`, número | ❌ | ✅ (conta 0) |
| 13 | Texto com acento e emoji, 150 code points | ✅ conta por *code point* | ✅ |

Os 13 casos vão em `apps/api/src/services/justificativa.test.ts` (já existe, 7 testes; é onde o catálogo de regressão aponta REG-016).

## 5. Lacunas conhecidas que o teste deve documentar (achadas na leitura, não corrigidas aqui)

1. **Plausibilidade semântica não existe.** "Texto de teste para passar na validação do sistema agora" passa: é fluente e sem repetição. As regras só barram lixo óbvio. Qualquer verificação de sentido (modelo de linguagem) está em J-03 e **depende de decisão do PM e do jurídico**.
2. **Falso positivo de "número longo".** `pareceDadoPessoal` remove espaços do texto inteiro antes de procurar 8 dígitos; "notas 7 8 9 10 11 12" vira `789101112` e é recusado como documento. Raro em prosa, mas deve virar um caso de teste e, se confirmado, uma correção (procurar o número dentro de cada palavra, não no texto colado).
3. **Rascunho cortado no meio da palavra.** O autosave pode salvar `"dificuldad"`. O teste deve garantir que nenhum corte de palavra real em português comum é recusado no rascunho (regras de sem-vogal e de teclado só valem para ≥ 5 letras e para sequências de 4).

## 6. Fora de escopo

- Ligar o validador às perguntas do formulário (J-02).
- Guardar o texto em tabela própria ou enviá-lo ao `bi-rag` (J-03).
- Mudar `JUSTIFICATIVA_MIN`/`MAX`/`MIN_PALAVRAS`: regra do PM de 06/nov.

## 7. Entrega

- Commits: `feat(shared): draft mode for justification validator (REG-023)` · `test(api): justification cases 1-13`.
- Antes de encerrar: `pnpm typecheck` + `pnpm --filter @periscopio/api test` (unitários; **e2e só em banco isolado**).
- Reversão: reverter o commit. Nenhum dado é alterado.
