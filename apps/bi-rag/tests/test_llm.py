import json

from bi_rag import llm


def _clear(monkeypatch):
    for k in ("GEMINI_API_KEY", "ANTHROPIC_API_KEY", "BI_LLM_PROVIDER", "BI_LLM_MODEL"):
        monkeypatch.delenv(k, raising=False)


def test_desligado_por_padrao(monkeypatch):
    _clear(monkeypatch)
    assert llm.provider() is None and not llm.enabled()
    assert llm.plan_with_llm("casos por escola", {}, []) is None


def test_gemini_exige_chave_e_modelo(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    assert llm.provider() is None
    monkeypatch.setenv("BI_LLM_MODEL", "modelo-x")
    assert llm.provider() == "gemini"


def test_provedor_forcado(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "a")
    monkeypatch.setenv("GEMINI_API_KEY", "g")
    monkeypatch.setenv("BI_LLM_MODEL", "m")
    monkeypatch.setenv("BI_LLM_PROVIDER", "anthropic")
    assert llm.provider() == "anthropic"


def test_gemini_resposta_valida_e_requisicao(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("GEMINI_API_KEY", "segredo")
    monkeypatch.setenv("BI_LLM_MODEL", "models/modelo-x")
    seen = {}

    class Resp:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def read(self):
            return json.dumps({"candidates": [{"content": {"parts": [{"text": '{"metric":"cases","groupBy":["school"]}'}]}}]}).encode()

    def fake(req, timeout=0):
        seen["url"], seen["headers"], seen["body"] = req.full_url, dict(req.header_items()), json.loads(req.data)
        return Resp()

    monkeypatch.setattr(llm.urllib.request, "urlopen", fake)
    out = llm.plan_with_llm("casos por escola", {"metrics": []}, [])
    assert out == {"metric": "cases", "groupBy": ["school"]}
    assert "models/modelo-x:generateContent" in seen["url"] and "segredo" not in seen["url"]
    assert seen["body"]["generationConfig"]["responseMimeType"] == "application/json"


def test_falha_do_provedor_devolve_none(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("GEMINI_API_KEY", "g")
    monkeypatch.setenv("BI_LLM_MODEL", "m")
    def boom(*a, **k): raise OSError("rede")
    monkeypatch.setattr(llm.urllib.request, "urlopen", boom)
    assert llm.plan_with_llm("x", {}, []) is None
