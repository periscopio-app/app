# Assistente do BI (Python)

Serviço pequeno (FastAPI) que transforma uma pergunta em linguagem natural em um **plano de consulta** da camada
semântica do Periscópio. Quem valida e executa o plano é a API Node, com o escopo do usuário.

## O que ele recebe e devolve
- Recebe: a pergunta (já sem CPF/e-mail/telefone), o catálogo de métricas/dimensões/escolas (só nomes e ids) e até 300 exemplos aprovados.
- Devolve: `{plan, confidence, source, explanation, clarification}`. `source` = `example` (reaproveitou pergunta aprovada), `rules` ou `llm`.
- **Nunca** acessa banco, nunca recebe linhas de dados, nem código, nome ou nascimento de aluno.

## Como ele aprende
1. A gestão aprova perguntas boas (ou corrige o plano) na tela do BI.
2. A API envia as aprovadas como exemplos; o serviço as encontra por similaridade (TF-IDF) e reaproveita o plano,
   respeitando escola/idade/período citados na nova pergunta.
3. Não há treino de modelo sobre dados pessoais: o aprendizado é um conjunto curado de pares pergunta → consulta.

## Rodar local
```
cd apps/bi-rag
pip install -r requirements-dev.txt
python -m pytest -q
BI_RAG_TOKEN=um-segredo uvicorn app:app --port 8765
```
Na API: `BI_RAG_URL=http://localhost:8765` e `BI_RAG_TOKEN=um-segredo` (mesmo valor).

## Privacidade e modelo de linguagem (opcional, desligado)
Sem `ANTHROPIC_API_KEY`, tudo roda por regras + exemplos aprovados, sem custo e sem sair do seu ambiente.
Se a chave for definida, perguntas de baixa confiança passam por um modelo; nesse caso o **texto da pergunta e o catálogo**
(nunca dados de alunos) são enviados ao provedor. Isso é uma decisão de LGPD/contrato: só ligue depois de aprovada.
Modelo configurável por `BI_LLM_MODEL` (padrão: `claude-haiku-4-5-20251001`, o mais barato).
