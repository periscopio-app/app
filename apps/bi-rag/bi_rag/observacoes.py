"""Rascunho de observações do Formulário do RE com modelo de linguagem. Desligado se não houver provedor.

Recebe só rótulos e respostas já registrados (sem nome, sem código do aluno, sem nascimento). Devolve um texto curto,
descritivo e neutro para o RE REVISAR e aceitar ou descartar. NÃO diagnostica, NÃO classifica risco, NÃO sugere conduta.
A API Node revalida a saída (termos proibidos, números, tamanho) antes de mostrar.
"""
from __future__ import annotations

import json

from bi_rag import llm

SYSTEM_OBS = (
    "Você ajuda uma profissional da escola (Responsável Escolar) a redigir o campo 'Observações' de um formulário, "
    "em português do Brasil, com linguagem simples e observável. "
    "REGRAS OBRIGATÓRIAS: (1) Use SOMENTE o que está no JSON recebido; não invente fatos, nomes, idades, datas ou números. "
    "(2) Não faça diagnóstico, não diga que há ou não há autismo (TEA) ou TDAH, não classifique risco, gravidade ou probabilidade "
    "e não recomende tratamento, medicação, encaminhamento ou conduta. "
    "(3) Descreva de forma neutra ('foi relatado que...', 'foi marcado que...'). "
    "(4) Se houver 'texto_atual', preserve o sentido e as informações dele, apenas organizando e deixando mais claro. "
    "(5) Se faltarem respostas, diga em uma frase quais temas ficaram sem registro, sem supor o que seria. "
    "(6) No máximo 900 caracteres, em um ou dois parágrafos curtos, sem listas. "
    'Responda SOMENTE com JSON: {"texto":"..."}'
)


def draft(payload: dict) -> dict | None:
    """Devolve {"texto": ...} ou None (sem provedor, falha ou resposta inválida)."""
    if not llm.enabled():
        return None
    out = llm.complete_json(json.dumps(payload, ensure_ascii=False), SYSTEM_OBS, max_tokens=700)
    if not isinstance(out, dict) or not isinstance(out.get("texto"), str):
        return None
    return {"texto": out["texto"]}
