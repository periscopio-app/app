# Preparação para interoperabilidade RNDS

## Estado atual

`apps/api/src/services/rnds.service.ts` constrói localmente um Bundle FHIR R4 experimental. Não valida os perfis oficiais da RNDS, não autentica no serviço, não transmite dados e não demonstra homologação. O endpoint de status usa `prototype` e `not-configured` para refletir isso.

Até existir uma integração autorizada, use apenas payloads e fixtures sintéticos. Não inclua nome, CPF, CNS, data de nascimento ou narrativa clínica real em testes, logs, exemplos, tickets ou ambientes de desenvolvimento.

## Limite de integração proposto

Manter um adaptador próprio entre o modelo interno e o serviço externo, sem chamadas à RNDS dentro das rotas clínicas:

1. Uma camada de aplicação monta um DTO mínimo, a partir do caso e da autorização explícita de uma pessoa com perfil adequado.
2. Um adaptador versionado traduz esse DTO para o modelo FHIR e valida contra o pacote e os perfis oficiais escolhidos para o caso de uso.
3. Um cliente separado realiza a autenticação e o envio apenas no ambiente configurado. A homologação e a produção usam credenciais, URLs e controles de rede distintos.
4. Uma tabela/outbox transacional registra o identificador interno do envio, tenant, ator, versão do mapeamento, estado e tentativas. O payload clínico, tokens e certificados não entram nos logs nem na trilha de transporte.
5. Retries devem ser idempotentes e não duplicar documentos; resposta técnica, correlação e reconciliação precisam ser auditáveis sem replicar o conteúdo clínico.

O adaptador deve rejeitar campos desconhecidos e falhar fechado quando não houver finalidade, autorização, escopo de tenant/escola ou configuração do ambiente. A aplicação não deve inferir diagnóstico, completar CID ou transformar texto clínico para encaixar no padrão externo.

## Portões antes de homologação ou produção

- Confirmar que o município/estabelecimento de saúde é o integrador responsável, seu CNES, o modelo RNDS aplicável e o processo de credenciamento/homologação vigente.
- Obter aprovação do controlador e do encarregado, documentar finalidade/base legal, compartilhamento, retenção, direitos do titular e responsabilidades no contrato de operador; avaliar RIPD para dados sensíveis de crianças.
- Definir minimização por campo e matriz de acesso, incluindo quem autoriza cada envio e como corrigir, cancelar ou reconciliar um registro.
- Usar certificado e credenciais em secret manager, TLS, egress allowlist, rotação, alertas e segregação de ambientes. Produção fica desabilitada por padrão.
- Validar Bundle e respostas com artefatos oficiais/versionados e fixtures fictícias; registrar versão do pacote, testes de contrato, idempotência, falhas/retries e evidências exigidas pelo processo de homologação.
- Fazer revisão de segurança e privacidade, aprovar plano de incidente e executar somente um piloto controlado com autorização formal. Nunca usar produção para testes de carga.

## Fontes oficiais para revalidar ao iniciar o projeto

- [Guia de implementação RNDS FHIR R4](https://fhir.saude.gov.br/)
- [Ambientes de homologação e produção](https://rnds-guia.saude.gov.br/docs/rnds/ambientes/)
- [Credenciamento](https://fhir.saude.gov.br/credenciamento.html)

Os guias e perfis podem mudar. Revalidar as versões publicadas e os requisitos de credenciamento antes de implementar o transporte.
