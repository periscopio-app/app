# Relatório de erro: especialistas do piloto não recebiam acesso por e-mail (REG-029 e REG-030)

**Data:** 12/nov/2026 · **Gravidade:** alta para o piloto (nenhum especialista conseguia entrar sozinho) · **Status:** corrigido em PR

## Sintoma

Profissionais cadastrados como especialistas não recebiam e-mail nenhum, e a tela de Usuários não dizia se o e-mail tinha saído. Não existia "magic link" do Better Auth: o plugin nunca foi configurado (só `twoFactor`); o que existe é o link de primeiro acesso, que só é enviado quando a própria pessoa o pede em `/primeiro-acesso`.

## Causas

1. `POST /api/admin/users` criava o usuário com senha aleatória e **não enviava nada**; a resposta só mandava "peça ao usuário que acesse /primeiro-acesso".
2. O convite por e-mail (`onboarding_invites`) exigia **escola** (`school_id NOT NULL`), então especialista de núcleo, sem escola, não tinha convite.
3. `email/index.ts` usava como remetente padrão `no-reply@periscopiosaude.com.br`, domínio que **não está verificado no Resend** (o verificado é `projetoperiscopio.com.br`). Havia três módulos de e-mail com três remetentes padrão diferentes.
4. Erros de envio eram engolidos (log) e a API respondia sucesso. Em produção, nenhum envio real e nenhum evento `access:link_sent` constavam.
5. Sem `tenantId`, o usuário caía no tenant global; o médico da instância não o via em `/api/nucleo/professionals`, e ele não via os casos da instância.
6. O link de acesso valia 1 hora: curto demais para um e-mail enviado pelo administrador.

## Correção

- **Link de cadastro unitário** (pedido do Bruno): o Admin Master gera um link por pessoa (instância, perfil e especialidade já definidos; validade de 1 a 30 dias), envia por onde quiser (há botão de WhatsApp) e a pessoa abre `/cadastro`, informa o próprio e-mail (qualquer domínio) e cria a senha. Uso único, revogável, nunca redefine a senha de e-mail já cadastrado.
- Criar usuário sem senha **envia o link de acesso** (válido por 7 dias) e a resposta traz `emailStatus` (`sent`, `failed` com o motivo, `skipped`); botão **Enviar acesso** na lista reenvia.
- **Remetente único** (`email/sender.ts`, padrão `Periscópio <equipe@projetoperiscopio.com.br>`) nos três módulos; `sendEmailResult` devolve o resultado em vez de lançar.
- **Tenant obrigatório e validado** ao criar quem não é da plataforma; escola precisa ser da mesma instância; escola passa a ser opcional para especialista e médico.
- Convite sem escola e sem e-mail (migração `0038`, só estrutura); `complete-school` só aceita convite de gestor escolar.

## Prova

- `cadastro-por-link.e2e.test.ts` (13 testes, `[REG-029a..h]` e `[REG-030a..e]`), com o Resend simulado: remetente do domínio verificado, validade de 7 dias, falha de envio visível e reenvio, nenhuma troca de senha de conta existente, uso único sob concorrência, link de outra natureza barrado.
- `index.test.ts`: `[REG-029]` o remetente padrão é do domínio verificado.
- Suíte completa da API: 744/744 com o ambiente da CI.

## Não coberto / a conferir em produção

- O envio real depende de `RESEND_API_KEY` válida no Render e de `APP_URL=https://www.projetoperiscopio.com.br`. Não foi possível ler as variáveis do Render daqui.
- O e-mail digitado no link de cadastro não é confirmado por caixa de entrada: quem tem o link escolhe o e-mail. O risco é um link vazado; por isso uso único, validade e revogação.
