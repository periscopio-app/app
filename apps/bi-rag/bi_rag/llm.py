"""Planejamento opcional com modelo de linguagem. Desligado por padrão.

Só roda se houver chave de um provedor (GROQ_API_KEY, GEMINI_API_KEY ou ANTHROPIC_API_KEY). Envia: a pergunta (já sem CPF/e-mail/telefone), o catálogo de métricas
e alguns exemplos aprovados. Nunca envia linhas de dados nem identificadores de aluno — o Python não tem acesso a eles.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

GLOSSARIO = (
    "Guia do domínio (base populacional de Tarumã e jornada do Periscópio): "
    "• Perguntas sobre queixa, motivo de encaminhamento, agressividade, falta de atenção, hiperatividade, indisciplina, "
    "atraso de fala e linguagem, escrita, leitura, matemática, ansiedade, humor ou ajustamento → metric population_by_complaint com groupBy [\"complaint\"] "
    "(a base não filtra por uma queixa só: devolva todas as queixas). "
    "• Perguntas sobre quantos casos precisam de fonoaudiologia, neuropsicologia, psicoterapia, psicopedagogia, psicomotricidade, assistência social "
    "ou consulta médica → population_by_service com groupBy [\"service\"]. "
    "• Quantos profissionais, contratar, equipe necessária → professionals_needed (groupBy service e/ou school). "
    "• Idade ou faixa etária na base populacional → population_by_age com groupBy [\"age_band\"]; idade dos alunos cadastrados ou dos casos abertos → age_bracket. "
    "• Casos registrados, Tarumã, prevalência → population_total; casos abertos, andamento, etapa → cases; "
    "tempo até encerrar → case_cycle_days; delegações e especialidades → delegations. "
    "• Um caso pode ter várias queixas e vários serviços, então essas linhas não somam o total. "
    "• Grupos com menos de 5 casos são ocultados pelo sistema; não tente contornar isso e não peça aluno individual."
)

SYSTEM = (
    "Você traduz perguntas de gestores escolares em um plano de consulta JSON para um BI. "
    "Responda SOMENTE com JSON no formato {\"metric\":..., \"groupBy\":[...], \"filters\":{...}, \"viz\":\"table|bar|line\"}. "
    "Use apenas métricas, dimensões e filtros do catálogo. Nunca invente campos. "
    "Se a pergunta pedir aluno identificável, diagnóstico, prescrição ou conduta clínica, responda {\"refuse\":true}. "
    "Se faltar informação, responda {\"clarify\":\"pergunta curta\"}. "
    + GLOSSARIO
)


def provider() -> str | None:
    """Escolhe o provedor. BI_LLM_PROVIDER=groq|gemini|anthropic força; sem isso, usa o que tiver chave."""
    forced = os.environ.get("BI_LLM_PROVIDER", "").strip().lower()
    if forced == "groq":
        return "groq" if os.environ.get("GROQ_API_KEY") and os.environ.get("BI_LLM_MODEL") else None
    if forced == "gemini":
        return "gemini" if os.environ.get("GEMINI_API_KEY") and os.environ.get("BI_LLM_MODEL") else None
    if forced == "anthropic":
        return "anthropic" if os.environ.get("ANTHROPIC_API_KEY") else None
    if os.environ.get("GROQ_API_KEY") and os.environ.get("BI_LLM_MODEL"):
        return "groq"
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


def _call_groq(prompt: str) -> str:
    """Groq (API compatível com OpenAI). O ID do modelo vem de BI_LLM_MODEL (ex.: openai/gpt-oss-120b)."""
    model = os.environ["BI_LLM_MODEL"]
    body = {
        "model": model,
        "temperature": 0,
        # modelos de raciocínio gastam parte do limite pensando: folga para o JSON não sair cortado
        "max_completion_tokens": 1500,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}],
    }
    if "gpt-oss" in model:
        body["reasoning_effort"] = "low"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {os.environ['GROQ_API_KEY']}",
        "User-Agent": "periscopio-bi-rag/1.0",
    }

    def post(payload: dict) -> dict:
        req = urllib.request.Request(
            "https://api.groq.com/openai/v1/chat/completions", data=json.dumps(payload).encode(), headers=headers, method="POST"
        )
        with urllib.request.urlopen(req, timeout=25) as resp:  # noqa: S310 - URL fixa
            return json.loads(resp.read())

    try:
        data = post(body)
    except urllib.error.HTTPError as e:
        if e.code != 400:
            raise
        body.pop("response_format")  # modelo sem modo JSON: o _parse extrai o JSON do texto
        data = post(body)
    return data["choices"][0]["message"].get("content") or ""


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
        call = {"groq": _call_groq, "gemini": _call_gemini}.get(which, _call_anthropic)
        text = call(prompt)
        return _parse(text)
    except Exception:
        return None  # qualquer falha cai nas regras; nunca derruba a pergunta
