# Spec J-03 — Corpus de justificativas para o RAG-API-BI: como guardar e como integrar (Databricks ou MongoDB)

**Data:** 07/nov/2026 · **Status:** 🔴 **proposta bloqueada. NÃO IMPLEMENTAR ATÉ VALIDAÇÃO** (decisões D-J2 a D-J9 e portões G1 a G4)
**Tipo:** `?` (decisão de produto, jurídica e clínica; não é só técnica)
**Branch futura:** `feat/corpus-justificativas` (não criar antes de G1) · **Regressão reservada:** REG-027
**Depende de:** J-02 (o texto precisa existir, validado, no caso). **Não bloqueia** J-01 nem J-02.
**Pedido do PM (07/nov/2026):** guardar a justificativa de forma estruturada e anônima, em banco não estruturado, para o RAG-API-BI sumarizar, melhorar o modelo de dados e "até criar hipóteses", automatizando o trabalho de quem preenche.

## 1. Resumo em dez linhas

1. O **texto já fica guardado** no caso (J-02), em JSONB do Neon, como dado clínico do caso. Isso não é o corpus.
2. O **corpus** é uma cópia **derivada**, depurada e generalizada, feita por um job, para análise agregada. Nasce **fechada** e só abre depois de testada.
3. "Anônimo" é uma **conclusão** que um teste de reidentificação prova, não um rótulo. Texto livre sobre saúde mental de criança, com 100 a 150 caracteres e contexto, é difícil de anonimizar. Até o teste passar, é **dado pessoal sensível de menor**.
4. **Recomendação de armazenamento:** não adicionar MongoDB. Neon (JSONB) como origem privada e **Databricks (Delta + Unity Catalog)** para o corpus liberado, porque o repo já tem o caminho de Databricks. Detalhe e alternativas na §5.
5. O RAG-API-BI pode **resumir e agrupar temas em nível agregado** e **sugerir etiquetas novas para o Admin Master aprovar**. Isso melhora o modelo de dados sem criar critério clínico.
6. **"Criar hipóteses" sobre crianças: NÃO IMPLEMENTAR ATÉ VALIDAÇÃO.** Bate na regra 1 do projeto (o sistema não diagnostica) e no escopo ("IA diagnóstica ou de risco" fica fora). Ver §9.
7. **"Rede neural":** não treinar modelo com texto de crianças nesta fase. Recuperação (RAG) resolve o que o PM descreve, com menos risco e com poucos dados. Ver §9.
8. Esta proposta **reverte cinco decisões já registradas** (§2). Cada reversão precisa de aceite explícito do PM e do encarregado (DPO).
9. Nada aqui é implementável sem base legal, RIPD e contrato com o operador (Databricks). Decisão em aberto nº 6 do CLAUDE.md.
10. Enquanto bloqueado, **o que J-02 já entrega é suficiente para o produto funcionar**.

## 2. O que esta proposta reverte (decisões que já existem)

| Decisão registrada | Onde | O que o PM pede agora | O que muda |
|---|---|---|---|
| "O texto **nunca** é enviado ao serviço de IA (bi-rag) nem entra em métrica" | cabeçalho de `justificativa.ts` | texto alimenta o RAG | Reversão explícita; o texto sai do caso para um pipeline derivado |
| `justification_metrics` guarda só contagens, **sem o texto** | migração 0033 | guardar o texto | Vira uma tabela nova, separada, com controles próprios |
| "Não enviar ao `bi-rag` nenhuma justificativa" | spec de 06/nov §8 item 3 | idem | Substituído por: o `bi-rag` consulta só o corpus **liberado** |
| "Nunca recebe linhas de dados… Não há treino de modelo sobre dados pessoais" | `apps/bi-rag/README.md` | RAG sobre justificativas; "rede neural" | Mantém-se **sem treino**; passa a recuperar texto liberado |
| Camada analítica "agregada e sintética… sem relato" | `infra/databricks/README.md` | texto livre no lake | O lake ganha uma zona com texto, separada do `gold` agregado |
| Regra 1 (não diagnostica) e escopo (sem IA diagnóstica ou de risco) | CLAUDE.md | "criar hipóteses" | **Não reverto.** Ver §9 |

## 3. Três pedidos diferentes dentro de um só

| # | O que o PM descreveu | O que é | Onde mora |
|---|---|---|---|
| a | "Fica tudo registrado" | Guardar o texto da justificativa | **Já resolvido por J-02**: JSONB do caso (Neon), com RLS por tenant |
| b | "De forma anônima… para a RAG-API-BI" | Corpus derivado para análise agregada | **Esta proposta**, §4 a §8 |
| c | "Melhorar e sumarizar… criar hipóteses… processo mais automatizado" | Modelos sobre o corpus | **Dividido** na §9: sumarizar e agrupar (possível, com portão); hipótese por criança (não) |

Um **resumo por caso para o médico** (o RAG lendo as justificativas **daquele caso**, no escopo do médico) é outra coisa: usa o dado do caso, não o corpus anônimo, e roda dentro do mesmo limite de confiança que o médico já tem. Fica fora desta spec; pode virar J-04.

## 4. Anonimato: o que dá para prometer

`lgpd-anonymization` (pseudonimizar ≠ anonimizar): pseudonimização continua sendo dado pessoal; anonimização exige que, com meios técnicos razoáveis, não dê para reidentificar.

**Risco concreto aqui.** Um registro do corpus tem: texto livre de 100 a 150 caracteres + formulário + resposta + faixa etária + mês. O texto pode revelar quem é o aluno sem nome algum ("o único aluno cadeirante da turma do 3º ano", "irmão gêmeo da turma B", "pai preso este mês"). O validador de J-01 **não detecta nome próprio** nem esse tipo de pista. Logo:

1. **Duas camadas de armazenamento, com status.** A camada de origem (privada) guarda um vínculo irreversível para fora e reversível só por quem tem a chave (para atender retificação e eliminação). A camada de consumo (view) nunca tem esse vínculo.
2. **`anon_status`** por registro: `pendente` → `liberado` (passou) | `suprimido` (bucket pequeno ou texto suspeito) | `retirado` (eliminação/retificação). **Só `liberado` chega ao RAG.**
3. **k-anonimato, k ≥ 5** (o `DATABRICKS_MIN_CELL` do repo já usa 5, "a validar com o DPO"): um registro só é liberado se a combinação `tenant + mês + formulário + campo + resposta + faixa etária` aparece em ≥ 5 registros **de pelo menos 3 escolas diferentes** (para o recorte de escola não funcionar como identificador). Fora disso, `suprimido`.
4. **Contexto generalizado:** sem `studentCode`, sem `case_id`, sem autor, sem escola, sem data (só mês), sem ano de nascimento (decisão em aberto nº 5), faixa etária usando as faixas que o FOGAP já define (`faixaEmUso`), nada inventado.
5. **Segunda barreira de limpeza** (além do validador): remoção de padrões de dado pessoal já cobertos + detecção de nome próprio e de dados indiretos por lista/NER em português, **dentro da nossa infraestrutura**. Texto com suspeita → `suprimido`, nunca "corrigido em silêncio". A taxa de supressão é métrica de saúde do pipeline.
6. **Teste de reidentificação obrigatório antes de G2** (singling out, linkage, inference) com dados **sintéticos** que simulem casos raros. Se qualquer teste passar a identificar alguém, o corpus continua sendo dado pessoal e não sai de `pendente`.
7. **Admin Master e gestor não leem o texto** (regra do projeto: gestor e admin nunca leem conteúdo clínico). Eles veem **temas e contagens agregadas** com k ≥ 5, nunca frases.

Limite honesto: **não dá para prometer anonimato absoluto de texto livre.** A promessa possível é: "só sai o que passou nos testes, com supressão agressiva, e o resto não sai".

## 5. Onde guardar: Neon, Databricks ou MongoDB

| Critério | Neon (JSONB + pgvector) | **Databricks** (Delta + Unity Catalog) | MongoDB Atlas |
|---|---|---|---|
| Dependência nova | nenhuma | já prevista (`infra/databricks`, `databricks.service.ts`, painel `/admin/painel-de-dados`) | **nova** (infra, conta, operador de dados) |
| Operador adicional (LGPD) | nenhum | sim (contrato e região a confirmar) | sim (contrato e região a confirmar) |
| Governança | RLS por tenant já existe | Unity Catalog: permissões por tabela, filtro de linha, máscara de coluna, trilha de acesso | papéis e esquema por coleção; governança a montar |
| Modelo "não estruturado" | JSONB: ótimo para o documento | tabelas Delta com coluna JSON/`STRING` ou tipo semi-estruturado (a confirmar na versão do workspace) | **nativo** de documento |
| Busca por similaridade | `pgvector` (extensão a habilitar no Neon) | Vector Search do Databricks | Atlas Vector Search |
| Carga analítica e BI | pesada para um banco transacional de produção | **feita para isso** (medallion bronze/silver/gold, Genie, dashboards) | possível, menos natural |
| Aderência ao que o projeto já decidiu | D1: "Neon sem Supabase para o que for dado do produto"; "sem dependência nova sem justificar" | consistente com o plano de dados existente | **contradiz** "sem dependência nova" |
| Risco principal | analítica concorrendo com a produção | custo e configuração do workspace; token com escopo mínimo | mais uma superfície com dado de saúde de menor |

**Recomendação:**

1. **Fase A (sem nova infra): Neon.** Tabela privada `justification_corpus_src` (JSONB + status), preenchida por job, com RLS e papel dedicado. Serve para provar o pipeline, o validador e o teste de reidentificação **antes** de levar qualquer coisa a outro operador.
2. **Fase B (só após G1 e G2): Databricks** para o corpus `liberado`, em zona separada do `gold` agregado. É a escolha com menos peças novas, porque o repo já tem o serviço, as variáveis e o painel.
3. **MongoDB: não recomendo.** O documento da §7 cabe em JSONB e em Delta; MongoDB acrescenta um operador novo para o mesmo resultado. Só vale reabrir se o PM quiser um *document store* operacional para a API, e isso não é o caso descrito.
4. **Não colocar texto no `gold` atual.** O `gold` é agregado, sintético e consultado por lista fechada; a regra dele ("sem relato") continua valendo para ele.

## 6. Arquitetura proposta

```
 App (web)                API (Fastify, Render)                         Neon (SP, sa-east-1)
 ┌──────────┐  PUT/envio   ┌───────────────────────────┐   mesma tx   ┌──────────────────────────┐
 │ RE/Esp/  │ ───────────► │ valida (shared, final)    │ ───────────► │ case payload (JSONB)      │ ◄─ fonte da verdade
 │ Médico   │              │ grava caso + evento       │              │ + corpus_outbox (só ref.) │
 └──────────┘              └───────────────────────────┘              └────────────┬─────────────┘
                                                                                    │ lote noturno (Render cron job)
                                                          ┌─────────────────────────▼───────────────┐
                                                          │ JOB DE DERIVAÇÃO (Node + passo Python)    │
                                                          │ 1 lê payload pela ref.  2 valida de novo  │
                                                          │ 3 limpa/suprime (2ª barreira)             │
                                                          │ 4 generaliza contexto   5 calcula HMAC    │
                                                          └───────┬─────────────────────────┬────────┘
                                                                  │ origem                   │ liberado (k≥5)
                                                    ┌─────────────▼────────┐      ┌──────────▼────────────────┐
                                                    │ Neon: corpus_src     │      │ Databricks (zona corpus)   │
                                                    │ (privada, com HMAC)  │      │ bronze → silver → vetor    │
                                                    └──────────────────────┘      └──────────┬────────────────┘
                                                                                              │ só leitura, lista fechada
                                                                              ┌───────────────▼────────────────┐
                                                                              │ bi-rag (consulta) via API Node │
                                                                              │ devolve temas + citações       │
                                                                              └────────────────────────────────┘
```

Pontos que não mudam:
- **A API Node continua sendo quem valida escopo, papel e tenant.** O navegador não fala com Databricks nem com o `bi-rag`.
- **O `bi-rag` HTTP continua sem receber linhas de caso.** O texto passa por um **job de derivação** separado (Python, na nossa infraestrutura, p. ex. `apps/bi-ingest/`), não pelo serviço de consulta de planos. Decisão sobre onde ele roda: D-J7.
- **Sem escrita fora da transação do caso.** A saída para o corpus é um **outbox** (referência, sem texto), gravado na mesma transação do envio/conclusão. Se o job cair, nada se perde nem duplica (idempotente por HMAC).

## 7. Modelo do dado

### 7.1 Documento do corpus (o que o RAG enxerga)

```json
{
  "doc_id": "uuid-v7",
  "schema_version": 1,
  "tenant": "t_<opaco>",
  "origem": { "etapa": "re|especialista|medico|escala", "form": "c", "form_version": "1.0.0", "campo": "percebe_dificuldade", "linha": null },
  "resposta": "sim|nao|as_vezes",
  "texto": "…100 a 150 caracteres, já limpos…",
  "contexto": { "especialidade": null, "faixa_etaria": "<faixa do FOGAP>", "mes": "2026-11" },
  "metricas": { "caracteres": 124, "palavras": 19 },
  "qualidade": { "validador": "j01-1", "limpeza": "l1", "sinais": [] },
  "anon": { "status": "liberado", "bucket_k": 7, "liberado_em": "2026-11" }
}
```

Não entram: `studentCode`, `case_id`, autor, escola, data completa, nome da especialidade com poucos profissionais (se o bucket for pequeno, a especialidade é suprimida), nenhum texto fora dos campos acima.

### 7.2 Tabela de origem no Neon (proposta; **não gerar migração antes de G1**)

```sql
-- 0036_justification_corpus.sql  (PROPOSTA)
CREATE TABLE public.justification_corpus_src (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id),
  src_hmac       bytea NOT NULL,            -- HMAC(chave por tenant, case_id|campo|linha|versão); sem a chave não volta ao caso
  etapa          varchar(16) NOT NULL,
  form           varchar(40) NOT NULL,
  form_version   varchar(24) NOT NULL,
  campo          varchar(80) NOT NULL,
  linha          varchar(80),
  resposta       varchar(12) NOT NULL,
  texto          text NOT NULL,             -- já validado + limpo
  contexto       jsonb NOT NULL,            -- generalizado
  validador_ver  varchar(16) NOT NULL,
  limpeza_ver    varchar(16) NOT NULL,
  anon_status    varchar(12) NOT NULL DEFAULT 'pendente',   -- pendente | liberado | suprimido | retirado
  bucket_k       integer,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, src_hmac)
);
-- RLS por tenant (igual a justification_metrics); GRANT só ao papel do job; NENHUM papel de usuário lê esta tabela.
-- Reversão: DROP TABLE. A chave do HMAC fica em variável de ambiente (CORPUS_HMAC_KEY, sem valor no repo).
```

Eliminação e retificação: o caso corrigido ou eliminado gera nova versão no outbox; o job recalcula o HMAC, marca a linha `retirado` e propaga o `DELETE`/`retirado` ao lake. Sem o vínculo HMAC, **não seria possível honrar a eliminação** — é o preço de a origem ser pseudonimizada, e por isso ela nunca é lida por usuário.

### 7.3 Camadas no Databricks (Fase B)

| Camada | Tabela (catálogo `periscopio`, esquema `corpus`) | Conteúdo | Quem lê |
|---|---|---|---|
| bronze | `justificativas_bronze` | documento liberado, como chegou (JSON) | job de ingestão |
| silver | `justificativas_silver` | desduplicado, tipado, `bucket_k`, `liberado_em`; filtro de linha por tenant | pipeline |
| vetor | índice de similaridade sobre `texto` da silver | embeddings | `bi-rag` (via API) |
| gold | `temas_por_mes`, `etiquetas_sugeridas` | **só contagens e temas, k ≥ 5, sem frase** | painel do Admin Master |

Identidades separadas, todas com privilégio mínimo: **gravador** (escreve só no bronze), **pipeline** (bronze→silver→vetor), **leitor** (só `gold`, o que o painel já usa hoje). O token do painel existente continua **somente leitura em `gold`**.

## 8. Como montar a integração (passo a passo)

| # | Passo | Onde | Observação |
|---|---|---|---|
| 1 | Decisões D-J2 a D-J9 e RIPD aprovados | PM, DPO, jurídico | G1 |
| 2 | Tabelas `corpus_outbox` e `justification_corpus_src` | Neon, **branch isolada do Neon por branch git** | nunca no banco compartilhado sem confirmação |
| 3 | Gravar o outbox na mesma transação de envio/conclusão | API | referência apenas; sem texto |
| 4 | Job de derivação (validar de novo, limpar, generalizar, HMAC) | **Render cron job** chamando um script da API. Hoje **não há fila nem cron** no repo (o `EXECUTION_STATE.md` cita BullMQ, mas `apps/api/src/queue` não existe), então fila seria dependência nova | idempotente; reprocessável |
| 5 | Cálculo de bucket e liberação (k ≥ 5, ≥ 3 escolas) | job | status `liberado`/`suprimido` |
| 6 | Teste de reidentificação com dados sintéticos | CI manual | G2: se falhar, para aqui |
| 7 | Ingestão para o bronze | job com identidade "gravador" | via SQL Warehouse/volume; variáveis abaixo |
| 8 | Pipeline silver + índice de similaridade | Databricks | G3 antes de ligar o RAG |
| 9 | Rota da API que consulta o corpus (lista fechada, escopo do papel) | API | o `bi-rag` nunca vê tenant de outro |
| 10 | Painel de temas e etiquetas sugeridas | web, Admin Master | só agregado |

**Variáveis de ambiente (nomes apenas; valores nunca no repo, no chat ou em teste):**
`CORPUS_ENABLED` (padrão desligado), `CORPUS_HMAC_KEY`, `CORPUS_MIN_K` (padrão 5), `CORPUS_MIN_SCHOOLS` (padrão 3), `DATABRICKS_HOST`, `DATABRICKS_WAREHOUSE_ID`, `DATABRICKS_CATALOG` (já existem), e **um token de gravação separado** do token de leitura do painel. Sem as variáveis, o pipeline responde "desligado" e diz só o nome do que falta, como o painel atual.

## 9. O que o RAG-API-BI pode e não pode fazer

| Capacidade | Status | Condição |
|---|---|---|
| Resumir temas recorrentes **em nível agregado** (por mês, formulário, faixa), com citação de trechos liberados | 🟡 possível | G3; saída marcada "resumo de apoio, não é diagnóstico"; nunca por criança |
| Agrupar justificativas parecidas e propor **etiquetas novas** para o Admin Master aprovar (D3: etiqueta é catálogo do tenant) | 🟡 possível | aprovação humana; entra como catálogo, não como critério clínico |
| Sugerir **ajuste de redação** de campos (perguntas pouco claras, baseado em dúvidas recorrentes) | 🟡 possível | decisão humana; texto novo de formulário clínico segue exigindo fonte e dono clínico |
| Sugerir justificativa pronta para quem preenche | 🔴 **não** | derrota a regra (plausível = o profissional descreve o que viu); spec de 06/nov §8 já proíbe o rascunho de IA no campo de justificativa |
| **Gerar hipóteses** sobre uma criança | 🔴 **NÃO IMPLEMENTAR ATÉ VALIDAÇÃO** | regra 1, regra 2 e escopo do demo. Só reabre com fonte + versão + dono clínico + aprovação, **e** fora do demo |
| Treinar ou ajustar ("fine-tune") uma **rede neural** com o texto | 🔴 não nesta fase | ver abaixo |

**Por que não treinar agora.** (1) Volume: um piloto gera milhares de frases curtas, pouco para treinar algo útil, o bastante para recuperar. (2) Risco: modelos treinados podem memorizar e devolver frases de crianças reais; recuperação sobre texto liberado mantém o controle de quem vê o quê e permite apagar. (3) Exigiria avaliação de viés, ficha do modelo e RIPD próprio. O que o PM descreve (sumarizar, agrupar, sugerir) é recuperação + resumo.

**Reformulação segura de "hipóteses":** em vez de "hipótese sobre a criança", **"pontos de atenção para o profissional revisar"** em nível agregado (p. ex., "neste mês, justificativas do Formulário C citam com frequência dificuldades de leitura"), sempre com origem citada, sem rótulo diagnóstico e sem priorização de risco. Mesmo isso depende da Dra. Ana Cecília.

## 10. Observabilidade (Grafana) — sem texto, nunca

Métricas por execução do job: registros lidos, `liberado`, `suprimido` (por motivo), `retirado`, latência do lote, atraso do outbox, falhas de ingestão, taxa de supressão por formulário. **Nenhum log ou métrica contém texto, `case_id`, HMAC ou tenant em claro.** Alertas: taxa de supressão anormal (o limpador mudou?), outbox parado, falha de ingestão, tentativa de leitura da origem por papel de usuário. Reaproveita o pipeline OTLP/Grafana que a API já tem (`otlp*.test.ts`, `grafana.service.ts`).

## 11. Fases e portões

| Fase | Entrega | Portão para entrar |
|---|---|---|
| 0 (agora) | J-01 e J-02: texto guardado e validado no caso | — |
| A | Origem no Neon + job + teste de reidentificação, tudo em **branch isolada e dados sintéticos** | **G1:** D-J2 a D-J9 respondidas; base legal, RIPD e encarregado (DPO) |
| B | Databricks bronze/silver + índice | **G2:** teste de reidentificação passa; contrato e região do operador |
| C | Resumo agregado e etiquetas sugeridas no painel do Admin Master | **G3:** avaliação de qualidade com revisão humana |
| D | "Pontos de atenção" agregados | **G4:** Dra. Ana Cecília aprova texto, uso e limites; fora do demo |

## 12. Decisões que preciso (nenhuma assumida)

| # | Pergunta | Quem responde | Minha leitura por padrão |
|---|---|---|---|
| D-J2 | Qual a **base legal** e a finalidade do corpus (melhoria do serviço? pesquisa? gestão pública)? Precisa de consentimento do responsável? | PM + DPO + jurídico | **Não implemento.** É a decisão em aberto nº 6 |
| D-J3 | O PM aceita **reverter** as cinco decisões da §2? | PM | Não presumo |
| D-J4 | k mínimo e nº mínimo de escolas (5 e 3 são sugestão) | DPO | 5 e 3 |
| D-J5 | Retenção do corpus e da origem; como atender eliminação | DPO | Origem com HMAC; prazos a definir |
| D-J6 | Região e contrato do Databricks como **operador** | PM + jurídico | Brasil (sa-east-1), a confirmar |
| D-J7 | Onde roda o job de derivação (Render, Databricks Jobs ou no próprio Neon) | engenharia | Render cron + passo Python |
| D-J8 | "Hipóteses": o PM aceita a reformulação para "pontos de atenção agregados", ou quer outra coisa? | PM + Dra. Ana Cecília | Só agregado, fora do demo |
| D-J9 | O corpus inclui as justificativas de **todas** as etapas (RE, especialista, médico, escalas)? Texto de médico e de especialista é mais identificável | PM + DPO | Começar só por RE/FOGAP |

## 13. Aceite (quando destravar)

| Teste | Esperado |
|---|---|
| Dados **somente sintéticos** em dev, teste e seed | nenhum texto real em repo, log ou fixture |
| Origem lida por papel de usuário | recusada; 404 |
| Registro em bucket < k | `suprimido`, não chega ao lake |
| Texto com pista identificadora sintética | `suprimido` |
| Eliminação de um caso | linha `retirado` na origem e remoção no lake no próximo lote |
| Admin Master consulta temas | só contagens e temas; nenhuma frase |
| Falha do job no meio | reprocesso não duplica (UNIQUE por HMAC) |
| `CORPUS_ENABLED` ausente | tudo desligado; mensagem diz só o nome do que falta |

## 14. Riscos

1. **Reidentificação por texto livre** (§4). Mitigação: supressão agressiva, k, teste G2, e nunca chamar de "anônimo" antes.
2. **Esforço do RE gera lixo plausível.** 124 a 500+ textos por aluno aumentam a chance de justificativa fluente e vazia (ver J-02 risco 2). Um corpus cheio disso piora o RAG. Mitigação: métrica de qualidade por formulário e flag de escopo.
3. **Custo e configuração do Databricks** e cold start (o `bi-rag` free já leva ~32 s a frio). O piloto não tem crédito aprovado no Neon e o orçamento é apertado (ver J-02 §1e): **este spec fica fora do piloto**.
4. **Expectativa:** "rede neural que cria hipóteses" não é o que será entregue. Alinhar com o PM antes da demo.
5. **Tempo até a demo de SP:** esta proposta não cabe nela. J-01 e J-02 cabem.
