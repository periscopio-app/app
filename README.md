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

## Módulos do Piloto & Governança

- **Agenda & Videochamadas:** Integração gratuita via Jitsi Meet para reuniões com o Board de Especialistas, preenchimento de slots e confirmação via e-mails transacionais (Resend).
- **Prontuário com Abas Horizontais:** Visão estruturada, segmentação LGPD por especialidade clínica e validação Zod (100+ caracteres mínimos no parecer).
- **Termo de Responsabilidade Médica / LGPD:** Modal bloqueante obrigatório para profissionais de saúde com cálculo de hash SHA-256 e auditoria imutável.
- **Cofre de Identidade:** Governança civil em dois fatores, motivo clínico registrado e trilha de auditoria para o DPO (Art. 37 LGPD).
- **Sistema de Newsletter:** Leitura pública (`/newsletter`), inscrição com opt-out imediato (Art. 8º LGPD) e painel administrativo (`/admin/newsletter`) para disparos via Resend.
- **Central de Suporte & Diagnóstico:** Widget flutuante com FAQ, abertura de chamados, captura automática de telemetria técnica (URL, navegador, stack trace) e gestão no painel master (`/admin/suporte`).
- **Autoatendimento com Assistente RAG:** Botão superior integrado que responde dúvidas do protocolo NEMT e da plataforma antes da abertura de chamados, com transição e pré-preenchimento automático de tickets.
- **Painel de Suporte em Tema Claro:** Bloco de telemetria técnica e visualização de incidentes em light mode para maior contraste e ergonomia visual.


