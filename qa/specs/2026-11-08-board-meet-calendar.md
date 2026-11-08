# Spec — Agenda do Board com Google Agenda/Meet e plano B (Jitsi + .ics)

Data: 08/nov/2026. Branch: `feat/board-jitsi-ics-invite`. Decisão do PM (Bruno): "Google direto". Jitsi + .ics ficam como plano B.

## Sintoma → decisão

- Ao confirmar um pedido, a sala era um link Meet fixo (ou, sem ele, `meet.jit.si/periscopio-board-<tenant8>-<reunião8>`, **previsível**) e a cópia da
  equipe saía com `MEET_URL` nulo quando não havia sala fixa. Nada ia para a agenda de ninguém.
- Agora, ao confirmar: **Google** (evento na agenda da Dra. com Meet novo e convite do Google) → **sala fixa** (evento aponta para ela) → **Jitsi**
  aleatória (`periscopio-<32 hex>`, 128 bits, sem tenant/aluno/caso) com **.ics** anexado.

## Onde no código

| Peça | Arquivo |
|---|---|
| Confirmação + rota do .ics | `apps/api/src/routes/expert-meetings.routes.ts` |
| OAuth/Calendar, cifra do token, `state` assinado | `apps/api/src/services/google-calendar.service.ts` |
| Rotas de conexão (`/api/integrations/google/*`) | `apps/api/src/routes/google-integration.routes.ts` |
| Gerador de .ics (RFC 5545, sem dependência) | `apps/api/src/services/ics.ts`, `board-ics.ts` |
| Sala Jitsi | `apps/api/src/services/jitsi.ts` |
| E-mail com anexo (cai para sem anexo se o Resend recusar) | `apps/api/src/email/templated.ts` |
| Migração 0037 (conexão + `meet_provider` + `google_event_id`) | `apps/api/drizzle/0037_board_google_calendar.sql` |
| Tela | `apps/web/app/[slug]/dashboard/agenda/page.tsx`, `apps/web/lib/api.ts` (`api.blob`) |

## Regras e aceite (cada linha tem teste)

1. Sem Google conectado: sala `https://meet.jit.si/periscopio-<32 hex>`, `meet_provider='jitsi'`, .ics anexado ao e-mail de quem pediu **e** à cópia da equipe, ambos com o **mesmo** link. (`expert-meetings-invite.e2e` #1)
2. Google conectado: evento criado com `conferenceDataVersion=1&sendUpdates=all`, `hangoutsMeet`, id determinístico (UUID sem hífens, idempotente), convidados = quem pediu + e-mail da equipe. **Sem .ics** (o Google já convidou). (#4)
3. Texto do evento e do .ics é **genérico**: sem tema, código de aluno, caso ou nome de escola. (#1, #4, `ics.test`)
4. Token do Google expirado/revogado: confirma pelo Jitsi, devolve `calendar.notice` ("Reconecte o Google"), apaga a conexão morta. A confirmação **nunca** falha por causa do Google. (#5)
5. Sala fixa da Dra.: continua valendo; com Google, o evento aponta para ela (sem Meet novo). (#9, #10)
6. Rota `GET /api/expert-meetings/:id/calendar.ics`: quem pediu baixa a sua, a coordenação baixa as do tenant. Outro solicitante, outro tenant, pendente/recusada, uuid inválido e inexistente dão **404** idêntico; anônimo 401; `Cache-Control: private, no-store`. (#2)
7. Conexão do Google: só `board.manage`. `state` HMAC amarrado a usuário + tenant, validade de 10 min; `returnTo` só caminho relativo. Refresh token **cifrado** (AES-256-GCM, `GOOGLE_TOKEN_ENC_KEY`), nunca devolvido por rota, nunca em log. (#3, `google-calendar.service.test`)
8. Todo texto vindo de usuário vai escapado para o HTML do e-mail (`escapeVar`) e para o .ics (`escapeIcsText`, sem quebra de linha nem controle). (#7, `ics.test`)
9. Resend recusa anexo com template → reenvio sem anexo; e-mail com o link chega. (#6)
10. Recusa não cria sala nem evento. (#8)
11. `PATCH .../:id/confirm` com id malformado devolve 409 (antes: 500 do Postgres). (#11)

## .ics (decisões)

- CRLF; dobra em 75 octetos sem cortar caractere multibyte; escape de `\ ; ,` e quebra de linha; `UID` estável `expert-meeting-<uuid>@projetoperiscopio.com.br`;
  `METHOD:REQUEST`; `ORGANIZER` = e-mail da equipe (não expõe o e-mail pessoal da Dra.).
- Horários em **UTC** (`...Z`): dispensa `VTIMEZONE` e imune a regra de horário de verão.

## Variáveis de ambiente (só nomes; valores nunca vão para o repositório)

`GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_TOKEN_ENC_KEY` (obrigatórias), `GOOGLE_CALENDAR_REDIRECT_URI` (opcional; padrão `APP_URL` + `/api/integrations/google/callback`).
Sem elas a integração fica desligada e tudo segue no plano B. Não confundir com `GOOGLE_CLIENT_ID/SECRET` do `render.yaml` (login com Google, ainda sem código).

URIs de redirecionamento a cadastrar no Google Cloud: `http://localhost:3000/api/integrations/google/callback`, `https://www.projetoperiscopio.com.br/api/integrations/google/callback`.

## Riscos conhecidos

- App do Google em modo **Testing** (tela externa): refresh token expira em ~7 dias e há no máximo 100 usuários de teste. A tela mostra "Conectar Google" de novo quando expira.
- **LGPD:** os e-mails dos convidados (quem pediu e a equipe) são enviados ao Google ao criar o evento. Nenhum dado de aluno vai.
- Resend: anexo junto de template não está documentado de forma explícita; o reenvio sem anexo cobre a recusa, mas conferir um envio real antes da demo.
- Sala pública `meet.jit.si` pode exigir login de moderador conforme a política do serviço; o link Jitsi é plano B, não substituto do Meet.
- Host da API em produção usado só pelo caminho `/api/*` do site (Vercel repassa); o callback usa o site, não o host do Render.

## Fora de escopo

Cancelar/remarcar reunião confirmada (não existe hoje) e remover o evento do Google ao cancelar.
