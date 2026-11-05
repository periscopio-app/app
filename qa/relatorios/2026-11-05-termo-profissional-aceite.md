# Relatório de erro — aceite do Termo de Responsabilidade Clínica e LGPD falha (REG-003)

**Data:** 05/nov/2026 · **Gravidade:** alta (bloqueia o primeiro acesso do perfil e a evidência jurídica do aceite) · **Status:** corrigido em PR; falta aplicar a migração 0029 e fazer o deploy

## Sintoma

Na janela "Termo de Responsabilidade Clínica & LGPD", com a caixa marcada, "Confirmar aceite e prosseguir" mostra "Não foi possível concluir agora. Seus dados continuam salvos…".

## Causa (log da API na Render)

`insert into "consent_acceptances" … violates foreign key constraint "consent_acceptances_user_id_fkey"` — `Key (user_id)=(00000000-0000-0000-0000-000000000001) is not present in table "users"`.

Quem clicou foi o **Admin Master**, que é um ator "virtual" identificado só pelo e-mail (SUPERADMIN_EMAILS), com id fixo `0000…0001` e **sem linha na tabela `users`**. O aceite gravava esse id numa chave estrangeira para `users` e o banco recusava. A resposta era 500 genérico.

## Defeitos relacionados encontrados na investigação

| Defeito | Efeito |
|---|---|
| `audit_logs.actor_id` também aponta para `users` | **toda ação do Admin Master perdia o registro de auditoria em silêncio** (o `recordAudit` engole o erro) |
| A "trava" do termo era só visual (janela sobre a tela) | a API nunca exigiu o aceite; fechar a janela pelo navegador liberava tudo |
| O texto exibido na tela era diferente do texto guardado e usado no hash | a prova de aceite não correspondia ao que a pessoa leu |
| O estado "aceitou" era deduzido da existência da prova | não havia o `true/false` explícito pedido pelo produto |

## Correção

- **Booleano no banco:** `professional_term_status.accepted` (uma linha por conta). `false` ou ausência de linha = não libera o uso. Quem já tinha aceitado antes é preservado pela migração.
- **Um aceite por conta:** depois de aceito, a tela nunca mais mostra a janela; repetir o aceite não duplica nada.
- **Evidência, tudo na mesma transação:** prova em `consent_acceptances` (SHA-256 do texto exibido + versão + e-mail + papel + IP + navegador + data), estado `true`, e registro em `audit_logs` (`consent.professional_accepted`). Se qualquer parte falhar, nada é gravado e a tela mostra o motivo.
- **Texto único:** a tela lê o termo do servidor, o mesmo que entra no hash (v1.1, texto idêntico ao que as pessoas já viam).
- **Trava no servidor:** perfil clínico sem aceite recebe `403 TERMO_PENDENTE` em qualquer rota, exceto as do próprio aceite (`/api/me/*`, `/api/auth/*`, `/api/notifications`). Admin Master e perfis não clínicos não são travados (mas podem aceitar). Válvula de emergência: `REQUIRE_PROFESSIONAL_TERM=false` na Render.
- **Admin Master:** o aceite grava o vínculo com `users` como nulo e identifica a pessoa pelo e-mail. A auditoria do Master passou a ser gravada (`actor_id` nulo + `metadata.actor = admin_master_virtual`).
- Se a migração 0029 ainda não foi aplicada, a trava **não derruba o sistema**: libera e avisa no log.

## Prova

`[REG-003a..g]` em `apps/api/src/e2e/termo-profissional.e2e.test.ts`: sem aceite o perfil clínico é barrado e pode ler/aceitar; sem a caixa nada é gravado; com a caixa grava prova + `true` + auditoria e o hash é recalculável; um aceite por conta; Admin Master aceita; auditoria do Master é gravada; termo desatualizado dá 409. Sem a correção da auditoria, o `[REG-003f]` falha. Suíte completa da API: 564 testes, 0 falhas.

## Antes do deploy

1. Aplicar `apps/api/drizzle/0029_termo_profissional_status.sql` (tabela nova, nada existente muda).
2. Para exigir novo aceite de todos no futuro (texto novo): `UPDATE professional_term_status SET accepted = false;` e publicar nova versão do termo.

## Decisões fora do código

- A lista de perfis travados é a dos perfis clínicos do sistema (`CLINICAL_ROLES`). Se a clínica quiser outro recorte, é ajuste de uma lista.
- O texto jurídico do termo é o que já estava na tela; revisão jurídica/clínica do conteúdo não foi feita.
