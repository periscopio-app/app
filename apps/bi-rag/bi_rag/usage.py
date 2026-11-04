"""Contagem de tokens gastos pelas chamadas ao modelo, por requisição.

Cada endpoint abre uma contagem (`begin`), o módulo `llm` registra o gasto de cada chamada (`record`) e o endpoint
devolve a lista junto da resposta (`collect`). A API Node soma esses números nas métricas. Só guarda provedor, modelo,
quantidade de tokens e se a chamada deu certo: nunca o texto enviado nem o recebido.
"""
from __future__ import annotations

from contextvars import ContextVar

_current: ContextVar[list[dict] | None] = ContextVar("bi_rag_usage", default=None)


def begin() -> None:
    _current.set([])


def record(provider: str, model: str, input_tokens: int | None, output_tokens: int | None, ok: bool = True) -> None:
    items = _current.get()
    if items is None:
        return
    items.append(
        {
            "provider": provider,
            "model": model,
            "input_tokens": max(int(input_tokens or 0), 0),
            "output_tokens": max(int(output_tokens or 0), 0),
            "ok": bool(ok),
        }
    )


def collect() -> list[dict]:
    items = _current.get() or []
    _current.set(None)
    return list(items)
