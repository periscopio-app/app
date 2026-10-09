"""Planejamento opcional com modelo de linguagem. Desligado por padrão.

Só roda se ANTHROPIC_API_KEY existir. Envia: a pergunta (já sem CPF/e-mail/telefone), o catálogo de métricas
e alguns exemplos aprovados. Nunca envia linhas de dados nem identificadores de aluno — o Python não tem acesso a eles.
"""
from __future__ import annotations

import json
import os

SYSTEM = (
    "Você traduz perguntas de gestores escolares em um plano de consulta JSON para um BI. "
    "Responda SOMENTE com JSON no formato {\"metric\":..., \"groupBy\":[...], \"filters\":{...}, \"viz\":\"table|bar|line\"}. "
    "Use apenas métricas, dimensões e filtros do catálogo. Nunca invente campos. "
    "Se a pergunta pedir aluno identificável, diagnóstico, prescrição ou conduta clínica, responda {\"refuse\":true}. "
    "Se faltar informação, responda {\"clarify\":\"pergunta curta\"}."
)


def enabled() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def plan_with_llm(question: str, catalog: dict, examples: list[dict]) -> dict | None:
    if not enabled():
        return None
    try:
        import anthropic  # import tardio: o serviço sobe sem a dependência configurada

        client = anthropic.Anthropic()
        prompt = json.dumps(
            {"catalogo": catalog, "exemplos_aprovados": examples[:5], "pergunta": question}, ensure_ascii=False
        )
        msg = client.messages.create(
            model=os.environ.get("BI_LLM_MODEL", "claude-haiku-4-5-20251001"),
            max_tokens=400,
            system=SYSTEM,
            messages=[{"role": "user", "content": prompt}],
            timeout=20,
        )
        text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text").strip()
        start, end = text.find("{"), text.rfind("}")
        if start < 0 or end < 0:
            return None
        return json.loads(text[start : end + 1])
    except Exception:
        return None
