# Specs — lote 05/nov/2026 (fonoaudiologia vs. PDF e erros de produção)

Fonte clínica única: `docs/Cap FONO plataforma 1809.pdf` (20 páginas). Quando o sistema e o PDF divergem, **vale o PDF**.
Regra do produto que continua valendo: o sistema **não calcula, não interpreta, não sugere conduta**; em branco continua em branco.

## Por que o PDF da fono foi interpretado errado

Resumo: não foi falta de leitura do PDF, foi uma cadeia de decisões de desenho que foram se acumulando sem uma checagem contra a fonte.

| # | Causa | Evidência no código |
|---|---|---|
| C1 | **Regra de produto lida de forma ampla demais.** A regra diz "guardamos só o RESULTADO, sem reproduzir os itens dos testes (licença)". Fui além: reduzi cada tabela de resultados do PDF a *uma classificação + um número + uma observação*. Mas percentil, repetições, intrusões, clusters, escore bruto e "Aplicação" **são resultado/legenda do PDF**, não itens licenciados do teste. | cabeçalho de `especialidades-catalog.ts` |
| C2 | **O motor só tinha um campo numérico por linha** (`comNumero`). Em vez de ampliar o motor, "empurrei" o que não cabia para a observação e deixei um aviso na descrição da seção ("registre na observação de cada linha"). Foi um desvio silencioso, documentado só em texto. | `sec(... "Percentil, repetições, intrusões e clusters: registre na observação de cada linha.")` |
| C3 | **Opções genéricas reaproveitadas** (`CLASSE_PADRAO`, `CLASSE_6`) com rótulos curtos. O PDF imprime a faixa junto de cada classe ("Pontuação-padrão < 70 – muito baixa", "entre 70 e 84 – baixa"…). A faixa se perdeu. | `CLASSE_PADRAO` |
| C4 | **Tabelas de síntese achatadas.** O PDF tem 4 colunas (Instrumento, Aplicação, Áreas avaliadas, Conclusão). Juntei instrumento e área num só texto e descartei "Aplicação". Além disso, copiei "Não avaliado" da *síntese completa* (que tem 3 opções no PDF) para as sínteses por área (que têm só Sim/Não). | `SIM_NAO_NAV` usado em `sintese_instrumentos` |
| C5 | **Sumário inferido e nunca confirmado.** O próprio código diz "Inferidos (CONFIRMAR COM A DRA.): fono_sintese". A clínica confirmou agora: o sumário é o item 4 (Plano terapêutico). | `ESPECIALIDADE_SUMARIOS` |
| C6 | **Campos que não existem no PDF.** "Conclusão da anamnese" foi criado por mim; e o construtor `def()` injeta uma seção "Observações" em **todo** formulário por convenção de interface, sem checar se a fonte tem. | `sec("conclusao", …)` e `def()` |
| C7 | **Nenhum teste comparava o catálogo com o PDF.** Os testes só verificavam que o formulário abre e salva. Os avisos `pendenciasDeValidacao` existiam, mas nada bloqueava. | `especialidades-catalog.test.ts` |

**Medidas:** (a) ampliar o motor (vários números por linha, coluna informativa, legenda); (b) um teste de conformidade com o PDF para a fono, com os requisitos extraídos do PDF, que falha se alguém reduzir de novo a tabela; (c) proibir "registre na observação" como solução de lacuna do motor: a lacuna se corrige no motor.

## Especificações por item

Formato: **Sintoma → Fonte (PDF) → Causa → Correção → Aceite (testável)**.

### F1 — TNI: pontuação bruta e pontuação-padrão (imagem 1)
- **Sintoma:** só aparecem os 5 botões "Muito baixa … Muito alta".
- **PDF (p. 6):** "Resultados do TNI": *Pontuação bruta __/60*; *Pontuação-padrão de acordo com idade* com 5 opções **com a faixa**: `< 70 – muito baixa`, `entre 70 e 84 – baixa`, `entre 85 e 114 – média`, `entre 115 e 129 – alta`, `> ou + 130 – muito alta`. Abaixo, quando baixa/muito baixa: 5 marcações (fala sobre a figura mas dá o nome errado; erros semânticos; visuais; fonológicos; não conhece a maior parte das figuras; beneficia-se de pista fonológica).
- **Causa:** C3.
- **Correção:** opções com a faixa impressa; grupo rotulado "Pontuação-padrão de acordo com idade"; lista de marcações com os textos do PDF (incluindo a que faltava: "fala sobre a figura, mas dá o nome errado").
- **Aceite:** o formulário mostra "Pontuação bruta (__/60)" e as 5 opções com as faixas do PDF; as 6 marcações existem; os valores salvos antes (`muito_baixa`…) continuam válidos.

### F2 — FV: Fluência verbal (imagem 2)
- **PDF (p. 6):** por linha (Evocação lexical livre; Palavras começando com /p/; Palavras referentes a roupas/vestimentas): *Nº de palavras, Percentil, Repetições, Intrusões, Clusters* + interpretação (superior, médio superior, médio, médio inferior, alerta para déficit, déficit). Não há "observação".
- **Causa:** C1 + C2.
- **Correção:** 5 campos numéricos por linha + as 6 classes; sem campo de observação.
- **Aceite:** cada linha tem os 5 números e as 6 classes; `n` (Nº de palavras) antigo continua válido.

### F3 — TRPP (imagem 3)
- **PDF (p. 7):** colunas *Tarefas | Pontuação bruta (___/10, ___/10, ___/20) | Pontuação-padrão e interpretação* com as 5 faixas.
- **Causa:** C3 (e a ordem das colunas).
- **Correção:** pontuação bruta primeiro, com "/10", "/10", "/20"; depois as 5 opções com faixa.
- **Aceite:** ordem e rótulos como no PDF.

### F4 — TDF (imagem 4)
- **PDF (p. 7):** *Pontuação bruta ___/23* e *Pontuação-padrão de acordo com idade* com as 5 faixas.
- **Causa:** C3.
- **Correção:** igual ao F1 (campo "/23" e opções com faixa). O mesmo ajuste de faixas vale para o total do TCFPO, que usa as mesmas 5 faixas no PDF.
- **Aceite:** rótulos e faixas como no PDF.

### F5 — Síntese da linguagem oral sem "Não avaliado" (imagem 5)
- **PDF (p. 8):** só **sim / não** (a tabela de 3 opções com "Não avaliado" é a *Síntese da avaliação fonoaudiológica completa*, outra tabela).
- **Causa:** C4.
- **Correção:** `Sim`/`Não` na síntese por instrumento da linguagem oral. A opção `nao_avaliado` é tratada como "em branco" nos rascunhos antigos (não bloqueia o salvamento).
- **Aceite:** só duas opções; rascunho antigo com "Não avaliado" salva sem erro e aparece em branco.

### F6 — Sumário é o item 4 (imagem 6)
- **Sintoma:** "2.9 · Síntese da avaliação fonoaudiológica completa — Sumário: este vai ao médico".
- **Causa:** C5.
- **Correção:** o sumário da fonoaudiologia passa a ser **`fono_plano_terapeutico` (item 4)**; a síntese 2.9 deixa de ser sumário.
- **Aceite:** o selo "este vai ao médico" aparece no item 4; a síntese 2.9 fica só com a fonoaudióloga; concluir o item 4 libera o sumário ao médico.
- **Atenção:** quem concluiu a síntese 2.9 como sumário antes deixa de ter sumário até concluir o item 4 (aviso na tela).

### F7 — TDE II: legenda conforme o PDF (imagem 7)
- **PDF (p. 9):** colunas *Resultados | Percentis | Classificação (1–9)* e a **Legenda: classificação** com as faixas de percentil (1. `< ou = %` – déficit muito grave; 2. entre 1 e 5 – déficit grave; 3. entre 6 e 9 – déficit de leve a moderado; 4. entre 10 e 25 – alerta para déficit (abaixo do esperado); 5. 26 a 40 – médio-inferior; 6. 41 a 59 – médio; 7. 60 a 74 – médio-superior; 8. 75 a 94 – acima do esperado; 9. 95 a 99 – muito acima do esperado).
- **Causa:** C1/C3 (legenda reduzida a nomes, sem faixas).
- **Correção:** botões 1–9 + legenda impressa com as faixas, **literal do PDF**.
- **Pergunta à clínica:** o item 1 da legenda está incompleto no próprio PDF (`< ou = %`, sem número). Foi reproduzido literalmente; precisa do valor correto.
- **Aceite:** a legenda aparece abaixo da tabela com os 9 itens e as faixas.

### F8 — DNE: campo de percentil (imagem 8)
- **PDF (p. 10):** *Tempo de leitura* e *Velocidade* com **Tempo em segundos, Percentil, Classificação**; os 6 itens de resultado (reconto parcial/integral, compreensão) com **Pontuação e Percentil** + classificação de 6 níveis.
- **Causa:** C1/C2.
- **Correção:** campo Percentil (e Tempo em segundos) em cada linha; sem observação. O mesmo defeito existia no DNO e no ADL (Escore bruto / Escore padrão): corrigidos junto.
- **Aceite:** todas as linhas do DNE, DNO e ADL têm os campos do PDF.

### F9 — Coluna "Aplicação" nas sínteses (imagem 9)
- **PDF (p. 8, 11 e 14):** *Instrumento/Teste | Aplicação | Áreas avaliadas | Conclusão (Déficit)* nas sínteses de linguagem oral, linguagem escrita e fala.
- **Causa:** C4.
- **Correção:** cada linha mostra Instrumento, **Aplicação** e Áreas avaliadas (texto do PDF) e a conclusão Sim/Não.
- **Aceite:** as três sínteses têm a coluna, com os textos do PDF.

### F10 — Campos que não existem no PDF (imagem 10)
- **Sintoma:** na Anamnese aparecem "Conclusão da anamnese" e "Observações".
- **Causa:** C6.
- **Correção:** removidos da Anamnese fonoaudiológica. Dados antigos nesses campos são ignorados ao salvar (não bloqueiam).
- **Aceite:** a Anamnese tem só os blocos do PDF (Audição, Alimentação, Linguagem oral, Comunicação, Escolaridade, Linguagem escrita, Tratamentos, Família).
- **Em aberto (mostrar à clínica):** outros campos da fono que também não estão no PDF e foram mantidos até a validação: "Observações" dos demais formulários da fono, "Resultado informado" e "Anotações" do SRS-2.

### F11 — Erros de produção (console)
**a) `GET /api/me/professional-consent` → 500.**
- **Causa:** a tabela `professional_term_status` (migração 0029) não existia no banco de produção: `42P01 relation does not exist`.
- **Correção:** migração aplicada no Neon (conferida: tabela, RLS e 4 aceites anteriores preservados) **e** o código não dá mais 500 quando a tabela falta ([REG-006]).

**b) `POST …/attachments` → 502 e 503 (laudos).**
- **Causa:** (1) o envio em JSON/base64 derrubava a API por falta de memória (`oomKilled`, limite 512 Mi) → 502; (2) a coluna `clinical_attachments.content` (migração 0028) não existia → 503.
- **Correção:** envio binário (já em produção) + migração 0028 aplicada hoje.
- **Sobre trocar o destino (Supabase → Render, Databricks, MongoDB/vetor):** não recomendado agora.

| Opção | Prós | Contras |
|---|---|---|
| **PostgreSQL (atual)** | mesmo banco, mesma RLS, mesma auditoria e backup; nenhum fornecedor novo; sem chave extra | cresce o banco (limite 10 MB por arquivo) |
| Supabase Storage | pensado para arquivos | endereço configurado não existe (DNS) |
| Disco da Render | simples | preso a uma instância, sem RLS por município, sem backup do banco |
| MongoDB Atlas / Databricks / vetor | busca semântica | **novo operador de dados de saúde de menores** (LGPD: contrato, DPA, mapeamento), nova credencial, sincronização com o Postgres; indexar laudos com IA é risco e está fora do escopo do demo |
| Armazenamento de objetos (S3/R2) | escala para muitos arquivos | só vale a pena depois de ~alguns GB |

Revisar a escolha quando o volume de laudos passar de alguns GB ou se a busca em laudos virar requisito aprovado.

**c) Grafana: logs e aba Saúde.**
- **Métricas:** chegam (o processo da API iniciado há minutos aparece no Grafana).
- **Logs:** o Loki está vazio porque **nada envia logs**: a API só empurra métricas (OTLP). A Render não encaminha logs ao Grafana por conta própria.
- **Aba Saúde:** o aviso "histórico não ligado" significa que a API não achou `GRAFANA_PROM_URL`, `GRAFANA_PROM_USER` ou `GRAFANA_PROM_TOKEN` no serviço **periscopio-api** (ou a URL não começa com `https://`). A tela agora diz exatamente qual falta.
- **Para ter logs no Grafana:** (1) enviar logs de aviso/erro pela API via OTLP (precisa de token com permissão `logs:write`), ou (2) Log Stream da Render para um coletor (Alloy) hospedado. A opção 1 é a mais simples e não adiciona infraestrutura.

## Teste de conformidade com o PDF
`apps/api/src/services/fono-conformidade-pdf.test.ts` guarda os requisitos acima (colunas, rótulos, faixas, opções) por instrumento. Uma mudança futura que simplifique uma tabela do PDF quebra a CI.
