"""Normalização de texto em português: minúsculas, sem acento, tokens úteis."""
import re
import unicodedata

STOP = {
    "a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas", "um", "uma",
    "por", "para", "pra", "com", "que", "qual", "quais", "quantos", "quantas", "quanto", "quanta", "me", "mostre",
    "mostra", "ver", "veja", "dame", "gostaria", "quero", "preciso", "sao", "ha", "tem", "temos", "ao", "aos", "se",
}


def fold(s: str) -> str:
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9+\-/ ]+", " ", s)


def tokens(s: str) -> list[str]:
    return [t for t in re.split(r"\s+", fold(s).strip()) if t and t not in STOP]


def stem(t: str) -> str:
    # radical grosseiro o bastante para plural/gênero: "escolas"→"escol", "encerrados"→"encerr"
    return re.sub(r"(s|es|a|o|as|os|ao|oes|ais|is)$", "", t) if len(t) > 4 else t
