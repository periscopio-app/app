"""Orquestra: exemplo aprovado → regras → (opcional) modelo. O Node valida o plano final; aqui só se propõe."""
from __future__ import annotations

from datetime import date

from . import llm
from .retrieval import rank
from .rules import REFUSAL, REFUSE, detect_age, detect_period, detect_school, plan_from_rules
from .text import fold

REUSE_THRESHOLD = 0.8
LLM_BELOW = 0.6


def _apply_overrides(plan: dict, question: str, catalog: dict, today: date) -> dict:
    """Reaproveita o plano de um exemplo, mas respeita escola/idade/período citados agora na pergunta."""
    metric = next((m for m in catalog["metrics"] if m["id"] == plan.get("metric")), None)
    if not metric:
        return plan
    allowed = set(metric["filters"])
    flt = dict(plan.get("filters") or {})
    valid_schools = {s["id"] for s in catalog.get("schools", [])}
    if flt.get("schoolId") and flt["schoolId"] not in valid_schools:
        flt.pop("schoolId")
    sid = detect_school(question, catalog.get("schools", []))
    if sid and "schoolId" in allowed:
        flt["schoolId"] = sid
    age = detect_age(question)
    if age and "ageBracket" in allowed:
        flt["ageBracket"] = age
    frm, to = detect_period(question, today)
    if frm and "from" in allowed:
        flt["from"] = frm
    if to and "to" in allowed:
        flt["to"] = to
    return {**plan, "filters": flt}


def make_plan(question: str, catalog: dict, examples: list[dict], today: date | None = None) -> dict:
    today = today or date.today()
    if REFUSE.search(fold(question)):
        return {"plan": None, "confidence": 0.0, "source": "rules", "clarification": REFUSAL, "explanation": None}

    ranked = rank(question, examples)
    if ranked and ranked[0][0] >= REUSE_THRESHOLD:
        score, ex = ranked[0]
        return {
            "plan": _apply_overrides(ex["plan"], question, catalog, today),
            "confidence": round(min(0.99, score), 2),
            "source": "example",
            "explanation": "Reaproveitei uma pergunta parecida já validada pela gestão.",
            "clarification": None,
        }

    out = plan_from_rules(question, catalog, today)
    if out["confidence"] < LLM_BELOW and llm.enabled():
        got = llm.plan_with_llm(question, catalog, [e for _, e in ranked])
        if got and got.get("refuse"):
            return {"plan": None, "confidence": 0.0, "source": "llm", "clarification": REFUSAL, "explanation": None}
        if got and got.get("clarify"):
            return {"plan": None, "confidence": 0.0, "source": "llm", "clarification": str(got["clarify"])[:300], "explanation": None}
        if got and got.get("metric"):
            return {
                "plan": {k: got[k] for k in ("metric", "groupBy", "filters", "viz") if k in got},
                "confidence": 0.7, "source": "llm", "clarification": None,
                "explanation": "Interpretei a pergunta com o assistente de linguagem.",
            }
    return out
