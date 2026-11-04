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



---

## 8. Telemetria: Grafana Cloud Free (sem custo)

A API expõe métricas no formato Prometheus em `GET /metrics` (ver `apps/api/src/observability/metrics.ts`). A rota fica desligada (404) até existir `METRICS_TOKEN` no Render e exige `Authorization: Bearer <METRICS_TOKEN>`.

O Grafana Cloud raspa essa URL sozinho (integração **Metrics Endpoint**), sem agente e sem serviço extra no Render:

1. Em **Connections > Add new connection > Metrics Endpoint**, crie um scrape job.
2. **URL**: `https://<dominio-da-api>/metrics` (HTTPS válido, sem redirecionamento).
3. **Autenticação**: Bearer token, com o valor de `METRICS_TOKEN` (no campo do token, sem o prefixo `Bearer`).
4. **Intervalo**: manter 1 minuto.

Séries expostas (todas sem dado pessoal; rótulos só de método, rota-padrão e classe de status):
- `periscopio_http_requests_total` e `periscopio_http_request_duration_ms_*` (histograma) por rota.
- `periscopio_events_total{event}` (falhas de e-mail, limites de taxa etc.).
- `periscopio_process_resident_memory_bytes`, `periscopio_nodejs_heap_used_bytes`, `periscopio_process_cpu_seconds_total`, `periscopio_nodejs_eventloop_lag_p99_ms`.

Limites do plano Free: 10 mil séries ativas e 14 dias de retenção. O teto de 300 rotas no código mantém a API bem abaixo de 10 mil séries.

### Opção recomendada: a API envia as métricas (OTLP), sem scrape job

Evita ter o mesmo segredo em dois lugares (o `METRICS_TOKEN` do scrape precisa ser idêntico na Render e no Grafana). A API
envia as mesmas séries ao Grafana Cloud a cada 60 s, em OTLP/HTTP JSON (`apps/api/src/observability/otlp-push.ts`). Fica
desligada se faltar alguma variável; falha de envio nunca derruba a API.

No Grafana Cloud, em **Connections > OpenTelemetry (OTLP)**: copie o endereço do gateway (`https://otlp-gateway-<região>.grafana.net/otlp`)
e o **Instance ID** do OTLP, e crie um token (access policy) com o escopo `metrics:write`. Na Render (`periscopio-api` > Environment):

Use as variáveis padrão do OpenTelemetry que o Grafana entrega prontas nessa página (a API as lê direto):

| Variável | Valor |
|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | endereço do gateway OTLP (https, termina em `/otlp`) |
| `OTEL_EXPORTER_OTLP_HEADERS` | `Authorization=Basic <base64 de instanceId:token>` |
| `OTEL_SERVICE_NAME` | `periscopio-api` (opcional) |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `http/protobuf` (informativo: a API envia JSON, que o gateway aceita) |

Alternativa: `GRAFANA_OTLP_ENDPOINT`, `GRAFANA_OTLP_USER` e `GRAFANA_OTLP_TOKEN` (a API monta o Basic sozinha).

Conferir em `/admin/saude`: o card "Histórico (Grafana Cloud)" mostra "Envio das métricas pela API: ligado, último envio ok em ...".

### Painel "Resumo para quem gere o sistema" e gasto de IA

`/admin/saude` mostra seis cartões em linguagem simples (no ar, uso, falhas, velocidade, memória e uso de IA). Eles leem o Grafana
pela API, com `GRAFANA_PROM_URL` (endereço **público** do Prometheus, termina em `/api/prom`; o endereço `...internal.grafana.net` do
datasource não serve), `GRAFANA_PROM_USER` (ID numérico da instância do Prometheus) e `GRAFANA_PROM_TOKEN` (política só com `metrics:read`).

O gasto de IA vem do serviço `bi-rag`: cada resposta traz `usage` (provedor, modelo, tokens de entrada e de saída, sucesso ou erro) e a
API soma em `periscopio_ai_tokens_total` e `periscopio_ai_requests_total`. Só contagens: nunca o texto enviado nem o recebido.
Para o custo em dinheiro, defina `AI_PRICE_INPUT_PER_MTOK`, `AI_PRICE_OUTPUT_PER_MTOK` e `AI_PRICE_CURRENCY` com o preço do provedor.

Regras: nunca usar `studentCode`, `caseId`, e-mail ou ID de usuário como rótulo ou nome de métrica, e não colocar payload clínico em log.
