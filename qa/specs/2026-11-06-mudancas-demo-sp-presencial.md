# Specs — lote 06/nov/2026 (mudanças para a demo presencial em SP)

Branch: `mudancas_demo_sp_presencial` (sem cedilha e sem til no nome do git, para não quebrar CI, Vercel e Render).
Origem: mensagem do PM de 06/nov/2026, com ~40 pedidos sobre RE, médico e especialistas.
Regra deste documento: **nenhum código é alterado antes do spec do item estar aqui**. Cada item segue o formato
**Sintoma → Onde no código → Mudança → Aceite (testável) → Tipo**.

Tipo:
- **T** = técnico/UX. Pode ser feito já.
- **C** = toca conteúdo clínico (formulário de especialidade). A ordem do PM basta para *esconder/mover/reordenar* o que já existe;
  criar texto ou critério novo exige fonte + dono clínico (regra 2 do CLAUDE.md). Esses itens ficam marcados e, se faltar fonte, entram como
  `// NÃO IMPLEMENTAR ATÉ VALIDAÇÃO` com a pergunta ao responsável clínico.
- **?** = ambíguo. Não implementar até o PM responder (ver "Perguntas bloqueantes").

## 0. Estado de partida (verificado hoje)

- Base: `origin/main` em `721706d` (PR 143 já mergeada: vaga só aceita a própria especialidade e fila de pacientes).
- Próxima migração livre: `0030`. Há suspeita antiga de drift entre `schema.ts` e o SQL: **conferir `apps/api/drizzle/meta` antes de gerar**.
- Já existem e serão reaproveitados (não recriar): `case_timeline` (linha do tempo), `re_step_timings` (tempo ativo por formulário A–I),
  `reOptionalStepUsage` ("Não vou aplicar" do SNAP-IV), laudos em `bytea` no Postgres (migração 0028), `professional_term_status`,
  catálogo de capacidades com caixinhas do Admin Master.
- Foto de perfil hoje vai para o **Supabase Storage** (`storage/index.ts` → `putAvatar`) e só a chave fica no Postgres (`users.avatar_key`).
- Menu do RE é montado por capacidade em `DashboardLayout.tsx`; o perfil `ppi` recebe por padrão `board.request`, `pilot.indicators.view`,
  `bi.view`, `population.view` em `apps/api/src/security/capabilities.ts`.

## 1. Perguntas bloqueantes (responder antes da onda indicada)

| # | Pergunta | Bloqueia | Minha leitura por padrão |
|---|---|---|---|
| Q1 | A justificativa de 100–150 caracteres vale para **todo** Sim/Não/Às vezes do sistema? O RE tem ~10 perguntas Sim/Não na jornada, mas SNAP-IV, ATA e M-CHAT têm dezenas de itens pontuados. Exigir 100 caracteres em cada um torna o preenchimento inviável. | T1, R9 | Vale para as perguntas Sim/Não/Às vezes **da jornada do RE e do FOGAP** (inclui "Houve conduta"), **não** para itens de escala pontuada (SNAP-IV, ATA, M-CHAT, SRS-2). |
| Q2 | "Conta por token" no KPI do admin: é o número estimado de tokens das justificativas (volumetria de texto), ou os tokens de IA que o `bi-rag` já conta? | T2 | Tokens estimados das justificativas gravadas (volumetria). O KPI de tokens de IA continua separado. |
| Q3 | Psicopedagógico "trocar a opção 3 pela opção 4": opção 3 de qual campo/bloco? | E3 | Nenhuma. Não mexo sem saber. |
| Q4 | "Bloco de conservação: bloco não é sim; criar as observações como padrão do sistema pré-definido": o que sai (os Sim/Não do Bloco 1 — Conservação do Piaget) e **quais textos pré-definidos** entram? | E8 | Preciso do texto pré-definido (fonte clínica). |
| Q5 | "Descalculia, coloca uma opção Nenhuma": em qual formulário/campo aparece "discalculia"? O catálogo atual trocou esse nome por "competência" (BAC-MAT). | E9 | Opção "Nenhuma" no nível de aquisição do BAC-MAT. Confirmar. |
| Q6 | "EOCA 2.1: observação em todos os campos, no final de cada bloco da temática": é um campo de observação **por bloco** (Temática, Dinâmica, Produto) ou em cada linha? | E4 | Um campo "Observação" no fim de cada bloco. |
| Q7 | "RSR-2" = **SRS-2**? "SCARE" = **SCARED** (já existe em psicologia)? | E2, E10 | Sim para os dois. |
| Q8 | "Menu de encaminhamento quando não precisa encaminhamento com o núcleo": quais destinos? Hoje o médico só delega ao núcleo ou encerra. | M4 | Preciso da lista de destinos e de quem os define. |
| Q9 | Item 14 ("apenas o RE pode emitir para os pais, que sejam delegados do usuário"): é o link da ATA/termo ao responsável, e "delegado" é o RE ao qual o caso foi atribuído? | R12 | Sim: só o RE atribuído ao caso gera o link ao responsável. |
| Q10 | Lista inicial de **etiquetas** (item 11/12). | R10, R11 | Aguardando o PM ("vamos passar as etiquetas"). Sem lista, entra vazio e o admin cadastra. |
| Q11 | Quais itens C têm aval da Dra. Ana Cecília? Os que só movem/escondem (E1, E2, E10) eu faço; os que escrevem texto novo (E4, E8) esperam a fonte. | E-* | Como na coluna "Tipo". |
| Q12 | Data e local exatos da demo em SP, para ordenar as ondas. | todas | Sem data, sigo a ordem de dependência (banco → back → front). |

## 2. Decisões de arquitetura

- **D1 — Neon sem Supabase para o que for dado do produto.** Foto de perfil passa para o Postgres (`bytea`), como os laudos já fazem (0028).
  O bucket do Supabase só continua se houver arquivo grande no futuro. Inventário do que ainda usa Supabase: `storage/index.ts`
  (avatar e, como legado, laudos antigos). Sem Supabase novo.
- **D2 — Uma única função de validação de justificativa** em `packages/shared` (zod), usada por web e API. A API é quem decide.
- **D3 — Etiquetas são catálogo do tenant, cadastrado pelo Admin Master.** O RE só escolhe; nunca digita etiqueta livre.
- **D4 — Devolução ao RE é um evento com UUID próprio** gravado em `case_transitions` e `case_timeline` na mesma transação.
- **D5 — Capacidades mudam por migração de dados, não só por catálogo.** Mudar `defaultRoles` não remove grants já gravados em
  `privilege_role_grants`; a migração insere `deny` para `ppi` nas 4 capacidades.

## 3. Migrações previstas (nenhuma é aplicada em banco compartilhado sem confirmação)

| Nº | Conteúdo | Reversão |
|---|---|---|
| 0030 | `user_avatars(user_id pk→users, tenant_id, content bytea, content_type, size_bytes, updated_at)`; copiar do Supabase só se houver foto legada; `users.avatar_key` vira legado | `DROP TABLE` (foto volta a depender do Supabase) |
| 0031 | `etiquetas(id uuid, tenant_id, grupo, rotulo, ativo, criado_por, created_at)` + índice único `(tenant_id, grupo, lower(rotulo))`; RLS como as demais | `DROP TABLE` |
| 0032 | `case_returns(return_id uuid pk, tenant_id, case_id, returned_by, reason, created_at)` append-only (trigger igual ao de `audit_logs`); colunas `return_id` em `case_transitions.metadata` | `DROP TABLE` |
| 0033 | `justification_metrics(tenant_id, day, form, kind, chars, words, est_tokens, n)` agregada, **sem o texto** | `DROP TABLE` |
| 0034 | `privilege_role_grants`: `deny` de `board.request`, `pilot.indicators.view`, `bi.view`, `population.view` para `ppi` | `DELETE` dos 4 registros |

## 4. Transversais

### T1 — Validação de justificativa (zod) — itens 13 e 16
- **Regra do PM:** após marcar Sim/Não/Às vezes (no escopo de Q1), abre campo obrigatório. Entre **100 e 150 caracteres**, pelo menos **5 palavras**.
  Nunca aceitar *lorem ipsum*, sequência de letras sem sentido nem texto sem palavras.
- **Onde:** novo `packages/shared/src/justificativa.ts` exporta `justificativaSchema` (zod) e `validarJustificativa(texto)`.
  Usado em `ReJourneyPanel.tsx`, `FogapComportamentos.tsx`, `cases.routes.ts` (devolução) e `re-journey.routes.ts` (gravação).
- **Regras objetivas (sem IA, determinísticas):**
  1. `trim` + normaliza espaços; comprimento 100–150 depois do `trim`.
  2. ≥ 5 palavras com ≥ 2 letras; ≥ 60% dos caracteres são letras (impede "1111…" e "!!!!").
  3. Recusa *lorem ipsum* e variantes (`lorem`, `ipsum`, `dolor sit amet`).
  4. Recusa repetição: a mesma letra 4× seguidas; mesma palavra > 40% das palavras; menos de 4 palavras diferentes.
  5. Recusa teclado sem sentido: palavra de ≥ 5 letras sem vogal, ou sequência de teclado (`asdf`, `qwer`, `zxcv`, `hjkl`) dentro de palavra.
  6. Recusa CPF, e-mail, telefone e URL (regra 3 do projeto: sem dado identificável).
- **Mensagem:** curta e observável ("Escreva entre 100 e 150 caracteres, com pelo menos 5 palavras. Faltam 23.") e contador ao vivo.
- **Aceite (REG-015):** tabela de casos (válidos e inválidos) no teste de `shared`; a API devolve 400 com a mesma mensagem; o front não deixa enviar.
- **Tipo:** T (escopo em Q1).

### T2 — KPI de volumetria (admin) — itens 13 e 16
- Cada justificativa válida soma em `justification_metrics` (`chars`, `words`, `est_tokens = ceil(chars/4)`), **sem guardar o texto**.
- Aparece só no Admin Master (capacidade `system.observability.view`), em "Saúde do sistema", com total e por formulário.
- **Calibração:** `est_tokens` é aproximação documentada, não tokenizador de modelo. O `bi-rag` já conta tokens reais de IA (`bi_rag/usage.py`);
  os dois KPIs ficam lado a lado, com nomes diferentes, para não confundir.
- **Aceite:** teste de integração grava 3 justificativas e lê o KPI; um perfil não-admin recebe 403 sem número.
- **Tipo:** T (depende de Q2).

## 5. Responsável Escolar (RE)

### R1 — Foto de perfil não persiste — item 1
- **Causa provável:** a foto depende do Supabase Storage (bucket de avatares) e, se o armazenamento não está configurado, `urlDoAvatar` devolve `null` em silêncio
  (`avatar.service.ts`). A causa exata em produção fica para o primeiro commit do item (log do Render + `/api/me`).
- **Mudança:** gravar em `user_avatars` (0030); `GET /api/me/photo/:userId` com cache e `ETag`; manter validação atual (JPEG/PNG/WEBP, 2 MB, sem EXIF).
- **Aceite:** envia → recarrega a página → a foto continua; e continua depois de reiniciar a API; teste e2e atualiza `profile.e2e.test.ts`.
- **Tipo:** T.

### R2 — Tirar 4 itens do menu do RE — itens 2 a 5
- **Sai do menu do RE:** Agenda do Board, Indicadores do piloto, BI do gestor, Mapa de prevalência.
- **Mudança:** remover `ppi` dos `defaultRoles` das 4 capacidades (D5) + migração 0034. As rotas continuam existindo para os outros perfis.
- **Aceite:** com o usuário RE, o menu não mostra os 4 e `GET` às 4 rotas de API devolve 403; gestor, board e médico continuam vendo.
- **Tipo:** T.

### R3 — "Gerar código de aluno" — texto do item 5
- **Onde:** `re/page.tsx` (botão "Gerar código pseudonimizado" e mensagem "alunos importados com código pseudonimizado").
- **Mudança:** "Gerar código de aluno"; mensagem "N alunos importados com código de aluno."
- **Aceite:** busca por "pseudonimizado" nas telas do RE não encontra o termo. (A tela de privacidade/LGPD mantém o termo jurídico.)
- **Tipo:** T.

### R4 — Formulário por estado, sem rolagem total, com salvamento automático — item 6
- **Mudança:** cada bloco (A–I) vira uma etapa; navegar entre etapas troca o conteúdo no mesmo lugar (sem rolar a página inteira);
  salva automaticamente ao sair do campo e a cada 20 s com alteração (rascunho), com indicador "Salvo às HH:MM / Salvando… / Erro ao salvar".
- **Regras mantidas:** após o envio, somente leitura; só reabre por devolução do médico (D4).
- **Aceite:** 375 px sem rolagem horizontal; fechar a aba e voltar recupera o rascunho; erro de rede mostra Alert e não perde o texto.
- **Tipo:** T. É a maior mudança de front do lote (`ReJourneyPanel.tsx` tem 1078 linhas): entra em commit próprio.

### R5 — ATA opcional — item 7
- **Mudança:** `RE_PASSOS` marca `h` (ATA) como `opcional: true`; sem ATA, não vira lacuna de envio. O sumário do RE mostra "ATA não aplicada".
- **Aceite:** RE envia o caso sem ATA e sem aviso de campo faltando; a trilha registra `pulado`.
- **Tipo:** T.

### R6 — ATA de uso livre — item 8
- **Mudança:** a ATA (responsável) deixa de depender do fluxo do caso: qualquer profissional autenticado do tenant pode abrir e preencher uma ATA
  avulsa para um aluno do seu escopo; o resultado entra no prontuário do aluno. Pontuação continua só indicador de apoio, calculada no servidor.
- **Aceite:** RE, médico e especialista abrem a ATA; gestor e admin recebem 403; o resultado não vira diagnóstico nem alta.
- **Tipo:** T (escopo "todos os profissionais" = papéis clínicos; gestão não lê conteúdo clínico).

### R7 — ATA igual ao SNAP-IV: "Não vou aplicar", trava e vem primeiro — item 17
- **Mudança:** o passo da ATA ganha o botão "Não vou aplicar", gravado em `re_optional_step_usage` (somente inserção); ao pular, o bloco trava e o
  RE pode retomar. A ATA passa a ser o **primeiro** formulário na ordem de preenchimento e no menu de etapas.
- **Aceite:** pular grava `pulado`; retomar grava `retomado`; a ordem na tela é ATA, A, B, C, D, E, F, G (SNAP-IV), I; o teste de `lacunas` cobre ATA pulada.
- **Tipo:** T.

### R8 — Mediana do tempo de preenchimento do FOGAP + KPI no admin — item 9
- **Dado:** `re_step_timings.active_seconds` já soma o tempo ativo por formulário. O tempo do FOGAP por caso = soma dos passos do FOGAP daquele caso
  (passos a definir na implementação a partir de `RE_PASSOS`), por RE.
- **Mudança:** `GET /api/admin/fogap-fill-time` devolve **mediana**, média, p25/p75 e n, por tenant e por escola (grupos < 5 aparecem como "<5").
  Card no Admin Master. Sem tempo individual por pessoa na tela.
- **Aceite:** teste com 5 casos de tempos conhecidos devolve mediana correta; com n < 5 devolve "<5"; só `system.observability.view` acessa.
- **Tipo:** T.

### R9 — Dificuldades persistentes — item 10
- **Hoje:** `DIFICULDADES_PERSISTENTES_OPCOES` tem "Aprendizagem" (e as mesmas listas em `especialidades-catalog.ts` linhas ~2997/3029 e no sumário do RE).
- **Mudança:** remover "Aprendizagem" e criar **1.1 Leitura, 1.2 Matemática, 1.3 Escrita** (rótulos numerados, como pedido). Valor antigo
  `Aprendizagem` continua legível em registros antigos e é exibido como "Aprendizagem (registro anterior)".
- **Aceite:** o catálogo não oferece mais "Aprendizagem" nova; registro antigo abre sem erro; o sumário do RE lista as três novas.
- **Tipo:** T (rótulos dados pelo PM).

### R10 — "Outra" abre caixa de diálogo de etiquetas — item 11
- **Mudança:** marcar "Outra" abre diálogo (focus trap, Esc fecha) com as etiquetas ativas do grupo; o RE escolhe uma ou mais. Sem texto livre.
- **Aceite:** teclado e leitor de tela funcionam (WCAG AA); sem etiqueta ativa, o diálogo avisa "Peça ao administrador para cadastrar etiquetas".
- **Tipo:** T (lista em Q10).

### R11 — Etiquetas cadastradas pelo Admin Master — item 12
- **Mudança:** tela "Etiquetas" em `/admin` (capacidade nova `labels.manage`, travada ao admin); CRUD com desativar em vez de apagar; auditoria de cada mudança.
- **Aceite:** etiqueta duplicada (ignorando maiúscula) é recusada; RE de outro tenant nunca enxerga etiqueta deste tenant.
- **Tipo:** T.

### R12 — Só o RE atribuído emite para os pais — item 14
- **Mudança:** `POST` que gera o link/termo ao responsável exige papel RE **e** caso atribuído a ele; os outros recebem 404 (não revelar existência).
- **Aceite:** médico, especialista, gestor e outro RE do mesmo tenant não conseguem emitir; teste em `rotas-e-termo.e2e.test.ts`.
- **Tipo:** T (depende de Q9).

### R13 — "PpI" vira "RE" em todo texto — item 15
- **Onde (já mapeado):** `SumarioFormularioI.tsx:118` e `ReJourneyPanel.tsx:1035` ("Intervenção do PpI"), `re-journey-catalog.ts:1125`
  ("Houve conduta do PpI?"), além de qualquer ocorrência em telas, PDF/sumário e mensagens de API.
- **Mudança:** substituir por "RE" (Responsável Escolar). O valor interno `ppi` do papel **não muda** (é identificador, não texto).
- **Aceite:** busca por `PpI` e `PPI` em texto de UI devolve zero; testes que citam o texto antigo são atualizados.
- **Tipo:** T.

### R14 — "Houve conduta" — item 16
- **Mudança:** ao marcar **Não** (e, se o PM confirmar, **Sim** também), abre a justificativa de T1 (100–150, ≥ 5 palavras).
- **Aceite:** não envia sem justificativa válida; o servidor recusa o mesmo caso com 400.
- **Tipo:** T.

## 6. Médico

### M1 — FOGAP comportamental também chega ao médico, por aluno selecionado — item 2 do bloco 2.1
- **Mudança:** o sumário executivo do médico passa a incluir o FOGAP comportamental (`FogapComportamentos`) do aluno escolhido,
  lido do mesmo `re_assessments` enviado. Somente leitura.
- **Aceite:** médico seleciona o aluno e vê o bloco; outro tenant recebe 404; sem envio do RE, mostra "ainda não enviado".
- **Tipo:** T.

### M2 — Devolver ao RE com justificativa e UUID auditável — "o que fazer no form do RE"
- **Mudança:** a devolução exige justificativa (T1) e gera `return_id` (uuid v4) gravado em `case_returns`, `case_transitions` e `case_timeline`
  na **mesma transação**. O RE vê o motivo e o `return_id` na tela; o médico também. Nada de UPDATE/DELETE nessas linhas.
- **Aceite:** a devolução devolve `{returnId}`; o evento aparece na linha do tempo com ator, papel, data e motivo; repetir a mesma requisição não duplica
  (idempotente por chave).
- **Tipo:** T.

### M3 — Linha do tempo do paciente (evolução e alterações)
- **Mudança:** tela "Linha do tempo" por aluno (código) a partir de `case_timeline`: enviado, revisão, delegado, devolvido com `return_id`,
  retornado, encerrado, reabertura. Mostra **o que mudou** (campo e quando) sem exibir conteúdo clínico a quem não pode lê-lo.
- **Aceite:** médico vê tudo do caso; RE vê os eventos do próprio caso; gestor/admin recebem 403; ordem cronológica estável.
- **Tipo:** T.

### M4 — Botões ao fim do formulário do médico
- **a) "Devolver ao RE"**: só para o caso de inconsistência que o médico não entende e quer discutir; usa M2.
- **b) Menu de encaminhamento** "quando não precisa de encaminhamento com o núcleo": destinos a definir (Q8).
- **Aceite:** (a) completo; (b) fica **desligado** (`NÃO IMPLEMENTAR ATÉ VALIDAÇÃO`) até a lista de destinos existir.
- **Tipo:** T (a) / ? (b).

## 7. Especialistas

### E1 — DNO a partir de 6 anos e não obrigatório (fonoaudiologia) — **C**
- **Onde:** `especialidades-catalog.ts` `sec("dno", "DNO — Discurso narrativo oral (6 a 12 anos)")` e a síntese.
- **Mudança:** a seção só aparece para aluno com 6 anos ou mais; nunca entra na checagem de campos obrigatórios.
- **Aceite:** aluno de 5 anos não vê DNO; aluno de 6 vê, mas conclui sem preencher.
- **Tipo:** C (usa a faixa que o próprio PDF já traz).

### E2 — SRS-2: comentar na fono, manter só na neuropsicologia — **C**
- **Mudança:** retirar `FONO_SRS2` da lista de fonoaudiologia (comentado, com nota); criar `NEURO_SRS2` reaproveitando a definição existente.
  Testes de fono (anamnese, etc.) ficam opcionais. Dados antigos de SRS-2 na fono continuam legíveis (somente leitura).
- **Aceite:** fono não lista SRS-2; neuropsicologia lista; teste de conformidade da fono (REG-011) é atualizado com a decisão datada.
- **Tipo:** C (depende de Q7).

### E3 — Psicopedagógico: trocar a opção 3 pela 4 — **?**
- Bloqueado por Q3.

### E4 — EOCA: observação ao final de cada bloco — **C**
- **Mudança:** campo "Observação" (texto livre, sem T1) no fim de cada bloco (Temática, Dinâmica, Produto).
- **Aceite:** 3 campos novos, opcionais, salvos junto do formulário.
- **Tipo:** C (depende de Q6).

### E5 — Mesmos parâmetros de validação (zod) nos formulários de especialidade
- **Mudança:** textos livres de justificativa nas especialidades usam `justificativaSchema` (T1); campos de resultado numérico continuam como estão.
- **Tipo:** T.

### E6 — TDE II e BAC-MAT com validação normal
- **Mudança:** nenhum desses campos é obrigatório; só validação de tipo/faixa como nos outros formulários.
- **Aceite:** concluir formulário sem TDE II / BAC-MAT é permitido.
- **Tipo:** T.

### E8 — Bloco de conservação — **?**
- Bloqueado por Q4 (texto pré-definido precisa de fonte clínica). Os testes ficam **não obrigatórios** desde já (parte técnica do pedido).

### E9 — "Nenhuma" no formulário de discalculia — **?**
- Bloqueado por Q5; implementação trivial depois.

### E10 — Neuropsicologia: sai MASC, entra SCARED — **C**
- **Mudança:** em `ESPECIALIDADE_FORMULARIOS.neuropsicologia`, trocar `PSI_MASC` por `PSI_SCARED` (formulário já existente, só resultado).
- **Aceite:** neuro lista SCARED e não lista MASC; psicologia continua com os dois.
- **Tipo:** C (depende de Q7).

## 8. Calibração com o serviço `periscopio-bi-rag` (Render)

Verificado hoje (06/nov, 18:5x UTC):
- Serviço `srv-db43pse0tbcc73d0om8g`, **plano free**, região Oregon, `GET /health` → `{"ok":true}`.
- **Cold start medido: 32,4 s** na primeira chamada depois de ficar parado (o log mostra desligamento às 21:44 de 04/nov e subida às 18:53 de hoje).
  No dia da demo, o assistente do BI e o "rascunho de observações" podem parecer travados na primeira pergunta.
- **Conflito de limite:** `observacoes.py` gera rascunho de até **900 caracteres**; as justificativas passam a ter **150**. São campos diferentes
  ("Observações" ≠ "Justificativa"); o spec mantém os dois, mas o rascunho de IA **não pode** preencher campo de justificativa.
- `usage.py` já conta tokens reais de IA por requisição; o KPI de justificativas (T2) é outro número e fica separado.
- Seed `bi_examples_taruma.json` (67 pares) não cobre perguntas sobre tempo de preenchimento do FOGAP nem justificativas: adicionar 3 exemplos depois que R8 existir.

Ações propostas (nenhuma muda produção sem confirmação):
1. Antes da demo: manter o serviço quente (um ping em `/health` a cada poucos minutos, por exemplo um cron job da Render ou um monitor externo; hoje não há nenhum configurado) **ou** subir o plano — decisão do PM (custo).
2. Teste de contrato local do `bi-rag` (`python -m pytest -q`) rodando no CI do lote.
3. Não enviar ao `bi-rag` nenhuma justificativa (texto livre pode conter dado pessoal; regra 3).

## 9. Ordem de execução e commits

Ordem de dependência (banco → back → front → QA). Um assunto por commit, Conventional Commits, em inglês.

| Onda | Commits previstos |
|---|---|
| 0 | `docs: spec for the SP in-person demo changes` (este arquivo) |
| 1 Banco | `feat(db): user_avatars in Postgres (0030)`; `feat(db): etiquetas catalog (0031)`; `feat(db): case_returns append-only (0032)`; `feat(db): justification_metrics (0033)`; `chore(db): deny ppi on four management capabilities (0034)` |
| 2 Compartilhado/back | `feat(shared): justificativa zod validator (REG-015)`; `feat(api): persist avatar in Postgres (R1)`; `feat(api): etiquetas CRUD for admin (R11)`; `feat(api): return to RE with auditable uuid (M2)`; `feat(api): fogap fill-time median KPI (R8)`; `feat(api): justification volume KPI (T2)`; `fix(api): only the assigned RE issues to guardians (R12)` |
| 3 Catálogos | `feat(shared): persistent difficulties split reading/math/writing (R9)`; `feat(shared): ATA optional and first (R5, R7)`; `refactor(shared): PpI text becomes RE (R13)`; `fix(shared): DNO from 6 years and optional (E1)`; `feat(shared): SRS-2 only in neuropsychology (E2)`; `feat(shared): SCARED replaces MASC in neuropsychology (E10)` |
| 4 Front | `feat(web): RE menu without management items (R2, R3)`; `feat(web): form by step with autosave (R4)`; `feat(web): etiquetas dialog (R10)`; `feat(web): justification field with live counter (T1, R14)`; `feat(web): patient timeline (M3)`; `feat(web): doctor return button (M4a)`; `feat(web): admin cards for fill time and justification volume` |
| 5 QA | `test: REG-015 to REG-02x for this batch`; `docs(qa): regenerate regression catalog` |

Critérios de saída do lote: `pnpm typecheck`, `pnpm lint`, `pnpm --filter @periscopio/api test` verdes; 375 px sem rolagem horizontal nas telas tocadas;
nenhuma migração aplicada em produção sem confirmação do PM.

## 10. Riscos

1. **T1 em todo Sim/Não** (Q1) pode tornar o preenchimento do RE muito mais lento e piorar justamente o KPI de R8. Recomendo o escopo reduzido.
2. **R4 (formulário por etapa)** mexe no coração do RE a poucos dias da demo: ficar atrás de um feature flag por tenant.
3. **Itens C** não podem ganhar texto clínico novo sem fonte (E4, E8).
4. **R2** só vale de verdade com a migração 0034; sem ela, grants antigos mantêm os itens no menu.
5. **Cold start do bi-rag** (32 s) na demo.

## 11. Status de execução (atualizado em 06/nov/2026)

Suíte da API: **683 de 683** passando; typecheck e lint verdes. Nada foi aplicado em banco compartilhado (migrações 0030 a 0035 só rodaram no Postgres local de teste).

| Item | Estado | Teste |
|---|---|---|
| Migrações 0030–0035 | feito (local) | REG-015 |
| T1 validador zod da justificativa | feito (shared); **ainda não ligado** às perguntas Sim/Não do RE (espera Q1) | REG-016 |
| R1 foto no Postgres | feito | REG-017 |
| R11 etiquetas (API) | feito; **falta a tela do admin** e o diálogo do RE (R10) | REG-018 |
| M2 devolução com UUID + justificativa | feito (API); falta o botão/diálogo no painel do médico | journey e2e |
| R8 mediana do FOGAP + T2 volume | feito (API e card em Saúde do sistema); a volumetria hoje só recebe a devolução | REG-019/020 |
| R2 RE sem BI/mapa/indicadores | feito. **Mudança de desenho:** a Agenda do Board sai só do *menu* do RE (o RE segue pedindo ajuda ao Board dentro do caso), por isso `board.request` não foi retirada | testes de BI e piloto atualizados |
| R3 "Gerar código de aluno" | feito | — |
| R9 Leitura/Matemática/Escrita | feito. Valores gravados são os nomes puros; registro antigo "Aprendizagem" continua legível | REG-021 |
| R13 PpI → RE | feito nos textos que nomeiam o RE; "Psicopedagogia (PpI)" como especialidade ficou | — |
| E1 DNO a partir de 6 anos | feito | REG-022 |
| E2 SRS-2 só na neuropsicologia | feito (`neuro_srs2`); licença a confirmar | catálogo |
| E10 SCARED no lugar do MASC (neuro) | feito | catálogo |
| R4 formulário por etapa com autosave | **não iniciado** | — |
| R5/R7 ATA opcional, "Não vou aplicar", primeira da ordem | **não iniciado** (banco já aceita o passo `h`) | — |
| R6 ATA de uso livre | **não iniciado** | — |
| R12 só o RE atribuído emite ao responsável | **não iniciado** (Q9) | — |
| R14, justificativa nas perguntas do RE | **não iniciado** (Q1) | — |
| M1 FOGAP comportamental ao médico | **não iniciado** | — |
| M3 linha do tempo do paciente | **não iniciado** (a API de linha do tempo já existe em `cases.routes.ts`) | — |
| M4 botões finais do médico | **não iniciado** (b depende de Q8) | — |
| E3, E4, E8, E9 | **bloqueados** (Q3, Q4, Q5, Q6) | — |
