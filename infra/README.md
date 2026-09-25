# Infraestrutura & Deploy

O Periscópio Saúde é estruturado como um monorepo com separação clara de responsabilidades entre Frontend (Vercel), Backend (Render) e Banco de Dados (Neon).

---

## 1. Banco de Dados: Neon (PostgreSQL) — LGPD

Para conformidade com a **LGPD (Lei Geral de Proteção de Dados)** e garantia de baixa latência para os municípios brasileiros:

1. Acesse o console do [Neon](https://neon.tech).
2. Ao criar o projeto / banco de dados, selecione obrigatoriamente a região:
   - **Região**: `AWS South America (São Paulo) / sa-east-1`.
3. Copie a string de conexão (`DATABASE_URL`):
   - Recomendado: utilize a URL com Connection Pooling habilitado (`-pooler`).
   - Exemplo: `postgresql://[user]:[password]@ep-xxxx-pooler.sa-east-1.aws.neon.tech/periscopio?sslmode=require`
4. Essa `DATABASE_URL` deve ser configurada:
   - No arquivo `.env` local.
   - Nas variáveis de ambiente do serviço da API no **Render**.

### Migrações do Banco (Drizzle ORM)
Para gerar e aplicar as migrações no Neon:
```bash
# Na raiz do monorepo:
pnpm --filter @periscopio/api db:generate
pnpm --filter @periscopio/api db:migrate
```

---

## 2. Frontend: Vercel (`apps/web`)

1. Acesse o dashboard da [Vercel](https://vercel.com) e clique em **Add New... > Project**.
2. Conecte o repositório `periscopio-app/app`.
3. Na tela de configuração do projeto (**Project Settings**):
   - **Framework Preset**: Next.js
   - **Root Directory**: clique em *Edit* e selecione `apps/web`.
   - Marque a opção: *"Include source files outside of the Root Directory in the Build Step"* (padrão em monorepos Vercel).
4. Em **Environment Variables**, configure:
   - `NEXT_PUBLIC_API_URL`: URL da API hospedada no Render (ex: `https://periscopio-api.onrender.com`).
5. Clique em **Deploy**.

---

## 3. Backend: Render (`apps/api` via Blueprint)

O repositório inclui um arquivo [`render.yaml`](../render.yaml) na raiz pronto para criar o serviço Web e o Redis no Render:

1. Acesse o [Render Dashboard](https://dashboard.render.com).
2. Clique em **New +** e selecione **Blueprint**.
3. Conecte o repositório `periscopio-app/app`.
4. O Render detectará automaticamente o `render.yaml`, que provisiona:
   - **periscopio-api** (Web Service Node.js executando Fastify).
   - **periscopio-redis** (Key-Value Redis para as filas do BullMQ).
5. Preencha as variáveis de ambiente sincronizadas:
   - `DATABASE_URL`: string de conexão do Neon (`sa-east-1`).
   - `BETTER_AUTH_SECRET`: chave aleatória segura para tokens de autenticação.
   - `BETTER_AUTH_URL`: URL pública da sua API no Render (ou domínio personalizado).
   - Credenciais do Cloudflare R2 (`R2_*`) e Resend (`RESEND_API_KEY`).
6. O build utilizará o `tsup` para gerar o bundle otimizado em `dist/index.js` e iniciar com `node dist/index.js`.

---

## 4. Autenticação: Neon Auth + Google OAuth

O Periscópio Saúde utiliza o **Neon Auth** (motor Better Auth gerenciado e integrado ao Postgres no Neon):

- **Neon Auth URL**: `https://ep-green-sun-b6elixxo.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth`
- **JWKS (Chaves Públicas)**: `https://ep-green-sun-b6elixxo.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth/.well-known/jwks.json`

### Configuração do Google Cloud Console (OAuth 2.0)
No [Google Cloud Console](https://console.cloud.google.com/) > **APIs & Services > Credentials** > **OAuth 2.0 Client IDs**:

1. **Origens JavaScript autorizadas**:
   - `http://localhost:3000`
   - `http://localhost:3001`
   - `https://ep-green-sun-b6elixxo.neonauth.c-2.sa-east-1.aws.neon.tech`
   - Seu domínio Vercel (ex: `https://periscopio.vercel.app` ou `https://app.projetoperiscopio.com.br`)
   - Seu domínio Render (ex: `https://periscopio-api.onrender.com` ou `https://api.projetoperiscopio.com.br`)
2. **URIs de redirecionamento autorizados**:
   - `https://ep-green-sun-b6elixxo.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth/callback/google`
   - `http://localhost:3001/api/auth/callback/google` (se usar callback local da API)
3. Copie o **Client ID** e o **Client Secret** e cadastre no console do Neon Auth (ou nas variáveis `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no Render).

---

## 5. Apontamento de Domínios na Cloudflare

Para usar seus domínios personalizados (ex: `projetoperiscopio.com.br`) com proteção DDoS e CDN da Cloudflare:

| Tipo | Nome (Subdomínio) | Destino (Target) | Proxy Cloudflare (Nuvem Laranja) |
|---|---|---|---|
| CNAME | `app` | `cname.vercel-dns.com` | **Ativado (Proxied)** |
| CNAME | `api` | `periscopio-api.onrender.com` | **Ativado (Proxied)** |

### Configurações essenciais no painel Cloudflare:
1. **SSL/TLS**: Selecione o modo **Full (Strict)**.
2. **WebSockets**: Habilitado em *Network > WebSockets*.
3. **CORS & Headers**: A API Fastify já repassa os headers de IP real (`CF-Connecting-IP` e `X-Forwarded-For`).

---

## 6. Testes com Postman

O repositório inclui a coleção completa pronta para importação no Postman ou Insomnia:
- Arquivo: [`periscopio-auth.postman_collection.json`](../periscopio-auth.postman_collection.json)

### Como testar no Postman:
1. Abra o Postman e clique em **Import**.
2. Selecione o arquivo `periscopio-auth.postman_collection.json`.
3. A coleção já vem com as seguintes pastas:
   - **1. Diagnóstico & Health**: testa `/health`, `/health/db` (conexão real com Neon) e JWKS.
   - **2. Neon Auth (Autenticação)**: Cadastro por e-mail, Login com token salvo automaticamente, Login com Google e Consulta de sessão.
   - **3. API Autenticada**: Validação de sessão `/api/auth/me` e listagem de triagens com token Bearer.

---

## 7. Serviços Auxiliares

- **Cloudflare R2**: Bucket `periscopio-uploads` para arquivos e anexos médicos/escolares com credenciais S3-compatíveis.
- **Resend**: Envio de notificações e convites por e-mail (`RESEND_API_KEY`).


