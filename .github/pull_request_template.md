## O que muda e por quê
<!-- Uma ou duas frases, sem jargão. -->

## Teste que guarda a mudança
<!-- Nome do teste e arquivo. Para bug corrigido: código [REG-NNN] e o teste tem que falhar sem a correção. -->
- [ ] Tem teste automático que falha sem esta mudança
- [ ] O teste usa as **mesmas rotas que a tela usa** (não um atalho da API)
- [ ] `pnpm qa:catalogo` rodado e o catálogo está no commit
- [ ] Sem teste? Rótulo `sem-teste` e o motivo aqui: ___

## Checagem manual (somente o que é NOVO neste PR)
<!-- Passos curtos para quem for conferir. Não refaça o fluxo de ponta a ponta: o que já existia está no qa/CATALOGO_REGRESSAO.md. -->
1.

## Segurança e clínico
- [ ] Sem dado real, segredo ou nome de aluno em código, teste ou log
- [ ] Nenhum critério clínico novo (campo, peso, limiar, ordem). Se houver, está marcado `// NÃO IMPLEMENTAR ATÉ VALIDAÇÃO`
- [ ] Rota clínica nova filtra por município (e escola) e responde 404, não 403, para outro município
