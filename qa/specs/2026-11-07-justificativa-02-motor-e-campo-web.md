# Spec J-02 — Justificativa obrigatória no motor de formulários e no campo do front

**Data:** 07/nov/2026 (revisado no mesmo dia com o escopo ampliado, §1b) · **Status:** 🟡 pronto para implementar **após D-J1** (escopo das matrizes; D-J1b e D-J10 já decididas) · **Tipo:** T (UX e validação; nenhum critério clínico novo)
**Branches:** `feat/justificativa-obrigatoria-shared-api` (RE + FOGAP, motor + API) → `feat/justificativa-obrigatoria-web` (campo) → `feat/justificativa-especialista` → `feat/justificativa-medico` → `feat/justificativa-escalas-tea` → `test/justificativa-e2e` (ver §6)
**Regressão:** REG-024 (motor/API) · REG-025 (campo no front) · REG-026 (e2e)
**Depende de:** J-01. **Não depende de** J-03.

## 0. Estado de partida (verificado em 07/nov/2026)

- Já implementado, **não commitado**, em `app/`: `justificativasPendentes`, `lacunasDeJustificativa`, `respostaExigeJustificativa`, chave `<campo>__just`, `cel.just` em linha de tabela, `justificativas_comportamentos` e `secao_sumario.conduta_just` no FOGAP, e `justificativas` na rota de comportamentos.
- `pnpm typecheck` passa. Unitários: 436/440. A falha esperada é `re-journey.test.ts:166` (Formulário I), que agora exige a justificativa de "Houve conduta?".
- O front **não renderiza** nenhum desses campos. Hoje o RE não consegue preencher e o envio fica bloqueado.

## 1. Decisão bloqueante D-J1 — quantas justificativas, de fato

O spec de 06/nov (Q1) estimava "~10 perguntas Sim/Não". Contei no catálogo real:

| Formulário | Escolha Sim/Não | Linhas de matriz (Não/Sim/Às vezes) | Máximo de justificativas |
|---|---|---|---|
| A | 3 | 42 (8 matrizes) | 45 |
| B | 5 | 0 | 5 |
| C | 15 | 0 | 15 |
| D | 0 | 22 (2 matrizes) | 22 |
| F | 1 | 0 | 1 |
| **A–F** | | | **88** |
| FOGAP comportamentos | | | **35** |
| "Houve conduta?" | | | 1 |
| **Total no pior caso** | | | **~124 textos de 100–150 caracteres por aluno (≈ 12 a 18 mil caracteres)** |

Estimativa, não medição: a 30 s por justificativa, são ~1 h a mais por aluno, o que piora justamente o KPI de mediana do FOGAP (R8). SNAP-IV (G) e ATA (H) **não entram**: são passos de outro tipo (`snap4`/ata), conforme Q1.

**O PM pediu "toda resposta Sim, Não ou Às vezes".** O motor já faz isso. A decisão que falta é só esta:

| Opção | Efeito | Observação |
|---|---|---|
| **A. Todas** (como pedido) | 124 no pior caso | Maior volume de texto para o corpus de J-03; maior custo de preenchimento. |
| B. Escolha + FOGAP + conduta; matrizes sem | ~36 | Matrizes ficam só com Não/Sim/Às vezes. |
| C. Escopo por campo, definido pelo PM | variável | O catálogo ganha `justificativa?: boolean` por campo/matriz; padrão = A. |

**Recomendação de engenharia: implementar C com padrão A.** Custa uma flag no catálogo, e o PM pode reduzir o escopo depois **sem mexer no motor**. A escolha entre A, B e C é do PM.

## 1b. Escopo ampliado pelo PM (mensagem de 07/nov/2026)

Três pedidos novos, na ordem em que chegaram:

1. **Exigir a justificativa ao concluir** os formulários de **especialista** e de **médico** (não só o RE).
2. **Tela:** o campo de justificativa abre **logo após a seleção**, em todos os formulários.
3. **Itens de escala:** M-CHAT, ASQ, a pergunta "antes dos 36 meses" da ATA e o "distribuído" do SNAP-IV.

O item 3 **reverte a leitura padrão de Q1** (itens de escala pontuada fora do escopo). Adotei a leitura "esses itens **entram**". Se a intenção era o contrário (eles saem), é só uma flag por campo (D-J1b) — **confirmar**.

### Onde cada um está e quanto pesa (contado no catálogo real)

| Local | Motor | Itens que pedem justificativa (máximo) | Onde "concluir" acontece |
|---|---|---|---|
| Fonoaudiologia | `FormDef` (o mesmo do RE) | 129 (1 escolha + 128 linhas) | `specialty-forms.routes.ts` ~153: `POST /api/cases/sections/:sectionId/forms/:formId/complete`, **por formulário** (hoje só recusa formulário em branco). O rascunho (`PUT` ~82) já passa por `validarPayloadDef` |
| Psicopedagogia | `FormDef` | 162 linhas | idem |
| Psicologia | `FormDef` | 82 (7 + 75) | idem |
| Neuropsicologia | `FormDef` | 50 linhas | idem |
| Serviço social | `FormDef` | 42 (2 + 40) | idem |
| Psicomotricidade | `FormDef` | 0 | idem |
| **Médico** | `MdForm` — **outro motor**, payload `Record<string,string>` | 1 campo `simnao` (`sumario_medico`) que guarda vários itens "1. Sim / 0. Não" **dentro de um texto** | `medical-forms.routes.ts` ~173 (409 se não há rascunho; 400 se em branco) |
| M-CHAT | `tea-scoring` (`items: Record<string, YesNo>`) | 23 | rota de triagem |
| ASQ | idem | 40 (itens 2 a 8 saem do cálculo se a criança não fala) | idem |
| ATA — "antes dos 36 meses" | `antes36meses: boolean` | 1 | idem |
| SNAP-IV — "distribuído" | rodapé `sim_nao_exclusivo` | 1 (`quem_respondeu` aparece só se "sim") | passo G |

Os totais de especialista são o **teto** (todas as linhas respondidas com Não/Sim/Às vezes). Um caso só passa pelas especialidades delegadas. **A verificar com a Dra. Ana Cecília:** se as matrizes grandes de psicopedagogia (162) e fonoaudiologia (128) são itens de **teste** (hoje o catálogo diz que itens de teste não são transcritos) ou observações comuns.

### D-J1b — granularidade nas escalas — ✅ DECIDIDA em 07/nov/2026: **opção A (por item)**, por exigência da Dra. Ana Cecília (§1c)

| Opção | M-CHAT + ASQ | ATA e SNAP-IV | Textos |
|---|---|---|---|
| A. Por item (leitura literal) | 63 | 2 | 65 |
| **B. Uma justificativa por instrumento** | 2 | 2 | 4 |
| C. Só as duas perguntas isoladas | 0 | 2 | 2 |

**Recomendação de engenharia (não adotada; o PM decidiu A): B** — a justificativa do M-CHAT e a do ASQ ficam no fim do instrumento, e ATA/SNAP-IV justificam a pergunta isolada. Dois motivos: 63 textos de 100 a 150 caracteres para uma triagem respondida com os responsáveis é o caso que mais pesa no tempo, e a justificativa por item de escala muda o que o profissional "assina". A escolha é do PM; o motor suporta as três por flag.

### Regras novas

1. **Concluir é o portão, rascunho não.** Em especialista e médico, a justificativa é exigida **ao concluir a seção**, no servidor. Salvar rascunho usa o modo rascunho de J-01. Mesma regra do envio do RE.
2. **Especialista** reaproveita `justificativasPendentes` (mesmo `FormDef`). A rota `POST …/forms/:formId/complete` (`specialty-forms.routes.ts` ~153) passa a recalcular as pendências do **formulário que está sendo concluído**; com pendência devolve 400 com os rótulos, sem eco do texto. A conclusão do **sumário da seção** (`cases.routes.ts` ~1422, `markAsCompleted`) é outra rota e **não muda**; **a verificar** se ela já exige os formulários concluídos. Reabrir um formulário já exige motivo (`…/reopen`). Especialista continua vendo e editando **só a própria seção**.
3. **Médico** usa `MdForm`, que não tem `matriz` nem `__just`. Contrato proposto: `payload["<campo>__just"]` para campo `escolha`/`simnao` e `payload["<campo>__just__<item>"]` para cada item dentro do `simnao`. **A verificar:** `normalizarPayloadMedico` hoje descarta chaves desconhecidas? Se sim, precisa aceitar a chave `__just`. O limite `MD_TEXTO_MAX = 4000` não vale para a justificativa: ela mantém o próprio limite de 150.
4. **A justificativa nunca entra na pontuação.** O score continua calculado só no servidor, só pelas respostas (`tea-scoring.ts`). Teste: mesma resposta com e sem justificativa → mesmo score. M-CHAT e SRS-2 seguem "só registro": a justificativa também só registra.
5. **Itens ocultos não exigem.** ASQ 2 a 8 quando a criança não fala; `quem_respondeu` quando "distribuído" ≠ sim.
6. **ATA "antes dos 36 meses"** é booleano: `true` e `false` exigem justificativa; `null` (não respondido) não.
7. **Chaves novas nas escalas.** O validador de respostas TEA hoje rejeita campo desconhecido: precisa aceitar `justificativas` (mapa item → texto), e o schema (`triagem`) guarda no mesmo registro do caso e instrumento. **Migração: nenhuma se o registro já for JSONB (a verificar em `schema.ts` ~805).**
8. **O texto continua sendo dado clínico do caso.** Quem lê é quem já lê a seção hoje. Gestor e admin continuam sem acesso.

### Aceite adicional

| Teste | Esperado |
|---|---|
| Especialista conclui com 1 pendência | 400, rótulo da pendência, sem texto no corpo |
| Especialista conclui completo | `concluido` + evento na mesma transação, com ator, papel, data e motivo |
| Especialista tenta concluir seção de outra especialidade | 404 (não 403 informativo) |
| Médico conclui `sumario_medico` com `simnao` sem justificativa | 400 |
| ASQ: mesma resposta com e sem justificativa | score idêntico |
| ASQ: criança não fala | itens 2 a 8 não geram pendência |
| ATA `antes36meses=false` sem justificativa | pendência; `null` não |
| SNAP-IV `distribuido=nao` sem justificativa | pendência; `quem_respondeu` não exigido |

## 1c. Para que serve a justificativa (explicação do PM, 07/nov/2026, a pedido da Dra. Ana Cecília)

Cada profissional responde a sua própria pergunta com justificativa porque o texto será **levado ao médico e ao RE**, para dois fins:

1. a escola **entender** o que foi observado;
2. os profissionais e o médico poderem **devolver o aluno à escola** quando ele **não faz parte do núcleo**. O núcleo só atende e discute os alunos que fazem parte dele.

Consequências neste spec:

1. **Opção A vale para M-CHAT, ASQ, ATA e SNAP-IV.** Uma justificativa por pergunta. A flag por campo (D-J1) deixa de servir para "aliviar o tempo de preenchimento"; só se usa para o que a Dra. Ana Cecília excluir.
2. **A justificativa é parte do registro clínico lido por outras pessoas**, não só um dado de validação. Precisa aparecer nas telas de **leitura**: no consolidado do médico (pergunta, resposta e justificativa, agrupadas por especialidade e formulário) e na visão do RE (D-J10). Isso entra no bloco do front: hoje só `ReFormLeitura` está previsto.
3. **O sistema apoia, não decide.** A justificativa não calcula nada, não sugere nada e não define "fora do núcleo". Quem devolve o aluno é o médico (alta e encerramento são decisão exclusiva dele). Este spec **não cria** estado, campo nem regra de "fora do núcleo".
4. **Texto de apoio do campo** continua pedindo observação ("descreva só o que foi observado"), porque quem lê é o médico e a escola, não só o especialista.

### Duas decisões que a finalidade abre (nada disso está implementado)

| # | Pergunta | Por que importa | Padrão enquanto não responderem |
|---|---|---|---|
| ~~D-J10~~ | ✅ **Decidida em 07/nov/2026:** o RE **só preenche**; não vê dados nem justificativas de especialistas. Ver §1d. | — | — |
| **Q8** (aberta desde 06/nov) | Quais são os **destinos** do menu "quando não precisa de encaminhamento com o núcleo", e quem os define? | É a ação de "devolver à escola". Sem a lista, não há o que construir. | **Não implementar.** Fica fora do demo |

Pendência anterior que continua valendo: confirmar com a Dra. Ana Cecília se as matrizes grandes (psicopedagogia 162, fonoaudiologia 128) são itens de **teste** ou observações comuns, porque a decisão A as faz pesar muito (§1b).

## 1d. Quem vê o quê (decidido pelo PM em 07/nov/2026)

| Papel | Vê | Escreve |
|---|---|---|
| **RE** | só o que ele mesmo preencheu e enviou (somente leitura após o envio) e as devoluções do médico a ele (M2). **Nunca** vê dados ou justificativas de especialistas | formulários A–I |
| **Especialista** | os dados do aluno **da própria seção** e os **retornos que o médico escreveu sobre os formulários dela**. Nada de outras especialidades | só a própria seção |
| **Médico** | **tudo**: RE, FOGAP, todas as seções, justificativas e retornos | seus formulários, devolução ao RE, retornos aos especialistas |
| Gestor / admin | nenhum conteúdo clínico (inclui justificativas) | — |

Refinamento do PM: o especialista vê dos retornos do médico **apenas os que se referem aos formulários dele**, com atenção aos questionários **opcionais**, preenchidos conforme a necessidade do aluno. **Só o médico acessa o conjunto completo.** Isso vale para **todo profissional que não é médico e tem formulários em separado** (as 6 especialidades), não só para a fonoaudiologia.

**D-J12 (nova):** o RE também é profissional não médico com formulários próprios (A–I). Hoje o retorno do médico ao RE é por **caso** (M2, `case_returns`). O retorno por **formulário** (bloco 5b) passa a valer também para o RE, ou o RE continua só com M2? Padrão até o PM dizer: o RE continua só com M2.

**Confirmado pelo PM em 07/nov/2026:** o comentário do médico por profissional aparece **só para a própria área** (cada especialista vê apenas os retornos sobre os formulários dele), **nunca de forma geral**. Só o médico vê os dados do aluno por completo.

A escola não lê justificativas de especialistas. O que a escola recebe vem do médico (devolução M2 hoje; o encaminhamento "fora do núcleo" depende de Q8).

### O que isso muda no spec

1. **Leitura do especialista: já está garantida hoje** (verificado em `specialty-forms.routes.ts`: `secaoDoEspecialista`, rascunho só do autor, médico lê quando a seção conclui). A justificativa herda essa regra sem código novo. Vira teste de regressão.
2. **Formulário não preenchido não exige nada.** A justificativa só é exigida nos formulários que o especialista de fato **concluiu**; formulário `nao_iniciado` não gera pendência.
   **A verificar:** o catálogo de especialidade tem `opcional` por **campo**, não por **formulário**, e não confirmei se concluir a seção exige todos os formulários concluídos. Se "opcional conforme a necessidade do aluno" precisar de um marcador de formulário opcional por especialidade, **não crio essa regra sem a Dra. Ana Cecília**: dizer quais formulários são opcionais é critério clínico.
3. **O RE não lê dados de especialista.** As rotas de leitura de seção, de formulários e de retornos recusam o RE e nunca devolvem conteúdo: **403** quando é da mesma conta e **404** quando é de outra conta ou não existe (regra 6 do projeto). O front mostra a tela de acesso negado descrita abaixo.

### Recurso novo: retorno do médico por formulário do especialista (não existe hoje)

Hoje `case_returns` é só nível de caso e vai ao RE (`return_id`, `case_id`, `returned_by`, `reason`). Não achei tabela nem rota de comentário do médico por formulário. Contrato **proposto** (nada implementado; conferir o drift de migração antes de gerar):

| Item | Proposta |
|---|---|
| Tabela | `case_form_returns` **append-only**: `return_id` uuid, `tenant_id`, `case_id`, `section_id`, `specialty`, `form_id`, `written_by`, `written_by_role`, `text`, `idempotency_key`, `created_at`. RLS por tenant; trigger contra UPDATE/DELETE, como `case_returns` |
| Escrita | `POST /api/cases/:caseId/sections/:sectionId/forms/:formId/returns`, só o médico. Retorno + evento em `case_timeline` **na mesma transação** (ator, papel, data). O conteúdo clínico não vai à trilha: só quem, quando e qual formulário |
| Leitura | `GET …/returns`: o médico lê todos; o especialista dono da seção lê **só os da própria seção**; qualquer outro papel da mesma conta recebe **403 genérico** (como a seção já faz hoje) e de outra conta **404** (regra 6). Nenhum dos dois devolve conteúdo |
| Texto | passa pelo validador de J-01; o tamanho é a decisão **D-J11** |

**D-J11:** o retorno do médico tem o mesmo limite de 100 a 150 caracteres da devolução M2, ou precisa ser mais longo? Padrão até o PM dizer: o mesmo validador, 100 a 150.

### Aceite adicional

| Teste | Esperado |
|---|---|
| RE lê seção, formulários ou retornos de especialista | 403 (404 se for de outra conta), sem nenhum dado; o front mostra a tela de acesso negado |
| Especialista A lê seção ou retornos da especialidade B | idem: 403 / 404 sem dado + tela de acesso negado |
| Tela de acesso negado | mesma tela para 403 e 404; sem nome de aluno, caso, especialidade ou dono; foco no botão "Voltar"; Esc fecha o popup; 375 px sem rolagem horizontal |
| Especialista A lê os retornos do médico à própria seção | 200, só os do formulário dele |
| Médico lê o consolidado completo (respostas + justificativas + retornos) | 200 |
| Gestor / admin lê qualquer um desses | recusado, sem conteúdo |
| Médico escreve retorno | evento na `case_timeline` com ator, papel e data; sem texto na trilha; tentativa de UPDATE/DELETE recusada |
| Especialista conclui sem ter aberto um formulário opcional | sem pendência por ele |

### Tela de acesso negado (pedido do PM, 07/nov/2026)

Quando um profissional tenta abrir o que não é dele, ele vê uma **mensagem clara de que não tem privilégio de acesso**, em vez de um erro técnico.

- **Quando aparece:** a API respondeu 403 ou 404 numa rota clínica (seção, formulário, retorno). O front mostra a **mesma tela nos dois casos**. Assim ela não revela se o recurso existe em outra conta (regra 6).
- **Texto:** título "Você não tem privilégio de acesso a esta informação." Corpo: "Este conteúdo pertence a outro profissional ou a outra etapa do caso. Se você precisa dele, fale com o médico responsável." Botões: "Voltar" e "Ir para meus casos". **Nunca** cita nome de aluno, caso, especialidade nem quem é o dono.
- **Formato:** página inteira quando a pessoa chegou por endereço direto; **popup** (`role="alertdialog"`) quando clicou dentro de uma tela já aberta. Foco inicial no botão primário, Esc fecha, o foco volta ao ponto de origem. Escolha página/popup é minha; trocar é só estilo.
- **Componente:** `AcessoNegado`, em `apps/web/components/ui/`, usado por RE, especialista e médico. "Acesso negado" entra na lista de estados obrigatórios do front.
- **Registro:** a negação deve ficar na auditoria (quem, papel, rota, quando; nunca conteúdo). **A verificar:** se o mecanismo de `security-denial` já faz isso para essas rotas.

## 1e. Custo e capacidade no piloto

**Premissa do PM:** o Render é limitado e gratuito, e o Neon não teve crédito aprovado. O orçamento do piloto é apertado.

**O que o repositório mostra (pode divergir do painel; conferir):** `render.yaml` declara `periscopio-api` como `starter` e o Redis (`periscopio-redis`) como `starter`, **ambos pagos**; só o `bi-rag` é `free`. Nenhum código da API usa Redis (só aparece em um comentário) e nenhum serviço referencia esse Redis. Pode ser um custo sem uso. Remover é ação externa e fica **só com a sua confirmação**.

**Quanto a justificativa pesa (estimativas, não medições):**

| Item | Estimativa | Leitura |
|---|---|---|
| Tamanho por aluno no RE | 124 textos × (150 + ~70 bytes de chave) ≈ **27 KB** no teto | pequeno |
| Tamanho por formulário de especialista | até ~**35 KB** (162 linhas, psicopedagogia) | pequeno |
| 1.000 alunos | ordem de dezenas de MB | armazenamento não é o gargalo; conferir o limite do plano atual do Neon |
| CPU para validar 124 textos | desprezível (expressões curtas) | não é o custo |
| **Gravações** | o autosave espera 1,5 s de pausa e regrava o **passo inteiro** (`salvarTudo`) | **principal custo**: mais pausas × mais bytes, e cada gravação pode acordar um banco que suspende por inatividade e uma API gratuita que dorme |
| Timer de 20 s de tempo ativo (`re_step_timings`) | já existe, independente da justificativa | não verifiquei se pula a requisição quando não há tempo acumulado |

**Medidas sem infraestrutura nova (entram no front, bloco 2):**
1. Salvar a justificativa ao **sair do campo** e ao trocar de passo, não a cada pausa de 1,5 s.
2. Enviar só as **chaves alteradas** em vez do passo inteiro (o servidor já mescla assim nos comportamentos do FOGAP).
3. Não gravar quando nada mudou.
4. Manter tudo no JSONB do payload: sem tabela extra e sem índice sobre texto.
5. Volumetria (T2) só no envio, como já decidido.
6. **J-03 (corpus, Databricks) fica fora do piloto.** É a maior fonte potencial de custo.
7. **Medir antes de dimensionar:** bytes por gravação e gravações por sessão, pelo OTLP/Grafana que a API já tem, durante ~1 semana de piloto.

**Fórmula para o orçamento:** `custo ≈ alunos ativos × formulários × gravações por formulário × bytes`, mais o tempo de compute acordado. Preços e limites vigentes dos planos **não estão no repo**: passe-me os números (ou o que o painel mostra) e eu monto a tabela. Quem paga o piloto é decisão do PM; nada foi assumido.

## 2. Contrato de dados (sem migração; tudo em JSONB do payload)

| Onde | Chave | Quando exige | Validação |
|---|---|---|---|
| Campo `unica`/`multipla` | `<campo>__just` | resposta ∈ {`sim`,`nao`,`as_vezes`} | rascunho ao salvar; final ao enviar |
| Linha de matriz | `payload[campo][linha].just` | `r` ∈ {`sim`,`nao`,`as_vezes`} | idem |
| FOGAP comportamento | `justificativas_comportamentos[id]` | resposta `sim` ou `nao` | idem |
| Formulário I | `secao_sumario.conduta_just` | "Houve conduta?" = sim **ou** não | idem |

- **Rascunho** (`PUT` de formulário, `PUT` de comportamentos): `validarJustificativa(..., { rascunho: true })` em `validarPayloadDef` e `validarPayloadFogap`. Já implementado.
- **Envio**: o servidor recalcula as lacunas (`lacunasDeJustificativa`, `lacunasFogapItens`, `lacunasDoSumario`) e bloqueia. O cliente nunca decide. **A verificar:** que a rota de envio de fato reavalia no servidor e devolve a lista de lacunas sem ecoar o texto.
- **Ajuste na rota:** `comportamentosBody.justificativas` está `z.string().max(400)` e o comentário diz 150. Trocar por `JUSTIFICATIVA_MAX` para que a primeira barreira e a regra falem a mesma coisa.
- **Isolamento:** nenhuma rota nova. Continua `requireActor(...)` + `tenantId` + escola do RE. Não há papel novo, nem leitura nova por gestor/admin.

## 3. Regras do motor

1. **Sim/Não/Às vezes abre a justificativa** logo abaixo da resposta; qualquer outra resposta (ou vazio) não exige.
2. **Trocar a resposta:** se a nova resposta não exige, a justificativa é removida do payload (`normalizarPayloadDef` passa a limpar `__just` órfão, além de `__texto/__outros/__obs` que já limpa). Se a nova também exige, o texto é mantido e o campo mostra "Confira se a justificativa ainda vale para esta resposta".
3. **"Sim" que já tem texto próprio** (`__texto`, "Onde?", "Quais?") **continua como está**. A justificativa é um campo à parte; não substituir um pelo outro. Ordem na tela: resposta → texto da opção → justificativa.
4. **Envio bloqueado** enquanto houver qualquer pendência, e a mensagem lista **quais** (rótulo da pergunta), nunca o texto.
5. **Após envio, somente leitura.** Caso reaberto por devolução do médico volta a permitir edição; a devolução já exige justificativa própria (M2).
6. **Casos enviados antes desta mudança** continuam enviados e legíveis. A exigência vale para o que ainda não foi enviado. **A verificar:** que `situacaoDaJornada` não rebaixa um caso já enviado por causa das novas lacunas.
7. **Volumetria (T2):** `registrarJustificativa` conta **no envio**, não a cada autosave (senão cada tecla soma). No reenvio após devolução, conta só as justificativas cujo texto mudou. Sem texto, sem aluno, sem autor na métrica.

## 4. Front

### 4.1 Componente `JustificativaCampo` (novo, `apps/web/components/ui/`, reaproveitado por RE, especialista, médico e escalas)

```ts
type Props = {
  id: string;
  rotulo: string;            // "Justificativa" + a que pergunta se refere
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
  erroServidor?: string;     // 400 da API, mostrado como erro do campo
}
```

- `textarea`, `maxLength={150}`, 2 linhas, cresce até 4. O texto normaliza ao sair do campo (espaços repetidos viram um).
- Contador ao vivo: `87/150 · faltam 13`; verde-escuro ao entrar em 100–150 (**cor nunca sozinha**: o texto também muda para "ok").
- Texto de apoio fixo: "Descreva só o que foi observado. Não escreva nome, telefone, documento ou endereço." (simples, observável, não diagnóstico).
- Erros usam a mensagem de `validarJustificativa` (a mesma da API). Aparecem **ao sair do campo e ao tentar enviar**, não a cada tecla.
- A11y (WCAG AA): `<label for>`, `aria-describedby` apontando para apoio + contador, `aria-invalid`, erro em `role="alert"` só quando surge, contador anunciado só ao cruzar 100 e 150 (não a cada tecla). Foco visível. 375 px sem rolagem horizontal.

### 4.2 Onde entra

| Local | Arquivo | Observação |
|---|---|---|
| Escolha única/múltipla | `ReFormRenderer.tsx` (`OpcoesUnica`, `OpcoesMultipla`) | abaixo da opção marcada |
| Linha de matriz | `ReFormRenderer.tsx` (matriz) | ver 4.3 |
| Comportamentos do FOGAP | `FogapComportamentos.tsx` | por comportamento respondido |
| "Houve conduta?" | `ReJourneyPanel.tsx` (Formulário I) | Sim e Não |
| Leitura | `ReFormLeitura` | mostra a justificativa em somente leitura |

### 4.3 Matrizes (22 a 42 linhas)

Um `textarea` aberto por linha estoura a tela. Padrão: a linha mostra o botão **"Justificar"**; ao clicar, abre o campo inline; linha com justificativa válida mostra "Justificada ✓". No topo do bloco: "12 justificativas pendentes" com botão **"Ir para a próxima"** que move o foco. Tudo operável por teclado.

### 4.4 Salvamento automático (R4) sem perder o resto

Risco real: se uma justificativa inválida (por exemplo, `lorem ipsum`) vai no mesmo `PUT` das outras respostas, a API devolve 400 e **nada** daquele lote é salvo. Regra: o front valida em modo rascunho **antes** de enviar e **retira só a chave inválida** do lote; ela fica na memória, marcada "não salva", com a mensagem do motivo. As demais respostas salvam normalmente.
Sem `localStorage` para rascunho clínico (ADR 10A): o texto não salvo vive só na memória da aba.

### 4.5 Estados obrigatórios

carregando (esqueleto) · erro de rede (Alert, com "tentar de novo") · rascunho (contador) · enviado (somente leitura) · pendência (lista no envio). Sem `alert()`. Todo `fetch` pelo cliente único com `credentials: "include"`.

## 5. Aceite

| Teste | Onde | Esperado |
|---|---|---|
| Unidade: `justificativasPendentes` para `unica`, `multipla`, `matriz` | `re-journey.test.ts` | pendência só com resposta que exige; some ao justificar |
| Unidade: troca de resposta limpa `__just` órfão | `re-journey.test.ts` | chave removida |
| Atualizar o teste do Formulário I | `re-journey.test.ts:166` | `conduta: "nao"` sem justificativa → 1 lacuna; com → 0 |
| API: rascunho com `lorem ipsum` | `re-journey` rota | 400, sem eco do texto |
| API: envio com pendência | e2e | bloqueia e lista os rótulos, sem texto |
| API: envio completo | e2e | transição `enviado_re` com ator, papel, data e motivo, e evento na mesma transação |
| API: caso já enviado antes | e2e | continua legível e enviado |
| Métrica: 3 justificativas no envio | e2e (`admin-kpis`) | KPI soma 3; autosave não soma; perfil não-admin recebe 403 |
| Front: contador, erro ao sair do campo, foco na primeira pendência | componente/Playwright | conforme 4.1 e 4.3 |
| Front: lote com 1 justificativa inválida | Playwright | demais respostas salvam; a inválida fica "não salva" |
| Acessibilidade | axe + teclado + 375 px | sem violação AA, sem rolagem horizontal |

**e2e roda só em banco isolado** (branch do Neon por branch git). `DATABASE_URL` do ambiente atual é remota: nenhum e2e sem confirmação.

## 6. Ordem e commits

Uma branch e uma sessão por bloco, todas saindo de `mudancas_demo_sp_presencial` depois que o bloco 1 estiver commitado.

| # | Onda | Branch | Commits | Depende de |
|---|---|---|---|---|
| 1 | Back (RE + FOGAP) | `feat/justificativa-obrigatoria-shared-api` | `feat(shared): required justification in form engine (REG-024)` · `fix(api): align justification limit with shared constant` · `test(api): update Formulario I and justification cases` | J-01, D-J1 |
| 2 | Front (campo comum + RE) | `feat/justificativa-obrigatoria-web` | `feat(web): justification field with live counter (REG-025)` · `feat(web): pending justifications list and focus` · `feat(web): autosave withholds invalid justification` | 1 |
| 3 | Especialista (API + web) | `feat/justificativa-especialista` | `feat(api): require justification to conclude specialist section` · `feat(web): justification in specialist forms` | 1, 2 |
| 4 | Médico (API + web) | `feat/justificativa-medico` | `feat(shared): __just keys in MdForm payload` · `feat(api): require justification to conclude medical section` · `feat(web): justification in medical forms` | 2 |
| 5 | Escalas TEA | `feat/justificativa-escalas-tea` | `feat(api): justification in TEA answers, never in score` · `feat(web): justification in M-CHAT, ASQ, ATA, SNAP-IV` | 2, D-J1b |
| 5b | Retorno do médico por formulário (**recurso novo**, banco → back → front; precisa de migração) | `feat/retorno-medico-por-formulario` | `feat(db): case_form_returns append-only` · `feat(api): doctor return per specialist form` · `feat(web): doctor return and specialist read view` | 3, 4, **D-J11**, aval da Dra. Ana Cecília |
| 6 | QA | `test/justificativa-e2e` | `test(api): e2e for required justification (REG-026)` | 1 a 5 |

Os blocos 3, 4 e 5 não tocam os mesmos arquivos e podem andar em paralelo depois do 2. O campo comum (bloco 2) é o que os três reaproveitam. O corpus para RAG/BI (J-03) **não está nesta lista**: está bloqueado.

## 7. Riscos

1. **Tempo de preenchimento** (D-J1): até ~124 textos por aluno. Mitigação: flag por campo (opção C).
2. **Texto "plausível" fluente mas vazio** passa nas regras objetivas (ver J-01 §5). Não prometer ao PM que o sistema "garante justificativas plausíveis": ele barra lixo óbvio.
3. **Repetir o que o RE já escreveu** no "Onde?/Quais?" vira copia-e-cola e polui o corpus de J-03.
4. **Dado pessoal em texto livre** que o validador não pega (nome próprio sem e-mail/telefone). O validador não detecta nomes. Quem lê (médico) é a segunda barreira; J-03 trata a terceira.
5. **Rascunhos já em andamento** passam a ter pendências. Avisar o RE na primeira abertura (Alert informativo, uma vez).
