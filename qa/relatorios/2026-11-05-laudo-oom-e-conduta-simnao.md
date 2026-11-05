# Relatório — laudo do médico derruba o servidor (REG-005) e Conduta sem Sim/Não (REG-004)

**Data:** 05/nov/2026 · **Status:** corrigido em PR; falta o deploy

## 1. Laudos: o envio derrubava a API por falta de memória

**Sintoma:** ao anexar laudo (médico e RE), aviso "Não foi possível concluir agora…". Sem erro registrado na API.

**Causa (Render):** o evento `server_failed` traz `oomKilled` com limite de **512 Mi**; os logs mostram o POST entrando às 16:45:11 e o processo reiniciando (`Running 'pnpm start'`) às 16:45:19. O servidor usa ~290 MB em repouso e o envio em **JSON/base64** fazia várias cópias de um arquivo de até 10 MB (corpo de ~13 MB, texto, objeto, buffer, parâmetro do banco). O navegador recebia erro de gateway, daí a mensagem genérica.

**Correção:**
- O arquivo agora vai como **corpo binário** (`Content-Type` do próprio arquivo, nome em `X-File-Name`), sem base64 nem JSON. O pico de memória cai para cerca de 2x o tamanho do arquivo. O nome não aparece na URL nem nos logs de acesso.
- O envio antigo em JSON deixa de existir (415), porque ele era o risco de derrubar o servidor.
- A leitura do laudo guardado não faz cópia extra do conteúdo.
- RE e médico usam o mesmo cartão e a mesma rota: tudo vai para o mesmo lugar. A chave guardada é `schools/<uuid da escola>/<uuid do aluno>/<uuid do documento>.<ext>`: a "pasta" é a do aluno, e o nome do arquivo nunca entra no caminho.

**Atualização (05/nov, à noite) — a primeira correção não bastou.** A Render registrou novos `oomKilled` (19:53, 19:58 e 20:04 UTC) mesmo com o envio binário no ar. Causa adicional, confirmada por teste: quando a gravação do laudo **falha** (na época a coluna `content` da migração 0028 ainda não existia), o Drizzle monta a mensagem do erro com **todos os parâmetros da consulta, ou seja, o arquivo inteiro** (mais de 1 milhão de caracteres para 8 MB), e o log a copia várias vezes: pico de memória no caminho de erro. Correção: o laudo agora é gravado por consulta direta ao driver (`attachment-store.service.ts`), cujo erro é curto e só traz o código do Postgres. Prova: `[REG-008]`. A migração 0028 também foi aplicada, então o caminho feliz deixou de falhar. **Ainda não verificado em produção:** envie um laudo e confira se não há novo `oomKilled`.

**Prova:** `[REG-005]` (RE e médico gravam sob a mesma pasta do aluno, sem o nome no caminho) e os testes de laudo agora enviam em binário como a tela. **Não medi a memória em produção:** confirme depois do deploy no card "Memória do servidor" (`/admin/saude`) enviando um laudo de alguns MB. Se continuar apertado, o próximo passo é subir o plano da Render (o limite de 512 MB é baixo para este serviço).

## 2. Conduta do Sumário do médico: escolha Sim ou Não por item

**Pedido:** o item "4. Conduta (0. Não · 1. Sim)" era caixa de marcar; o médico precisa escolher Sim ou Não.

**Antes:** `conduta` era uma lista de caixas marcadas ("5,7,11"). Não marcar não distinguia "Não" de "em branco".

**Agora:** campo do tipo `simnao`: cada item tem os botões **Sim** (1) e **Não** (0); clicar de novo na escolha volta para em branco. Guardado como `5=1,9=0`. O texto para o especialista mostra "…: Sim" / "…: Não" e omite o que ficou em branco. Dados antigos continuam valendo: item que estava marcado vira Sim; o que não estava fica em branco (não dá para saber se era Não).

**Prova:** `[REG-004]` (normalização, Não diferente de branco, compatibilidade com dado antigo, texto de leitura) e ajuste dos testes do sumário. Conferido no navegador (marcar, trocar, desmarcar; celular sem rolagem lateral).

## Pergunta para a responsável clínica
Os itens **5 ("não está sob farmacoterapia")** e **6 ("sim, está sob farmacoterapia")** são duas respostas da mesma pergunta. Com Sim/Não em cada item, o médico poderia marcar Sim nos dois. Como o formulário em papel trata isso: um item só (Sim → 6, Não → 5) ou dois itens independentes? Mantive literal (cada item com Sim/Não) até a resposta.

## Também aberto
- O envio da foto de perfil também usa base64 em JSON e o Supabase (endereço inexistente): mesma família de problema, não tratado aqui.
