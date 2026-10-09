"""Recuperação por TF-IDF sobre perguntas já aprovadas pela gestão (aprendizado supervisionado, sem treino de modelo)."""
import math
from collections import Counter

from .text import stem, tokens


def _vec(q: str) -> Counter:
    return Counter(stem(t) for t in tokens(q))


def rank(question: str, examples: list[dict], k: int = 5) -> list[tuple[float, dict]]:
    docs = [(_vec(e["question"]), e) for e in examples if e.get("question") and e.get("plan")]
    if not docs:
        return []
    n = len(docs) + 1
    df: Counter = Counter()
    for v, _ in docs:
        df.update(v.keys())
    qv = _vec(question)
    df.update(qv.keys())

    def w(v: Counter) -> dict[str, float]:
        return {t: (1 + math.log(c)) * (math.log(n / (1 + df[t])) + 1) for t, c in v.items()}

    qw = w(qv)
    qn = math.sqrt(sum(x * x for x in qw.values())) or 1.0
    out = []
    for v, e in docs:
        dw = w(v)
        dn = math.sqrt(sum(x * x for x in dw.values())) or 1.0
        dot = sum(qw.get(t, 0.0) * x for t, x in dw.items())
        out.append((dot / (qn * dn), e))
    out.sort(key=lambda x: x[0], reverse=True)
    return out[:k]
