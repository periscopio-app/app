# Link coletivo de cadastro (grupo de WhatsApp) — [REG-031]

**Data:** 12/11/2026 · **Origem:** pedido do Bruno: um único link para o grupo do WhatsApp, em que cada membro faz o próprio cadastro.

## Limitação anterior
O link de cadastro (#153) valia para UM cadastro. Para um grupo seria preciso gerar e enviar um link por pessoa.

## O que mudou
- `onboarding_invites.max_uses` (padrão 1) e `uses_count` (migração 0039, idempotente, no schema-guard). Link unitário continua igual.
- Link coletivo: `maxUses` de 2 a 200, sem e-mail fixo, validade de 1 a 30 dias, revogável a qualquer momento. A vaga é tomada por um UPDATE atômico; o link é marcado como esgotado na última vaga.
- Especialista pode ficar sem especialidade fixa (`chooseSpecialty`): cada pessoa escolhe a própria ao se cadastrar (médico fica de fora; tem perfil próprio).
- Falha ao criar a conta devolve a vaga. E-mail que já tem conta é recusado sem gastar vaga e sem redefinir senha.
- Limite por IP no cadastro: 20 → 60 por hora (um grupo do mesmo local sai pelo mesmo IP; o teto de usos já limita o abuso).

## Evidência
`src/e2e/cadastro-por-link.e2e.test.ts`: REG-031a (validações), 031b (várias pessoas, escolha de especialidade, teto), 031c (5 pessoas simultâneas em link de 2 vagas: exatamente 2 passam), 031d (vaga devolvida/não gasta, revogação com uso parcial). Suíte completa da API passou.

## Risco residual
Quem tem o link coletivo cria conta com acesso imediato ao perfil do link. Mitigações: teto de usos, validade, revogação, auditoria `registration_link:used` por pessoa, link só no grupo. Se o grupo for aberto demais, a alternativa é cadastro com aprovação do administrador (não implementada).
