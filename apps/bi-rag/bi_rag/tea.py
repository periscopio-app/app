"""Organização textual da Triagem TEA com modelo de linguagem. Desligado se não houver provedor.

Recebe um RESUMO ESTRUTURADO já sem identificador (sem nome, sem código do aluno, sem data de nascimento), com os
comportamentos que a equipe marcou nos formulários e os totais calculados pela API. Devolve o mesmo conteúdo organizado
em seções curtas. NÃO diagnostica, NÃO sugere conduta e NÃO interpreta pontuação: o prompt proíbe e a API Node
revalida a saída (lista de termos proibidos, formato e tamanho) antes de mostrar a qualquer pessoa.
"""
from __future__ import annotations

import json

from bi_rag import llm

SYSTEM_TEA = (
    "Você organiza, em português do Brasil, observações já registradas por profissionais em formulários de triagem. "
    "REGRAS OBRIGATÓRIAS: (1) Use SOMENTE o que está no JSON recebido; não invente fatos, idades, nomes ou números. "
    "(2) Não faça diagnóstico, não diga que há ou não há autismo (TEA), não classifique risco, gravidade ou probabilidade, "
    "não compare com ponto de corte e não recomende tratamento, medicação ou conduta. "
    "(3) Descreva comportamentos de forma observável e neutra ('foi marcado que...', 'a família relatou...'). "
    "(4) Se um instrumento está incompleto ou sem pontuação calculada, diga isso em 'lacunas'. "
    "(5) Termine com perguntas para o profissional responsável avaliar, nunca com respostas. "
    "Responda SOMENTE com JSON: "
    '{"visao_geral":"2 a 3 frases","por_instrumento":[{"instrumento":"ata|asq|mchat|srs2|abc","pontos":["frases curtas"]}],'
    '"lacunas":["..."],"perguntas_ao_profissional":["..."]}'
)


def summarize(digest: dict) -> dict | None:
    """Devolve o JSON organizado pelo modelo, ou None (sem provedor, falha ou resposta inválida)."""
    if not llm.enabled():
        return None
    out = llm.complete_json(json.dumps(digest, ensure_ascii=False), SYSTEM_TEA, max_tokens=1200)
    if not isinstance(out, dict):
        return None
    return out
