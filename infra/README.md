# Infra

- **Vercel** — deploy do `apps/web` (Next.js). Conectar o repo direto no dashboard da Vercel, root directory `apps/web`.
- **Render** — deploy do `apps/api` via `render.yaml` na raiz do repo (Blueprint).
- **Neon** — banco Postgres, `DATABASE_URL` configurado como env var em ambos os serviços.
- **Cloudflare R2** — bucket `periscopio-uploads`, credenciais S3-compatíveis em `R2_*`.
- **Resend** — envio de e-mail transacional (`RESEND_API_KEY`).

Nenhum serviço AWS é usado — o SDK `@aws-sdk/client-s3` em `apps/api/src/storage` é usado apenas como cliente HTTP compatível com a API S3 do R2.
