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

## 4. Serviços Auxiliares

- **Cloudflare R2**: Bucket `periscopio-uploads` para arquivos e anexos médicos/escolares com credenciais S3-compatíveis.
- **Resend**: Envio de notificações e convites por e-mail (`RESEND_API_KEY`).

