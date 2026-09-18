# Periscópio Saúde

Monorepo do MVP: sistema de triagem, acompanhamento e encaminhamento de saúde mental escolar (protocolo NEMT).

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15 (PWA) — deploy Vercel |
| Backend | Node.js + Fastify (monolito) — deploy Render |
| Banco de dados | PostgreSQL (Neon) |
| Fila | Redis |
| Storage / CDN | Cloudflare R2 |
| E-mail | Resend |
| Auth | Better Auth |

## Estrutura

```
apps/
  web/       Next.js 15 PWA
  api/       Fastify API (monolito)
packages/
  shared/    Tipos, schema do banco (Drizzle) e validação (zod) compartilhados
infra/       Configuração de deploy (Render blueprint, etc.)
```

## Setup local

```bash
pnpm install
cp .env.example .env
pnpm dev:api   # http://localhost:3001
pnpm dev:web   # http://localhost:3000
```

## Multi-tenant

Todo dado de domínio carrega `tenant_id` (município). Ver modelo de dados completo no Notion do produto.
