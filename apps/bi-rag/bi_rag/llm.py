"""Planejamento opcional com modelo de linguagem. Desligado por padrão.

Só roda se houver chave de um provedor (GEMINI_API_KEY ou ANTHROPIC_API_KEY). Envia: a pergunta (já sem CPF/e-mail/telefone), o catálogo de métricas
e alguns exemplos aprovados. Nunca envia linhas de dados nem identificadores de aluno — o Python não tem acesso a eles.
"""
from __future__ import annotations

import json
import os
import urllib.request

SYSTEM = (
    "Você traduz perguntas de gestores escolares em um plano de consulta JSON para um BI. "
    "Responda SOMENTE com JSON no formato {\"metric\":..., \"groupBy\":[...], \"filters\":{...}, \"viz\":\"table|bar|line\"}. "
    "Use apenas métricas, dimensões e filtros do catálogo. Nunca invente campos. "
    "Se a pergunta pedir aluno identificável, diagnóstico, prescrição ou conduta clínica, responda {\"refuse\":true}. "
    "Se faltar informação, responda {\"clarify\":\"pergunta curta\"}."
)


def provider() -> str | None:
    """Escolhe o provedor. BI_LLM_PROVIDER=gemini|anthropic força; sem isso, usa o que tiver chave."""
    forced = os.environ.get("BI_LLM_PROVIDER", "").strip().lower()
    if forced == "gemini":
        return "gemini" if os.environ.get("GEMINI_API_KEY") and os.environ.get("BI_LLM_MODEL") else None
    if forced == "anthropic":
        return "anthropic" if os.environ.get("ANTHROPIC_API_KEY") else None
    if os.environ.get("GEMINI_API_KEY") and os.environ.get("BI_LLM_MODEL"):
        return "gemini"
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "anthropic"
    return None


def enabled() -> bool:
    return provider() is not None


def _prompt(question: str, catalog: dict, examples: list[dict]) -> str:
    return json.dumps({"catalogo": catalog, "exemplos_aprovados": examples[:5], "pergunta": question}, ensure_ascii=False)


def _parse(text: str) -> dict | None:
    text = (text or "").strip()
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < 0:
        return None
    out = json.loads(text[start : end + 1])
    return out if isinstance(out, dict) else None


def _call_gemini(prompt: str) -> str:
    model = os.environ["BI_LLM_MODEL"].removeprefix("models/")
    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0, "maxOutputTokens": 400, "responseMimeType": "application/json"},
    }
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": os.environ["GEMINI_API_KEY"]},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:  # noqa: S310 - URL fixa
        data = json.loads(resp.read())
    parts = data["candidates"][0]["content"]["parts"]
    return "".join(p.get("text", "") for p in parts)


def _call_anthropic(prompt: str) -> str:
    import anthropic  # import tardio: o serviço sobe sem a dependência configurada

    msg = anthropic.Anthropic().messages.create(
        model=os.environ.get("BI_LLM_MODEL", "claude-haiku-4-5-20251001"),
        max_tokens=400,
        system=SYSTEM,
        messages=[{"role": "user", "content": prompt}],
        timeout=20,
    )
    return "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")


def plan_with_llm(question: str, catalog: dict, examples: list[dict]) -> dict | None:
    which = provider()
    if not which:
        return None
    try:
        prompt = _prompt(question, catalog, examples)
        text = _call_gemini(prompt) if which == "gemini" else _call_anthropic(prompt)
        return _parse(text)
    except Exception:
        return None  # qualquer falha cai nas regras; nunca derruba a pergunta
