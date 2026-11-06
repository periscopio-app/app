# Catálogo de regressão

> Gerado por `pnpm qa:catalogo` a partir dos testes. **Não edite à mão.** A CI confere se está atualizado.

O que o sistema já garante, sem ninguém precisar repetir à mão: **653 casos de teste automáticos** em 96 arquivos. Quem mexe em algo listado aqui e quebra a garantia vê a CI ficar vermelha.

## Bugs que já aconteceram (testes `[REG-…]`)

| Código | O que fica garantido | Teste |
|---|---|---|
| REG-001a | sem responder os comportamentos, o envio é recusado listando os 15 itens | `apps/api/src/e2e/re-envio-pela-tela.e2e.test.ts` |
| REG-001b | comportamentos salvam pela rota da tela, voltam na leitura e item em branco não vira "Não" | `apps/api/src/e2e/re-envio-pela-tela.e2e.test.ts` |
| REG-001c | a rota recusa comportamento inexistente, valor inválido, perfil sem permissão e outro município | `apps/api/src/e2e/re-envio-pela-tela.e2e.test.ts` |
| REG-001d | RE completa a jornada SÓ pelas rotas da tela e envia ao médico | `apps/api/src/e2e/re-envio-pela-tela.e2e.test.ts` |
| REG-001e | depois do envio os comportamentos ficam em somente leitura (409) | `apps/api/src/e2e/re-envio-pela-tela.e2e.test.ts` |
| REG-002 | com o Supabase fora do ar o laudo salva e abre normalmente (laudo é opcional e não depende dele) | `apps/api/src/e2e/attachments.e2e.test.ts` |
| REG-002 | laudo antigo (sem conteúdo no banco) ainda abre do bucket; se o bucket cair, 503 só nele | `apps/api/src/e2e/attachments.e2e.test.ts` |
| REG-003a | sem aceite (false) o perfil clínico é barrado no servidor, mas pode ler e aceitar o termo | `apps/api/src/e2e/termo-profissional.e2e.test.ts` |
| REG-003b | aceitar sem marcar a caixa é recusado e não grava nada | `apps/api/src/e2e/termo-profissional.e2e.test.ts` |
| REG-003c | com a caixa marcada grava prova, estado true e auditoria, e libera o uso | `apps/api/src/e2e/termo-profissional.e2e.test.ts` |
| REG-003d | um aceite por conta: repetir não duplica prova nem auditoria | `apps/api/src/e2e/termo-profissional.e2e.test.ts` |
| REG-003e | Admin Master (ator virtual, sem linha em users) consegue aceitar e não vê mais a janela | `apps/api/src/e2e/termo-profissional.e2e.test.ts` |
| REG-003f | a auditoria de qualquer ação do Admin Master é gravada (antes a chave estrangeira derrubava o registro) | `apps/api/src/e2e/termo-profissional.e2e.test.ts` |
| REG-003g | termo desatualizado na tela é recusado (409) e nada é gravado | `apps/api/src/e2e/termo-profissional.e2e.test.ts` |
| REG-005 | RE e médico guardam no mesmo lugar: pasta da escola e uuid do aluno, nome do arquivo fora do caminho | `apps/api/src/e2e/attachments.e2e.test.ts` |
| REG-006 | com a migração 0029 pendente (tabela ausente) não há 500 nem bloqueio: avisa e libera; aceitar responde 503 claro | `apps/api/src/e2e/termo-profissional.e2e.test.ts` |
| REG-008 | gravar laudo grande que FALHA não infla a memória: o erro é curto e sem o arquivo (o Drizzle põe os parâmetros na mensagem) | `apps/api/src/e2e/attachments.e2e.test.ts` |
| REG-009a | sem aceitar o termo o especialista é barrado com o motivo certo; a janela do termo continua acessível | `apps/api/src/e2e/rotas-e-termo.e2e.test.ts` |
| REG-009b | depois de aceitar, cada especialista puxa o encaminhamento que o médico fez para ele | `apps/api/src/e2e/rotas-e-termo.e2e.test.ts` |
| REG-009c | a fono salva, o status deixa de ser 'não iniciado' e a Conduta aparece como item próprio | `apps/api/src/e2e/rotas-e-termo.e2e.test.ts` |
| REG-009d | o médico troca o profissional de uma seção pendente: a neuropsicóloga passa a ver a dela | `apps/api/src/e2e/rotas-e-termo.e2e.test.ts` |
| REG-009e | não troca quando o profissional já começou (nada é perdido) nem quando a seção não está pendente | `apps/api/src/e2e/rotas-e-termo.e2e.test.ts` |
| REG-009f | varredura: nenhuma rota GET responde 5xx para médico, RE, especialista nem Admin Master | `apps/api/src/e2e/rotas-e-termo.e2e.test.ts` |
| REG-010 | gravar auditoria como Admin Master (ator virtual) não derruba nada, nem dentro de transação | `apps/api/src/e2e/rotas-e-termo.e2e.test.ts` |
| REG-012 | o mapa técnico do sistema é só do Admin Master: sem login 401, demais perfis 403, Master 200 | `apps/api/src/e2e/rotas-e-termo.e2e.test.ts` |

## API — unitários — 388

<details><summary><code>apps/api/src/auth/access-link.test.ts</code> — 5</summary>

- token válido devolve e-mail em minúsculas e a impressão digital
- token expirado é recusado
- token adulterado ou malformado é recusado
- segredo diferente invalida o token
- em produção sem segredo configurado o link não é gerado (falha fechada)

</details>

<details><summary><code>apps/api/src/auth/secret.test.ts</code> — 6 · assertAuthSecret</summary>

- falha em produção sem segredo
- falha quando NODE_ENV não está definido e não há segredo
- falha em produção com o valor de desenvolvimento
- falha em produção com segredo curto
- aceita segredo longo em produção, inclusive via AUTH_SECRET
- usa o valor de desenvolvimento só em development e test

</details>

<details><summary><code>apps/api/src/email/index.test.ts</code> — 1</summary>

- does not initialize Resend when the API key is absent

</details>

<details><summary><code>apps/api/src/email/templates.test.ts</code> — 2</summary>

- e-mail de confirmação usa identidade do projeto e escapa o nome
- convite do profissional cita escola e especialidade e escapa HTML

</details>

<details><summary><code>apps/api/src/observability/ai-usage.test.ts</code> — 2 · recordAiUsageFromReply</summary>

- soma o uso devolvido pelo serviço de IA
- ignora resposta antiga, campo inválido ou valor estranho sem lançar erro

</details>

<details><summary><code>apps/api/src/observability/error-cause.test.ts</code> — 2 · errorCauseChain</summary>

- expõe o erro do Postgres escondido em cause, sem parâmetros nem stack
- segue a cadeia até 3 níveis e ignora erro sem cause

</details>

<details><summary><code>apps/api/src/observability/metrics-auth.test.ts</code> — 4 · metricsTokenOk</summary>

- aceita o token certo, com ou sem o prefixo Bearer
- tolera espaço e quebra de linha no valor guardado e no enviado
- recusa token errado, vazio ou ausente
- variável vazia ou só com espaços desliga a rota e nunca autoriza

</details>

<details><summary><code>apps/api/src/observability/metrics.test.ts</code> — 9</summary>

- percentis saem do histograma e erros 5xx entram na taxa
- lista de erros recentes tem teto e guarda a mais nova primeiro
- formato Prometheus traz requisições, latência e eventos
- formato Prometheus traz memória, CPU e atraso do event loop, sem labels
- o log não leva a query string (token de acesso) e o request id é validado
- limite por janela: bloqueia depois do teto e libera quando a janela passa
- a saída do Prometheus traz a versão em execução e o início do processo
- uso de IA soma tokens e chamadas por recurso, provedor e modelo, sem texto
- rótulos de IA são limpos e o número de combinações tem teto

</details>

<details><summary><code>apps/api/src/observability/otlp-push.test.ts</code> — 11 · resolveOtlpConfig</summary>

- fica desligado se faltar qualquer variável
- recusa endereço que não seja https
- monta /v1/metrics uma única vez, com ou sem o sufixo no valor
- lê endereço e cabeçalho Authorization
- aceita o espaço codificado como %20 e outros cabeçalhos na lista
- fica desligado sem Authorization ou sem endereço, ou fora de https
- o endereço específico de métricas é usado como está
- sem configuração não chama a rede
- envia JSON com autenticação básica e registra o sucesso
- credencial recusada e falha de rede viram estado, sem lançar nem vazar o token
- sem configuração devolve um desligador vazio e não agenda nada

</details>

<details><summary><code>apps/api/src/observability/otlp.test.ts</code> — 7 · buildOtlpPayload</summary>

- usa os nomes que o painel consulta, sem sufixos de unidade
- separa contadores por classe de status e leva a versão como rótulo
- converte o histograma de cumulativo para contagem por faixa e usa inteiros como texto
- sem tráfego não emite séries vazias de requisições
- não coloca dado pessoal nem segredo: só rotas-padrão, método, classe e nome de evento
- leva o uso de IA como contadores de tokens e de chamadas, sem texto
- sem uso de IA não emite as séries de IA

</details>

<details><summary><code>apps/api/src/routes/auth-session.test.ts</code> — 3</summary>

- validação de sessão: nega acesso sem credenciais/cookie de sessão
- garante que escopo do ator vem estritamente do banco de dados
- validação de convite: rejeita token expirado ou já utilizado

</details>

<details><summary><code>apps/api/src/routes/identity-vault-enhancement.test.ts</code> — 3</summary>

- Identity Vault Route: GET /api/students/:studentId/vault/status requer autenticação
- Identity Vault Route: GET /api/students/:studentId/vault/status retorna 404 para aluno inexistente
- Identity Vault Route: GET /api/admin/vault/audit-logs protege auditoria contra não-admins

</details>

<details><summary><code>apps/api/src/routes/intersectoral.test.ts</code> — 5</summary>

- Rede Intersetorial: recusa requisições sem autenticação (401)
- Rede Intersetorial: recusa requisições com perfil não autorizado (403)
- Rede Intersetorial: GET /api/intersectoral/monitoring/sla-90d calcula conformidade do prazo legal
- Rede Intersetorial: POST /api/intersectoral/referrals cria encaminhamento para CRAS/CAPS/UBS
- Rede Intersetorial: PATCH /api/intersectoral/referrals/:id/status atualiza acolhimento com contrarreferência

</details>

<details><summary><code>apps/api/src/routes/lgpd-consent.test.ts</code> — 4</summary>

- LGPD Route: POST /api/lgpd/requests aceita solicitação de titular válida
- LGPD Route: POST /api/lgpd/requests rejeita tipo de requisição inválido
- LGPD Route: GET /api/lgpd/retention/policies expõe matriz de retenção conforme legislação
- Consent Route: GET /api/consent/terms/latest retorna termo de consentimento com versão

</details>

<details><summary><code>apps/api/src/routes/locations.test.ts</code> — 3</summary>

- GET /api/locations/states retorna os 27 estados do Brasil a partir de cidade.json
- GET /api/locations/cities/SP retorna as cidades de São Paulo incluindo Tarumã
- GET /api/locations/cities?uf=PR retorna as cidades do Paraná

</details>

<details><summary><code>apps/api/src/routes/newsletter.routes.test.ts</code> — 5</summary>

- Newsletter Route: POST /api/newsletter/subscribe inscreve novo leitor
- Newsletter Route: POST /api/newsletter/unsubscribe realiza opt-out LGPD
- Newsletter Route: POST /api/newsletter/subscribe rejeita e-mail inválido
- Newsletter Route: GET /api/newsletter/issues retorna boletins publicados
- Newsletter Route: POST /api/admin/newsletter/issues cria nova edição para admin

</details>

<details><summary><code>apps/api/src/routes/rnds.test.ts</code> — 3</summary>

- RNDS Route: GET /api/rnds/status identifica o gerador como protótipo sem integração configurada
- RNDS Route: POST /api/rnds/rel/bundle gera Bundle FHIR experimental com encaminhamento
- RNDS Bundle: narrativa XHTML escapa conteúdo fornecido pelo cliente

</details>

<details><summary><code>apps/api/src/routes/schools-onboarding.test.ts</code> — 3</summary>

- validação de escola: rejeita slug duplicada ou malformada
- fluxo de convite: gera token seguro de 64 caracteres hexadecimais com expiração de 7 dias
- ativação de escola: atualiza status para 'active' após onboarding concluído

</details>

<details><summary><code>apps/api/src/routes/support.routes.test.ts</code> — 6</summary>

- Support Route: GET /api/support/faq retorna catálogo de perguntas frequentes
- Support Route: POST /api/support/tickets registra dúvida de usuário
- Support Route: POST /api/support/tickets registra incidente técnico com telemetria
- Support Route: POST /api/support/tickets rejeita chamado curto ou inválido
- Support Route: GET e PATCH /api/admin/support/tickets gerencia chamados para admin
- Support Route: POST /api/support/ask-rag responde dúvidas com inteligência semântica

</details>

<details><summary><code>apps/api/src/routes/swagger.test.ts</code> — 2</summary>

- Swagger / Docs Route: GET /docs retorna a interface do Swagger UI
- Swagger / Docs Route: GET /docs/json retorna especificação OpenAPI válida

</details>

<details><summary><code>apps/api/src/routes/viacep.test.ts</code> — 9</summary>

- CEP: rejeita formato incorreto sem consultar ninguém
- CEP: usa a BrasilAPI primeiro e normaliza o formato
- CEP: cai para o ViaCEP quando a BrasilAPI está fora (5xx)
- CEP: cai para o OpenCEP quando BrasilAPI e ViaCEP falham (rede e 429)
- CEP: 404 da BrasilAPI é definitivo e não consulta os demais
- CEP: erro:true do ViaCEP vira 404
- CEP: todos os provedores fora devolve 502 com mensagem genérica
- CEP: resposta inválida de um provedor passa para o próximo
- CEP: segunda consulta do mesmo CEP vem do cache

</details>

<details><summary><code>apps/api/src/security/actor.test.ts</code> — 2</summary>

- permite um papel explicitamente autorizado
- nega um papel fora da lista autorizada

</details>

<details><summary><code>apps/api/src/security/capabilities.test.ts</code> — 9 · catálogo de capacidades</summary>

- chaves únicas, rótulo e descrição preenchidos
- apelidos de perfil viram o perfil canônico
- padrões espelham a matriz do PM (09/out/2026)
- padrões continuam iguais às listas fixas que existiam antes
- TEA: cada instrumento tem seu preenchedor padrão e a faixa de referência nasce desligada
- padrão quando ninguém configurou
- regra do perfil vence o padrão; a da pessoa vence a do perfil
- capacidade travada: só o Admin Master, e nenhuma caixinha muda isso
- capacidade por especialidade respeita a exceção do Admin para qualquer especialista

</details>

<details><summary><code>apps/api/src/security/security-denial.test.ts</code> — 4</summary>

- garante que admin e gestores NUNCA possuem acesso a papéis clínicos
- board e ADM são gestão: não têm papel clínico nem de seção do núcleo
- garante que apenas profissionais clínicos possuem papéis clínicos autorizados
- validação de papéis válidos e inválidos no sistema

</details>

<details><summary><code>apps/api/src/security/tenancy.test.ts</code> — 3</summary>

- bloqueia outro município
- bloqueia outra escola para um perfil escolar
- permite a escola vinculada ao ator

</details>

<details><summary><code>apps/api/src/services/attachment.test.ts</code> — 3</summary>

- anexos clínicos: gera chave de armazenamento opaca sem nome/PII do paciente
- anexos clínicos: rejeita arquivos que excedem 10MB ou com formato inválido
- download seguro: gera URL assinada temporária (600s) e nega acesso a perfis administrativos

</details>

<details><summary><code>apps/api/src/services/avatar.service.test.ts</code> — 8 · Foto de perfil: validação</summary>

- detecta JPEG, PNG e WEBP pelos bytes, não pelo que o navegador diz
- JPEG: remove EXIF/GPS e mantém a imagem
- PNG: remove blocos de texto e mantém os de imagem
- WEBP com EXIF ou XMP é recusado; limpo passa
- validarFoto aceita com ou sem prefixo data URL e devolve bytes limpos
- validarFoto recusa vazio, texto, SVG, PDF, arquivo corrompido e WEBP com metadados
- validarFoto recusa arquivo acima de 2 MB com 413
- chave do objeto é opaca e só o dono pode removê-la

</details>

<details><summary><code>apps/api/src/services/bi-seed.test.ts</code> — 2</summary>

- o seed do repositório é válido contra a camada semântica
- recusa plano incoerente, id de escola, dado pessoal e pergunta repetida

</details>

<details><summary><code>apps/api/src/services/bi-semantic.test.ts</code> — 8</summary>

- contagem oculta grupos de 1 a 4 e não informa total
- sem células pequenas o total é informado
- filtro por escola respeita o escopo e recalcula a supressão
- tempo médio exige ao menos 5 casos
- valor já suprimido na origem continua oculto e impede total
- plano inválido é recusado
- plano não aceita campos individuais nem SQL
- higienização remove documento, e-mail e telefone da pergunta

</details>

<details><summary><code>apps/api/src/services/clinical-workflow.test.ts</code> — 3</summary>

- formulário versionado: cria retificação aditiva preservando a versão original imutável
- delegação multiprofissional: impede edição de seção atribuída a outro especialista
- agendamento de reuniões/Meet: bloqueia choque de horários e gera link sem PII da criança

</details>

<details><summary><code>apps/api/src/services/consent-cpf.test.ts</code> — 4 · TCLE: CPF com máscara e validação</summary>

- CPF válido (dígitos ou com máscara) vira 000.000.000-00
- CPF com dígito verificador errado, repetido ou incompleto é recusado
- CPF em branco é aceito (opcional)
- exige nome completo e parentesco da lista

</details>

<details><summary><code>apps/api/src/services/delivery-phase.test.ts</code> — 3</summary>

- bi municipal (Task 13): aplica supressão de células pequenas (&lt;5) e oculta prevalência para evitar inferência
- e2e e acessibilidade (Task 14): valida presença de meta tags e suporte a navegação por teclado
- deploy do piloto (Task 15): valida configuração de produção sem exposição de chaves privadas

</details>

<details><summary><code>apps/api/src/services/especialidades-catalog.test.ts</code> — 24 · catálogo das especialidades</summary>

- toda especialidade delegável com formulário tem pelo menos um
- ids de formulário são únicos por especialidade e cabem na coluna
- chaves dos campos são únicas dentro de cada formulário
- nenhum campo pede nome, endereço, telefone, CPF ou e-mail
- opções de uma mesma pergunta têm valores únicos
- todo formulário declara de onde vieram as lacunas (cadastro e nomes omitidos)
- instrumentos sem licença confirmada guardam só o resultado
- SRS-2 licenciado reproduz os 65 itens, com quatro respostas e sem cálculo
- plano terapêutico fono preserva o item 4 do capítulo
- o sistema não calcula: nenhum campo guarda total, escore ou classe calculados
- o ponto de corte do SCARED não aparece em nenhum texto do formulário
- payload vazio é válido (em branco continua em branco)
- em branco não vira 'não'
- rejeita campo desconhecido e opção fora do catálogo
- número da tabela precisa ser finito e dentro do limite
- datas: AAAA-MM-DD ou em branco
- texto longo demais é recusado
- genograma do serviço social usa o mesmo campo do médico
- formDaEspecialidade não devolve formulário de outra especialidade
- agrupa por resposta, na ordem das opções, sem somar nem classificar
- em branco não aparece como resposta e o andamento conta só o respondido
- número digitado aparece como veio, sem conversão
- toda especialidade tem ao menos um sumário e ele existe no catálogo dela
- só o sumário sai; anamnese, instrumentos e plano terapêutico ficam com o profissional

</details>

<details><summary><code>apps/api/src/services/evaluation-guard.test.ts</code> — 3</summary>

- aceita entrada válida e ignora qualquer score enviado
- rejeita studentId que não é uuid, escala desconhecida e payload inválido
- rejeita payload grande demais

</details>

<details><summary><code>apps/api/src/services/expert-meeting-guard.test.ts</code> — 6</summary>

- aceita pedido válido
- rejeita CPF, telefone e e-mail no assunto
- rejeita assunto curto/longo e slot inválido
- valida URL do Meet
- valida intervalo do slot
- escapa HTML nas variáveis de template

</details>

<details><summary><code>apps/api/src/services/factory-reset.service.test.ts</code> — 4 · wipeInTransaction</summary>

- desliga e religa os gatilhos append-only no caminho de sucesso
- propaga o erro original e não emite ENABLE quando um DELETE falha
- inclui linhas de outro tenant que apontam para casos e alunos do demo, sem tocar Tarumã
- cases e students são apagados só por tenant

</details>

<details><summary><code>apps/api/src/services/fogap-defensive.test.ts</code> — 1</summary>

- prontoParaRevisao não derruba o servidor com payload sem objetos internos

</details>

<details><summary><code>apps/api/src/services/fogap-envio.test.ts</code> — 2</summary>

- FOGAP com itens em branco pode ser enviado (avisos, sem bloqueio)
- sem idade/grupo ou fora do piloto bloqueia o envio

</details>

<details><summary><code>apps/api/src/services/fogap-faixas.test.ts</code> — 6</summary>

- faixa 4 a 5 anos tem 20 itens (75 a 94) e a de 6 a 9 tem 15 (95 a 109), sem repetir id
- textos de itens sensíveis a aspas e fonemas ficam como na fonte
- roteamento: 4a0m a 5a11m entram (G2); 3 anos e menos ficam fora; 6 a 9 seguem em G3
- faixa padrão pela idade e escolha manual da RE
- envio conta em branco só dos itens da faixa em uso (19 em branco de 20)
- validação recusa faixa fora de 4a5 e 6a9

</details>

<details><summary><code>apps/api/src/services/fogap-formulario-i.test.ts</code> — 3</summary>

- registros antigos ganham os campos do Formulário I vazios
- data futura no encaminhamento é aceita (agendamento); formato inválido continua recusado
- datas dos destinos do Formulário I podem ser futuras; formato e textos têm limite

</details>

<details><summary><code>apps/api/src/services/fono-conformidade-pdf.test.ts</code> — 20 · [REG-007] fonoaudiologia conforme o PDF — linguagem oral</summary>

- F1 TNI: pontuação bruta /60, pontuação-padrão com as faixas do PDF e as 6 marcações
- F2 FV: nº de palavras, percentil, repetições, intrusões e clusters + as 6 classes, sem observação
- F3 TRPP: pontuação bruta antes, com /10, /10 e /20, e as 5 faixas de pontuação-padrão
- F4 TDF e total do TCFPO: bruta /23 e pontuação-padrão com as faixas
- F8 ADL e DNO: escore bruto/padrão e pontuação/percentil como no PDF
- F5/F9 síntese da linguagem oral: só Sim/Não, com Aplicação e Áreas avaliadas em cada instrumento
- F5 rascunho antigo com 'Não avaliado' continua salvando e a resposta vira branco
- F7 TDE II: resultados + percentis, classificação 1 a 9 e a legenda do PDF (literal)
- F8 DNE: tempo em segundos e percentil; pontuação e percentil; sem observação
- F9 sínteses da escrita e da fala têm a coluna Aplicação e Sim/Não
- F10 anamnese: sem 'Conclusão da anamnese' e sem 'Observações'; dados antigos não bloqueiam
- F6 o sumário que vai ao médico é o item 4 (plano terapêutico), não a síntese 2.9
- a Conduta é um formulário próprio, entre o SRS-2 (3) e o plano terapêutico (4)
- as 4 áreas do PDF, com o texto literal, e Conclusão/Conduta ao final
- a síntese 2.9 não carrega mais a conduta; dados antigos dela não bloqueiam o salvamento
- não é sumário: só o plano terapêutico (item 4) vai ao médico
- o número antigo (n) e os novos (nums) são aceitos e mostrados com o rótulo
- dados salvos antes (resposta + n + observação) continuam válidos
- número não previsto, valor inválido ou fora do limite são recusados
- uma linha só com percentil já conta como respondida (em branco continua em branco)

</details>

<details><summary><code>apps/api/src/services/full-system-e2e-simulation.test.ts</code> — 7</summary>

- SIMULAÇÃO E2E DE PONTA A PONTA: Validação completa do ciclo de vida do paciente e governança
- Etapa 1: Registro e geração de código pseudonimizado sem PII
- Etapa 2: Submissão do FOGAP versionado e transição para Revisão Médica
- Etapa 3: Delegação multiprofissional e exigência deontológica de 100 caracteres
- Etapa 4: Descriptografia controlada do Cofre de Identidade e bloqueio de papéis administrativos
- Etapa 5: Reserva atômica de slots do Board e geração de sala virtual segura
- Etapa 6: Resposta inteligente RAG e registro de chamado com stack e telemetria

</details>

<details><summary><code>apps/api/src/services/genograma.test.ts</code> — 11</summary>

- normalizar: descarta o desconhecido, o repetido que deve ser único e o que ficou sem ligação
- normalizar: entrada inválida vira genograma vazio; ids repetidos ganham novo id
- limite de figuras
- disponibilidade: avós e tios dependem de quem liga
- remover a mãe retira avós e tios maternos e mantém o lado paterno
- pais separados só vale com mãe e pai no desenho
- documento da biblioteca: união dos pais, filhos ligados à união e nenhum nome
- só a mãe: o aluno e o irmão ligam a ela, sem união
- serialização: sem figuras é campo em branco; texto inválido é ignorado
- formulário do médico: estrutura do genograma é normalizada e conta como conteúdo
- RE: o genograma saiu do fluxo (só o médico desenha); o Form C não tem mais o campo

</details>

<details><summary><code>apps/api/src/services/grafana.service.test.ts</code> — 19 · fetchGrafanaSeries</summary>

- sem configuração devolve configured=false e não chama o Grafana
- recusa URL que não seja https
- monta query_range com a consulta da lista, autenticação básica e passo do período
- token recusado vira erro claro, sem vazar o token
- falha de rede vira erro genérico
- guarda em cache por 30 s e consulta de novo depois
- sem configuração devolve configured=false
- lista commits do mais novo ao mais antigo e marca o atual
- token recusado vira erro sem vazar o token
- aponta a variável provável conforme a causa
- uma resposta que não é JSON vira dica de endereço, não 'rede ou tempo esgotado'
- sem configuração devolve configured=false
- junta os números e ordena o uso de IA por modelo e por recurso
- os preços só aparecem se o administrador os definir
- série sem dados vira null, não zero inventado
- token recusado devolve erro sem vazar o token
- lista só os NOMES das variáveis que faltam, nunca valores
- endereço sem https:// ou inválido é apontado
- série, deploys e resumo devolvem o motivo quando não estão configurados

</details>

<details><summary><code>apps/api/src/services/identity-crypto.test.ts</code> — 2</summary>

- chave ausente ou curta falha fechada sem chave padrão
- cifra e decifra apenas com a chave configurada

</details>

<details><summary><code>apps/api/src/services/identity-vault.test.ts</code> — 4</summary>

- nega acesso ao cofre de identidade para admin e gestores
- exige motivo de acesso válido com pelo menos 5 caracteres
- bloqueia acesso quando tenant ou escola não coincidem
- permite acesso para perfil clínico autorizado e gera entrada de auditoria com eventId UUID

</details>

<details><summary><code>apps/api/src/services/legacy-import.test.ts</code> — 4</summary>

- UUID de pseudônimo não é confundido com telefone
- CPF, e-mail e telefone em texto livre continuam sendo pegos
- colunas com cara de identificador são barradas
- nenhuma rota da API lê as tabelas legacy_* (base individual só por script/DBA)

</details>

<details><summary><code>apps/api/src/services/medico-forms-catalog.test.ts</code> — 10 · formulários do médico: reproduzem o capítulo em papel</summary>

- cada seção B a R tem campos do papel; nenhum campo provisório 'registro'
- estruturas-chave do papel
- normalização por tipo: escolha, múltipla, número e texto
- hipótese diagnóstica agrupa campos CID legados sem sobrescrever o campo atual
- não há escore: nenhum campo calcula, soma ou classifica; Σ FR é digitado
- sumário executivo para o especialista: texto legível, aceita o formato antigo
- o campo é do tipo simnao e guarda 1 e 0 por item, na ordem do formulário
- Não é resposta de verdade (0) e é diferente de em branco
- dados antigos (lista de caixas marcadas) continuam valendo como Sim
- o texto para leitura mostra Sim ou Não de cada item respondido e omite o que está em branco

</details>

<details><summary><code>apps/api/src/services/onboarding-guard.test.ts</code> — 4</summary>

- aceita ausência de lista e lista válida
- rejeita e-mail, especialidade e nome inválidos
- rejeita CPF inválido ou conselho de classe ausente
- limita o tamanho do lote

</details>

<details><summary><code>apps/api/src/services/operation-phase.test.ts</code> — 2</summary>

- importação institucional (Task 11): dry-run valida formato sem inserir e rejeita planilhas contendo PII/prontuários
- kpis administrativos (Task 12): calcula agregados operacionais e taxa de SLA sem expor identificação do aluno

</details>

<details><summary><code>apps/api/src/services/pilot-indicators.service.test.ts</code> — 14</summary>

- guardCount: 1 a 4 viram oculto; zero e 5 ou mais aparecem
- guardPercent: denominador pequeno, numerador pequeno ou complemento pequeno ocultam
- guardPercent: sem denominador válido não inventa percentual
- suppressBuckets: se só uma categoria é ocultada, oculta também a menor visível
- capacitação: conclui só quem terminou todos os cursos obrigatórios
- capacitação: catálogo vazio não conta ninguém como capacitado
- rastreio: numerador é o FOGAP enviado, contando cada aluno uma vez
- acesso: taxa, espera e mediana de dias só com 5 ou mais casos
- desfecho: taxas sobre quem acessou o núcleo; abandono e interrupção tiram da adesão
- desfecho: caso encerrado sem decisão legível conta como em atendimento, nunca como alta
- estabilização: mostra variação bruta, sem dizer melhora ou piora
- pairFor: sem par completo não há variação
- latestMeasures: vale a medida mais recente por fase e origem
- visão do aluno: datas, dias até a avaliação e desfecho; sem nome nem documento

</details>

<details><summary><code>apps/api/src/services/population-planning.test.ts</code> — 4</summary>

- taxa por mil e profissionais; célula suprimida vira mínimo
- sem matrícula não calcula taxa; total suprimido é sinalizado
- capacidade inválida volta ao padrão
- lista os pontos sem informação

</details>

<details><summary><code>apps/api/src/services/profile-metrics.service.test.ts</code> — 4 · Meu painel: métricas (funções puras)</summary>

- mediana em dias só com amostra mínima de 3
- mediana em horas
- agregado da gestão oculta grupos de 1 a 4 e mostra zero e 5+
- tempo pessoal do RE: mediana por parte, referência do papel e ganho estimado

</details>

<details><summary><code>apps/api/src/services/profile.service.test.ts</code> — 5 · Meu painel: dados editáveis</summary>

- só nome, telefone e apresentação são aceitos; qualquer outro campo é recusado
- limites de tamanho
- telefone: normaliza, aceita +55, recusa inválido e apaga com vazio
- CPF aparece mascarado com só os 2 últimos dígitos
- texto vazio vira null

</details>

<details><summary><code>apps/api/src/services/psm-conformidade-pdf.test.ts</code> — 3 · [REG-011] psicomotricidade: legenda 1 a 4 de cada prova (PDF)</summary>

- ${key}: ${nGrupos} grupo(s) com os níveis 1 a 4
- Noção do corpo traz Autoimagem com os critérios do PDF (ponta do nariz)
- a legenda não vira cálculo: as opções continuam sendo só 1 a 4 marcados pelo profissional

</details>

<details><summary><code>apps/api/src/services/re-journey.test.ts</code> — 23 · jornada do RE — catálogo A–F</summary>

- a ordem dos passos é exatamente A B C D E F G H I
- o RE não desenha genograma: nenhum campo do tipo genograma no fluxo do RE (só o médico desenha)
- chaves dos campos são únicas dentro de cada formulário
- nenhum formulário pede nome do aluno nem telefone; o professor vem do cadastro da escola
- Formulários A, D e F não repetem a identificação (série e sexo ficam só no A)
- regra das opções: 3 ou mais viram múltipla com observação, exceto as exclusões documentadas
- valida opções, textos e rejeita chaves desconhecidas; em branco é aceito
- professor do Formulário B aceita {id, nome} e recusa chaves estranhas
- rascunhos antigos são aceitos: chaves de identificação saem e resposta única vira lista
- progresso conta só o que foi respondido (sem preencher padrão)
- lacunas listam o que está em branco com rótulo legível; observações finais não contam
- tudo em branco: nenhum passo bloqueado, todas as lacunas aparecem
- qualquer ordem: preencher o Formulário E sozinho não depende de A a D
- G pulado conta como decisão e sai da lista; H aguardando NÃO libera o envio (ATA é obrigatória)
- Formulário I: campos obrigatórios bloqueiam e o texto livre tem mínimo de caracteres
- retrato das escalas: ATA pontua pela regra da fonte; SNAP-IV só aparece se houver resposta e nunca conta os itens 10 a 18
- ATA enviada conclui o H
- SNAP-IV parcial lista os itens sem resposta
- Sumário I: a série vem do cadastro do aluno
- idade, grupo e série vêm do cadastro
- a série digitada pelo cliente é ignorada: vale o cadastro
- encaminhamento com data futura é aceito (agendamento)
- calcula anos e meses pelo ano/mês

</details>

<details><summary><code>apps/api/src/services/re-observability.test.ts</code> — 6 · observabilidade do RE</summary>

- mediana
- oculta células com menos de 5 casos
- com 5 ou mais casos, calcula mediana e tempo ganho
- soma sessões do mesmo passo e ignora passo desconhecido
- uso do G: considera o último registro do caso e oculta &lt;5
- TEA: sem pontuação, só andamento

</details>

<details><summary><code>apps/api/src/services/re-observacoes.test.ts</code> — 4 · sugestão de observações do RE</summary>

- o contexto não leva professor nem identificação
- sem nada preenchido, a reserva por regras avisa que não há o que resumir
- a reserva preserva o texto atual e não interpreta
- a trava rejeita termos proibidos, números inventados e identificadores

</details>

<details><summary><code>apps/api/src/services/re-registration.test.ts</code> — 3</summary>

- registro de aluno pela RE: gera código pseudonimizado sem nome e valida idade no piloto
- abertura de caso pela RE: bloqueia se a criança já possuir caso ativo no mesmo município
- observação docente: registra a procedência (ex: formulário físico/relato enviado à RE)

</details>

<details><summary><code>apps/api/src/services/specialist-view.test.ts</code> — 3</summary>

- sumário do médico em rascunho ou inexistente fica pendente e sem texto
- sumário concluído devolve campos normalizados, conduta marcada na ordem do papel e data pura
- payload inválido concluído vira texto vazio, sem quebrar

</details>

<details><summary><code>apps/api/src/services/storage-check.service.test.ts</code> — 9</summary>

- sem as variáveis do Supabase o teste para na configuração e diz o que falta
- sem a chave de serviço o teste acusa a chave
- tudo certo: link público responde 200 com a mesma imagem e depois some
- CDN ainda serve o link antigo depois de apagar: o teste confere a origem e passa
- imagem apagada que ainda responde 200 na origem continua sendo acusada
- bucket de fotos privado: o link responde 400/404 e o teste acusa
- falha no upload da foto é relatada sem derrubar o teste
- host inexistente (fetch failed + ENOTFOUND): para na rede e explica, sem tentar upload
- projeto responde 401 à chave: acusa chave de outro projeto, sem vazar a chave

</details>

<details><summary><code>apps/api/src/services/student-code.test.ts</code> — 4</summary>

- código tem formato estável e não repete
- valida ano e mês de nascimento
- faixa etária
- trava de idade do piloto: 4 anos completos até 9 anos e 11 meses

</details>

<details><summary><code>apps/api/src/services/taruma-dashboard.test.ts</code> — 5</summary>

- painel do município: KPIs fixos calculados sobre os agregados
- ranking por escola exclui 'Não se aplica' e mantém células ocultas como null
- faixa do piloto é destacada e queixas ficam ordenadas, sem valor zero
- profissionais recalculam com a capacidade editada e escola isolada não mostra ranking
- o painel não carrega campo individual algum

</details>

<details><summary><code>apps/api/src/services/tea-scoring.test.ts</code> — 18 · catálogo TEA bate com o formulário-fonte</summary>

- quantidade de itens
- numeração contínua e sem texto vazio
- ABC: pesos 1 a 4, soma dos itens = 160 (o quadro-resumo do formulário diz 159)
- ASQ: colunas de pontuação do formulário (Sim=0 nas perguntas 2, 3, 10 e 20 a 40)
- 0/1/2 por grupo, +1 se antes dos 36 meses
- vazio = 0; todos os grupos com 2+ marcas e início precoce = 45
- faixa de referência existe no cálculo mas sai quando a pessoa não tem a capacidade
- validação recusa grupo/posição inexistente ou repetida
- verbal: todas Sim = 15 (nº de perguntas em que Sim pontua); todas Não = 24
- máximo e completude seguem a resposta da pergunta 1
- sem fala: perguntas 2 a 8 não contam mesmo se respondidas
- validação
- M-CHAT não devolve pontuação de risco, só contagem neutra
- SRS-2 não soma pontos (itens invertidos desconhecidos) e valida a escala 1 a 4
- soma pesos marcados, total e por área
- tudo marcado = 160; nada marcado = 0
- o resultado nunca traz rótulo de classificação
- scoreTea valida antes de pontuar

</details>

<details><summary><code>apps/api/src/storage/config.test.ts</code> — 7 · resolveSupabaseUrl</summary>

- devolve null sem configuração
- monta a URL a partir do project ref
- remove barra final e sufixos copiados do painel
- recusa valor que não é endereço http(s)
- acha o código em cause e em originalError
- trata 'fetch failed' sem código como falha de rede
- descreve a causa sem expor endereço nem chave

</details>

## Contrato tela ↔ API — 1

<details><summary><code>apps/api/src/contract/web-api-contract.test.ts</code> — 1 · contrato tela ↔ API</summary>

- toda chamada api.* do front tem rota na API (mesmo método e caminho)

</details>

## API — E2E (banco de teste, fluxo pela API real) — 223

<details><summary><code>apps/api/src/e2e/attachments.e2e.test.ts</code> — 11 · Laudos em PDF/JPG/PNG (E2E)</summary>

- RE do caso envia PDF; o arquivo fica no banco, não no armazenamento externo, e a chave não carrega o nome
- médico também envia e lista os dois laudos; o RE só vê o que ele mesmo enviou (regra da Dra., 23/out)
- RE e médico abrem o PDF; o conteúdo volta igual e sem cache
- especialista, professor, gestor e Board não enviam, não listam e não abrem
- outro município e outra escola recebem 404 (sem vazar que o caso existe)
- foto do celular (JPG/PNG) é aceita e volta com o tipo certo
- só PDF/JPG/PNG de verdade: GIF, texto disfarçado, vazio e acima de 10 MB são recusados
- [REG-002] com o Supabase fora do ar o laudo salva e abre normalmente (laudo é opcional e não depende dele)
- [REG-002] laudo antigo (sem conteúdo no banco) ainda abre do bucket; se o bucket cair, 503 só nele
- [REG-005] RE e médico guardam no mesmo lugar: pasta da escola e uuid do aluno, nome do arquivo fora do caminho
- [REG-008] gravar laudo grande que FALHA não infla a memória: o erro é curto e sem o arquivo (o Drizzle põe os parâmetros na mensagem)

</details>

<details><summary><code>apps/api/src/e2e/bi-seed.e2e.test.ts</code> — 1 · seed do assistente do BI (E2E)</summary>

- grava aprovado, não duplica e não vaza para outro tenant

</details>

<details><summary><code>apps/api/src/e2e/bi.e2e.test.ts</code> — 15 · BI do gestor (E2E)</summary>

- quem não é de gestão/clínica da escola não acessa o BI
- município vê a rede; escola pequena fica oculta e o total não é informado
- gestor de escola só enxerga a própria escola, mesmo pedindo outra
- escola de outro município é recusada
- slug, tenant e fila não permitem trocar o escopo do BI
- plano com campo individual ou métrica inexistente é recusado
- nenhuma resposta do BI contém código de aluno
- sumário executivo não expõe textos clínicos individuais
- base populacional: valor oculto na origem continua oculto e profissionais usam capacidade
- assistente: pergunta vira consulta, CPF é removido e o token de serviço é enviado
- assistente com plano inválido ou serviço fora do ar não quebra nem vaza
- assistente não executa plano com escola de outro município
- aprendizado: só gestão aprova direto; o aprovado volta como exemplo na próxima pergunta
- feedback de outra pessoa ou de outro município é recusado
- overview devolve os painéis básicos para cada papel permitido

</details>

<details><summary><code>apps/api/src/e2e/expert-meetings.e2e.test.ts</code> — 10 · agenda do Board (E2E)</summary>

- só a Dra. (board) cria horários; passado é recusado
- escola vê só horários livres; outro tenant não vê nada
- pedido com dado pessoal é recusado
- pedido reserva o horário e avisa a equipe pelo template
- mesmo horário não pode ser reservado duas vezes
- solicitante vê só os seus pedidos; board vê todos
- outro tenant e escola não confirmam; Dra. confirma e quem pediu recebe o Meet fixo
- recusa libera o horário e avisa o solicitante
- falha do Resend não derruba o pedido
- Dra. só aceita link do Meet válido

</details>

<details><summary><code>apps/api/src/e2e/factory-reset.e2e.test.ts</code> — 6 · Reset de fábrica do piloto (E2E)</summary>

- só o admin vê a prévia e dispara o reset
- a prévia lista só o município demo (Tarumã e real ficam de fora, mesmo Tarumã marcado demo)
- sem a palavra de confirmação, não apaga nada
- linha de outro tenant que aponta para caso/aluno do demo não trava o reset
- executa: zera o demo e NÃO toca Tarumã nem o real
- rodar de novo é idempotente: demo já vazio, total 0, nada quebra

</details>

<details><summary><code>apps/api/src/e2e/intersectoral.e2e.test.ts</code> — 3 · Rede Intersetorial (E2E)</summary>

- recusa requisição anônima sem token (401)
- recusa perfil sem permissão na rede intersetorial (403)
- permite acesso a perfil autorizado (200) e calcula métricas

</details>

<details><summary><code>apps/api/src/e2e/journey.e2e.test.ts</code> — 21 · jornada clínica (E2E)</summary>

- sem sessão: rotas clínicas respondem 401
- gestor escolar não acessa conteúdo clínico
- RE cadastra aluno só por código e abre o caso
- caso devolvido traz o código do aluno e abrir de novo retoma o mesmo caso
- trava de idade do piloto: só 4 anos a 9 anos e 11 meses (individual e em lote)
- isolamento: outro município e outra escola não enxergam o caso (404)
- RE: rascunho incompleto não envia; completo envia e trava
- administrador de outro município enviando o FOGAP recebe erro claro (não 500) e nada muda
- FOGAP por faixa: 4–5 e 6–9 anos selecionáveis, respostas só da faixa, médico não recebe os itens
- jornada do RE: formulário único — qualquer ordem, lacunas listadas e envio com confirmação
- A–F em branco ainda podem ir com confirmação, mas só depois dos obrigatórios (série, ATA e Formulário I)
- RE não delega; médico delega a especialista e a outra especialidade
- especialista vê só a própria seção e não edita a de outro
- especialista vê só o sumário executivo do médico (pendente) e nada do RE nem dos colegas
- especialistas concluem; só então o caso volta ao médico
- especialista só vê o sumário do médico depois de concluído; parecer do colega nunca; sem seção → 403
- médico vê o consolidado, encerra com motivo e a trilha mostra todos os eventos
- trilha e transições são imutáveis no banco
- toda transição tem ator, papel, data e motivo
- avaliações: nota do cliente é ignorada e aluno de outro município dá 404
- respostas não expõem nome, CPF ou e-mail do aluno

</details>

<details><summary><code>apps/api/src/e2e/legacy-import.e2e.test.ts</code> — 7 · migração da base individual (E2E, dados sintéticos)</summary>

- simulação valida o contrato e não grava nada
- sem base legal e autorizante a gravação é recusada
- grava tudo e a conferência bate com a planilha e com os agregados
- nenhum nome, endereço ou nome de responsável existe em qualquer tabela legacy_*
- a mesma planilha não entra duas vezes; --replace-batch recarrega e confere de novo
- a conferência pega divergência: apagar um dado individual faz o --verify falhar
- barreiras do carregador: coluna de identificador direto e CPF em texto livre são recusados

</details>

<details><summary><code>apps/api/src/e2e/medical-forms.e2e.test.ts</code> — 13 · Formulários do médico e encaminhamento (E2E)</summary>

- o médico vê tudo o que a escola registrou sobre o aluno encaminhado (somente leitura)
- só o médico lê e escreve os formulários do médico
- seção concluída de catálogo antigo reabre preservando histórico e aceita nova versão
- L: retorno para reavaliação guarda só data válida (AAAA-MM-DD)
- genograma: o desenho por parentesco é guardado normalizado e conclui a seção sem texto
- rascunho, conclusão, trava e reabertura com motivo (guarda a versão anterior)
- o conteúdo clínico não vai para a trilha nem para a auditoria
- fora da revisão médica a escrita é bloqueada
- encaminhamento: o médico designa especialistas e depois acrescenta outros; o RE não delega
- com o caso delegado os formulários do médico continuam editáveis
- catálogo novo: seção concluída com versão antiga volta como rascunho, sem perder o texto
- hipótese diagnóstica: só CID 10 e CID 11; o texto das células antigas não se perde
- médico sem 'Ver tudo da escola': a API avisa (somenteSumario) e não manda as respostas do FOGAP

</details>

<details><summary><code>apps/api/src/e2e/observability-access.e2e.test.ts</code> — 11 · Recuperação de senha e saúde do sistema (E2E)</summary>

- toda resposta leva x-request-id; id válido de entrada é mantido, inválido é trocado
- /health/ready e /health/db só dizem se o banco responde, sem versão nem nome do banco
- erro 5xx: resposta traz requestId, o erro entra no painel e o contador sobe
- erro 4xx continua com a mensagem original
- painel de saúde: só o Master, com alertas, config sem valores e sem segredo
- /metrics: desligado sem token; com token exige Bearer correto
- pedir link: resposta igual para e-mail existente e inexistente; falha de envio é contada
- pedir link: o 11º pedido do mesmo IP na hora leva 429
- redefinir: valida o link, troca a senha, derruba sessões, audita e o link não vale de novo
- link forjado, adulterado ou de e-mail sem cadastro é recusado
- redefinir: o 21º envio do mesmo IP na hora leva 429

</details>

<details><summary><code>apps/api/src/e2e/pilot-indicators.e2e.test.ts</code> — 14 · Indicadores do piloto (E2E)</summary>

- sem sessão ou sem privilégio não vê indicadores
- rede: os 5 indicadores calculados com os números esperados
- escola pequena fica oculta (&lt;5) em todos os indicadores de alunos
- grupo controle é separado do piloto
- gestor e RE de uma escola só enxergam a própria; pedir outra escola é 404
- tenantId de outro município só vale para o admin da plataforma
- a resposta do grupo nunca traz código de aluno nem linguagem diagnóstica
- individual: médico e RE da escola veem o percurso do aluno; outro município e outra escola não
- individual: o acesso fica na trilha de auditoria
- medida: RE registra a da escola; contagem é calculada no servidor
- medida: validações de origem, caso, itens, data e ordem
- medida: a mais recente vale; as anteriores ficam; o banco não deixa alterar nem apagar
- medida: a trilha de auditoria registra quem gravou
- a medida registrada alimenta o indicador 5 do grupo

</details>

<details><summary><code>apps/api/src/e2e/population.e2e.test.ts</code> — 5 · mapa populacional e cadastro de aluno (E2E)</summary>

- importação: só admin; campo individual é recusado
- mapa: escola vinculada calcula profissionais; pontos sem informação listados
- RE preenche localização e matrícula; taxa por mil aparece; gestor da escola não vê a rede
- isolamento: outra escola/tenant não edita nem enxerga; coordenada fora do Brasil é recusada
- aluno: código gerado, validação de nascimento e importação em lote só com ano/mês

</details>

<details><summary><code>apps/api/src/e2e/privileges-config.e2e.test.ts</code> — 10 · Privilégios configuráveis pelo Admin Master (E2E)</summary>

- só o Administrador Master abre e altera a tela de privilégios
- padrão de fábrica = matriz documentada; /api/me devolve o que a pessoa pode
- desmarcar a caixinha do perfil bloqueia na hora; voltar ao padrão libera de novo
- a regra de uma rede não vaza para outra rede; a regra global vale para todas, e a da rede vence
- liberar dado sensível exige confirmação; liberar o que a gestão pode ver não
- liberar uma tela para o RE continua preso à escola dele
- exceção por pessoa vale só para ela e vence a regra do perfil
- capacidades exclusivas do Admin Master não podem ser alteradas (ninguém tranca o admin para fora)
- especialista: padrão por especialidade e matriz do escopo
- toda mudança fica na trilha de auditoria

</details>

<details><summary><code>apps/api/src/e2e/privileges.e2e.test.ts</code> — 13 · Privilégios por ator (E2E)</summary>

- gestor municipal vê o sumário do RE e a lista de encaminhados só do próprio município
- diretor vê só a própria escola, mesmo pedindo outra
- observabilidade do RE: gestor vê agregados; tempo de referência só quem pode editar; fora do município 404
- as visões da gestão não expõem respostas item a item, texto interno nem identificação
- só gestor municipal e diretor entram nas visões da gestão
- gestor municipal e diretor não leem nem criam conteúdo clínico
- Board não lê prontuário e atua por pedidos de ajuda; ADM possui acesso à plataforma
- RE lista só os casos da própria escola; médico recebe a rede do município
- RE não decide pelo médico nem preenche seção de especialista
- RE e médico pedem ajuda ao Board; diretor e especialista não
- só o médico lista os especialistas do núcleo para delegar, e só os do próprio município
- especialista não lista casos; só usa as próprias seções delegadas
- leituras da gestão ficam na trilha de auditoria com o papel

</details>

<details><summary><code>apps/api/src/e2e/profile.e2e.test.ts</code> — 14 · Meu painel (E2E)</summary>

- sem sessão: 401 em todas as rotas
- ler o perfil: dados próprios, CPF mascarado, sem foto e com a lista do que é editável
- /api/me traz o que o hero do painel mostra: cargo, conselho, especialidade, escola e bio
- editar: nome, telefone e apresentação; apagar com vazio; trilha guarda só os nomes dos campos
- não dá para alterar papel, e-mail, CPF, escola nem registro profissional
- validações: telefone inválido, nome curto, corpo vazio
- foto: envia, remove metadados de local, guarda chave opaca e devolve o link
- trocar a foto apaga a anterior; remover apaga o arquivo e limpa o perfil
- foto inválida é recusada sem tocar o armazenamento
- armazenamento fora do ar: 503 com mensagem clara e perfil intacto
- cada pessoa só mexe na própria foto (a foto de uma não aparece nem some na de outra)
- pedido de exclusão da conta: registra uma vez só e aparece no perfil
- métricas por papel: títulos, números sintéticos e nenhuma identificação de aluno
- outro município não enxerga nada do primeiro nas métricas

</details>

<details><summary><code>apps/api/src/e2e/re-envio-pela-tela.e2e.test.ts</code> — 5 · [REG-001] envio do RE ao médico pelas rotas da tela (E2E)</summary>

- [REG-001a] sem responder os comportamentos, o envio é recusado listando os 15 itens
- [REG-001b] comportamentos salvam pela rota da tela, voltam na leitura e item em branco não vira "Não"
- [REG-001c] a rota recusa comportamento inexistente, valor inválido, perfil sem permissão e outro município
- [REG-001d] RE completa a jornada SÓ pelas rotas da tela e envia ao médico
- [REG-001e] depois do envio os comportamentos ficam em somente leitura (409)

</details>

<details><summary><code>apps/api/src/e2e/rls.e2e.test.ts</code> — 12 · RLS por tenant (papel periscopio_app)</summary>

- trava: toda tabela de public tem RLS ligado e política para periscopio_app
- o papel da aplicação não é superuser nem ignora RLS
- com tenant A, enxerga só linhas do A
- sem contexto, não enxerga nada e não consegue gravar (falha fechada)
- tenant A não grava, altera nem apaga linhas do tenant B
- contexto cross_tenant (admin_platform / fluxo de sistema) enxerga todos
- trilhas append-only: lê e insere no próprio tenant, mas não altera nem apaga
- tenants: só contexto cross_tenant cria tenant
- privilégios: tenant lê a regra global e a sua, nunca a de outro tenant, e só grava na sua
- leads: o site público só insere; ler exige cross_tenant
- catálogo do LMS: leitura para todos, escrita só cross_tenant
- o papel da aplicação não lê as views de autenticação (hash de senha e sessões)

</details>

<details><summary><code>apps/api/src/e2e/rotas-e-termo.e2e.test.ts</code> — 8 · [REG-009] jornada dos especialistas com a trava do termo ligada</summary>

- [REG-009a] sem aceitar o termo o especialista é barrado com o motivo certo; a janela do termo continua acessível
- [REG-009b] depois de aceitar, cada especialista puxa o encaminhamento que o médico fez para ele
- [REG-009c] a fono salva, o status deixa de ser 'não iniciado' e a Conduta aparece como item próprio
- [REG-009d] o médico troca o profissional de uma seção pendente: a neuropsicóloga passa a ver a dela
- [REG-009e] não troca quando o profissional já começou (nada é perdido) nem quando a seção não está pendente
- [REG-009f] varredura: nenhuma rota GET responde 5xx para médico, RE, especialista nem Admin Master
- [REG-010] gravar auditoria como Admin Master (ator virtual) não derruba nada, nem dentro de transação
- [REG-012] o mapa técnico do sistema é só do Admin Master: sem login 401, demais perfis 403, Master 200

</details>

<details><summary><code>apps/api/src/e2e/specialty-forms.e2e.test.ts</code> — 11 · Formulários das especialidades (E2E)</summary>

- cada especialista vê os formulários da própria especialidade, e só dela
- quem não é dono da seção não lê nem escreve (colega, médico, RE, outro município, sem login)
- formulário de outra especialidade não existe para esta seção
- valida: campo desconhecido, opção inválida e data inválida são recusados
- rascunho, conclusão, trava e reabertura com motivo (guarda a versão anterior)
- o conteúdo clínico não vai para a trilha nem para a auditoria
- o médico não lê nada enquanto a seção não for concluída
- seção concluída: formulários viram somente leitura e o médico lê SÓ o sumário, não o bloco de notas
- seção concluída sem o formulário de sumário: o médico vê a seção, avisada como sem sumário
- consolidado: parecer de seção em andamento não sai do profissional; o de seção concluída sim
- só o médico do município lê a devolutiva; especialista, RE e médico de outro município não

</details>

<details><summary><code>apps/api/src/e2e/student-name.e2e.test.ts</code> — 7 · nomeCurto</summary>

- primeiro nome + inicial do último sobrenome
- com a caixinha desligada (padrão) ninguém recebe o nome, nem na fila
- ligada para RE, médico e especialista: recebem o nome só onde fazem parte do caso
- gestão, Board, pesquisa, direção e administração NUNCA recebem o nome, mesmo com a caixinha marcada
- a fila mostra o nome curto para a equipe e grava auditoria sem o nome
- exceção da pessoa vale por cima do perfil (negar para um médico específico)
- cadastro do aluno com o nome: vai cifrado para o cofre e o nome não aparece na resposta nem na auditoria

</details>

<details><summary><code>apps/api/src/e2e/taruma-dashboard.e2e.test.ts</code> — 4 · painel de Tarumã (E2E)</summary>

- admin da plataforma (outro município) vê o painel de Tarumã, com auditoria
- gestão municipal de Tarumã vê o município inteiro; capacidade editada recalcula
- gestor de uma escola vê só o agregado da própria escola
- outro município e perfil sem acesso não enxergam Tarumã

</details>

<details><summary><code>apps/api/src/e2e/tea.e2e.test.ts</code> — 10 · Triagem TEA (E2E)</summary>

- catálogo: quem preenche ou lê algum instrumento recebe os 5; diretor não
- RE: vê e preenche só a ATA; valida; exige respondente e data para enviar; depois de enviada, trava
- escopo: RE de outra escola, médico de outra rede e diretor não entram
- médico: preenche o ASQ (com a regra da pergunta 1) e lê o que os outros enviaram
- especialistas: cada um só o seu instrumento; sem delegação não entra
- faixa de referência só aparece quando o Admin Master liga a caixinha
- sumário: por regras, sem identificação, e respeitando o que cada pessoa pode ler
- sumário com assistente: aceita saída válida; recusa diagnóstico, número inventado e formato torto
- caixinha desligada bloqueia o preenchimento; caso encerrado trava tudo
- envios ficam na linha do tempo do caso e na auditoria

</details>

<details><summary><code>apps/api/src/e2e/termo-profissional.e2e.test.ts</code> — 8 · [REG-003] termo profissional (E2E)</summary>

- [REG-003a] sem aceite (false) o perfil clínico é barrado no servidor, mas pode ler e aceitar o termo
- [REG-003b] aceitar sem marcar a caixa é recusado e não grava nada
- [REG-003c] com a caixa marcada grava prova, estado true e auditoria, e libera o uso
- [REG-003d] um aceite por conta: repetir não duplica prova nem auditoria
- [REG-003e] Admin Master (ator virtual, sem linha em users) consegue aceitar e não vê mais a janela
- [REG-003f] a auditoria de qualquer ação do Admin Master é gravada (antes a chave estrangeira derrubava o registro)
- [REG-003g] termo desatualizado na tela é recusado (409) e nada é gravado
- [REG-006] com a migração 0029 pendente (tabela ausente) não há 500 nem bloqueio: avisa e libera; aceitar responde 503 claro

</details>

<details><summary><code>apps/api/src/e2e/visibilidade-rotas.e2e.test.ts</code> — 4 · Validação de rotas por perfil (E2E)</summary>

- médico: vê tudo o que a escola registrou (A a I, itens do FOGAP) e só a seção concluída dos especialistas; nunca rascunhos
- especialista (fono): só o próprio bloco; sem FOGAP, A a H, seção de colega nem formulário do médico
- especialista sem seção neste caso e RE: nada além do que é seu
- outro município e sessão ausente: nada

</details>

## Assistente do BI (Python) — 41

<details><summary><code>apps/bi-rag/tests/test_app.py</code> — 3</summary>

- test_exige_token
- test_plano_com_token
- test_sem_token_configurado_recusa_tudo

</details>

<details><summary><code>apps/bi-rag/tests/test_llm.py</code> — 13</summary>

- test_desligado_por_padrao
- test_gemini_exige_chave_e_modelo
- test_provedor_forcado
- test_gemini_resposta_valida_e_requisicao
- test_falha_do_provedor_devolve_none
- test_groq_exige_chave_e_modelo_e_envia_requisicao_compativel_openai
- test_groq_vence_gemini_e_provedor_forcado_respeita
- test_groq_gpt_oss_usa_raciocinio_baixo_e_cai_para_sem_modo_json_no_400
- test_complete_json_usa_o_system_informado_e_nunca_levanta
- test_gasto_de_tokens_e_registrado_por_chamada_sem_guardar_texto
- test_gemini_soma_tokens_de_raciocinio_na_saida
- test_falha_do_provedor_conta_como_erro_com_zero_tokens
- test_sem_begin_o_registro_nao_acumula_nada

</details>

<details><summary><code>apps/bi-rag/tests/test_observacoes.py</code> — 6</summary>

- test_prompt_proibe_diagnostico_e_conduta
- test_sem_provedor_devolve_none
- test_endpoint_exige_token
- test_endpoint_sem_provedor_informa_disabled
- test_endpoint_com_provedor_simulado
- test_resposta_fora_do_formato_vira_none

</details>

<details><summary><code>apps/bi-rag/tests/test_planner.py</code> — 10</summary>

- test_casos_por_escola
- test_tempo_medio_por_mes_com_periodo
- test_profissionais_por_servico
- test_queixas_exige_agrupar_por_queixa
- test_filtro_de_escola_e_idade
- test_delegacoes_por_especialidade
- test_recusa_pedido_individual_e_diagnostico
- test_pergunta_sem_sentido_pede_esclarecimento
- test_exemplo_aprovado_e_reutilizado_e_respeita_escola_nova
- test_aprendizado_muda_a_resposta

</details>

<details><summary><code>apps/bi-rag/tests/test_seed.py</code> — 4</summary>

- test_seed_tem_forma_valida
- test_pergunta_do_seed_e_reaproveitada
- test_escola_citada_vence_o_plano_do_seed
- test_regras_sozinhas_entendem_o_vocabulario_de_taruma

</details>

<details><summary><code>apps/bi-rag/tests/test_tea.py</code> — 5</summary>

- test_prompt_proibe_diagnostico_e_conduta
- test_sem_provedor_devolve_none
- test_endpoint_exige_token
- test_endpoint_sem_provedor_informa_disabled
- test_endpoint_com_provedor_simulado_envia_so_o_digest

</details>
