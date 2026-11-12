# Google Meet no Board de experts: criar o OAuth no Google Cloud

Quando a Dra. **confirma** um pedido de reunião, a API cria um evento na agenda dela com sala do Google Meet e convida quem pediu. Para isso o sistema precisa de um **cliente OAuth** do Google e de uma conexão feita uma vez pela Dra.

Sem esta configuração nada quebra: a reunião cai na sala fixa (`EXPERT_MEET_URL`) ou numa sala Jitsi, e o convite sai em arquivo ICS.

Código: `apps/api/src/services/google-calendar.service.ts` (chamadas ao Google), `routes/google-integration.routes.ts` (conectar e desconectar), `routes/expert-meetings.routes.ts` (cria o evento na confirmação) e a tela `/<slug>/dashboard/agenda`.

## Antes de começar

| Item | Valor |
|---|---|
| Quem faz o passo a passo | Quem administra o Google Cloud (pode ser o Bruno, logado com a conta que ficará dona do projeto) |
| Quem conecta no fim | A Dra. Ana Cecília, com a conta Google **da agenda onde as reuniões devem aparecer** |
| Escopo pedido | `https://www.googleapis.com/auth/calendar.events` (só eventos; não lê e-mail nem arquivos) |
| Onde o token fica | No Neon, tabela `google_calendar_connections`, cifrado (AES-256-GCM) com `GOOGLE_TOKEN_ENC_KEY` |

**Decida o tipo de conta da Dra. antes:**

- **Conta Google Workspace da organização dela** (e-mail com domínio próprio): use tipo de usuário **Interno** no passo 3. É o melhor caso: sem verificação do Google e sem expiração do token.
- **Conta Gmail comum** (ou Workspace de outra organização): tipo **Externo**. Leia o passo 7, que tem uma armadilha de 7 dias.

## Passo a passo

### 1. Criar o projeto
1. Entre em <https://console.cloud.google.com> com a conta administradora.
2. No seletor de projetos (topo), clique em **Novo projeto**. Nome sugerido: `Periscopio Board`. Crie e selecione o projeto.

### 2. Ativar a Google Calendar API
1. Menu **APIs e serviços → Biblioteca**.
2. Pesquise **Google Calendar API**, abra e clique em **Ativar**.

### 3. Configurar a tela de consentimento (Google Auth Platform)
1. Menu **Google Auth Platform** (ou **APIs e serviços → Tela de permissão OAuth**). Clique em **Começar**.
2. Informações do app: nome `Periscópio` e e-mail de suporte.
3. **Público**: escolha **Interno** (Workspace) ou **Externo** (Gmail), conforme a decisão acima.
4. Dados de contato: um e-mail da equipe. Aceite a política e **Criar**.

### 4. Permitir o escopo da agenda
1. **Google Auth Platform → Acesso a dados → Adicionar ou remover escopos**.
2. Marque **Google Calendar API** com o escopo `.../auth/calendar.events` (descrição na tela: ver e editar eventos nas agendas). Se não aparecer na lista, cole o escopo inteiro no campo "Adicionar escopos manualmente".
3. **Atualizar → Salvar**. É um escopo "sensível" (veja o passo 7).

### 5. Criar o cliente OAuth
1. **Google Auth Platform → Clientes → Criar cliente**.
2. Tipo de aplicativo: **Aplicativo da Web**. Nome: `Periscopio API`.
3. **URIs de redirecionamento autorizados**: adicione exatamente

   ```
   https://SEU-SITE/api/integrations/google/callback
   ```

   Troque `SEU-SITE` pelo endereço público do **site** (o mesmo valor de `APP_URL` no Render, o domínio da Vercel). O retorno do Google passa pelo site e a Vercel repassa `/api/*` para a API. **Não** use o endereço do `periscopio-api` no Render.
   - Sem barra no final, com `https`, e idêntico ao que o sistema usa. Para conferir: a rota `GET /api/integrations/google/status` devolve `redirectUri`.
   - Para desenvolvimento local, use um cliente separado com `http://localhost:3000/api/integrations/google/callback`.
4. **Criar**. Copie o **ID do cliente** e a **Chave secreta do cliente** (a chave só aparece inteira agora; se perder, crie outra).

### 6. Configurar no Render (serviço `periscopio-api`)
Em **Environment**, preencha:

| Variável | Valor |
|---|---|
| `GOOGLE_CALENDAR_CLIENT_ID` | ID do cliente (termina em `.apps.googleusercontent.com`) |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Chave secreta do cliente |
| `GOOGLE_CALENDAR_REDIRECT_URI` | A mesma URI do passo 5. Pode ficar vazia se `APP_URL` estiver certo (o padrão é `APP_URL` + `/api/integrations/google/callback`) |
| `GOOGLE_TOKEN_ENC_KEY` | Gere com `openssl rand -hex 32`. Uma chave por ambiente. **Trocar a chave depois obriga a Dra. a reconectar** |

Salve (o Render reinicia a API). Nunca coloque o secret no repositório nem em conversa.

### 7. Publicar o app (só se o público for Externo)
- Em **Teste**, o Google **expira o token de renovação em 7 dias**. A integração funciona na primeira semana e depois para com `invalid_grant`, e a Dra. teria de reconectar toda semana.
- Para evitar: **Google Auth Platform → Público → Publicar app** (status **Em produção**).
- Como o escopo é sensível e o app não foi verificado, a Dra. verá o aviso **"O Google não verificou este app"** ao conectar: clique em **Avançado → Acessar Periscópio (não seguro)**. É esperado. Há um teto de 100 usuários novos ao longo da vida do projeto, de sobra para uma conta só.
- A verificação do Google (nome e logo na tela, sem aviso) é opcional e pode ficar para depois.

### 8. Deixar a sala fixa vazia (senão não nasce Meet)
Se existir uma **sala fixa** (configuração da agenda do Board ou a variável `EXPERT_MEET_URL`), o evento aponta para ela e o Google **não cria** um Meet novo. Para cada reunião ganhar o próprio Meet, deixe as duas vazias. A ordem na confirmação é: Meet do Google, depois sala fixa, depois sala Jitsi.

### 9. Conectar e testar
1. A Dra. entra no sistema, abre **Agenda** (`/<slug>/dashboard/agenda`) e clica em **Conectar Google**.
2. Escolhe a conta, aceita o acesso à agenda e volta para a tela, que mostra "conectado".
3. Teste ponta a ponta com dados fictícios: crie um horário, faça um pedido com outro usuário e **confirme**. O evento deve aparecer na agenda dela, com link do Meet, e o convite chega ao solicitante.

## Se algo der errado

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `redirect_uri_mismatch` ao conectar | URI do passo 5 diferente da usada pelo sistema | Compare com `redirectUri` do `/api/integrations/google/status` e corrija no Google ou em `GOOGLE_CALENDAR_REDIRECT_URI` |
| `access_denied` ou "app em teste" | Público Externo em Teste e a conta não está na lista de usuários de teste | Publique o app (passo 7) ou adicione a conta em **Público → Usuários de teste** |
| `org_internal` | App Interno e a conta é de fora da organização | Use outra conta da organização ou mude para Externo |
| Conecta, mas some depois de uma semana | App em Teste (token expira em 7 dias) | Passo 7 e reconectar |
| "Conecte o Google de novo" na confirmação | Token revogado ou expirado (`invalid_grant`); o sistema já apaga a conexão | A Dra. reconecta; a reunião seguiu com sala alternativa |
| Conectou, mas sem criar o evento | Dra. desmarcou a permissão da agenda (`scope_missing`) | Desconectar e conectar de novo, deixando a caixa da agenda marcada |
| Evento sem link do Meet | Há sala fixa configurada (passo 8), ou a conta não permite criar Meet | Esvazie a sala fixa; se persistir, a reunião segue com sala alternativa e vale checar a conta |
| Para revogar tudo | Desconectar na tela da Agenda, ou em <https://myaccount.google.com/permissions> | O sistema revoga o token e apaga a conexão |

## Segurança

- O secret e a chave `GOOGLE_TOKEN_ENC_KEY` ficam só no Render.
- O refresh token nunca é gravado em texto puro; a tabela tem RLS por município.
- O `state` do OAuth é assinado e amarrado ao usuário e ao município que iniciaram a conexão.
- Só quem tem a capacidade `board.manage` conecta, desconecta ou vê o status.
- O convite sai com texto genérico de propósito ("Reunião do Board de experts – Periscópio"): sem tema, código de aluno, caso ou escola. Mantenha assim se alterar o código.
- Use dados fictícios nos testes.
