import json

from bi_rag import llm


def _clear(monkeypatch):
    for k in ("GROQ_API_KEY", "GEMINI_API_KEY", "ANTHROPIC_API_KEY", "BI_LLM_PROVIDER", "BI_LLM_MODEL"):
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


def test_groq_exige_chave_e_modelo_e_envia_requisicao_compativel_openai(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("GROQ_API_KEY", "gsk_segredo")
    assert llm.provider() is None
    monkeypatch.setenv("BI_LLM_MODEL", "modelo-groq")
    assert llm.provider() == "groq"
    seen = {}

    class Resp:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def read(self):
            return json.dumps({"choices": [{"message": {"content": '{"metric":"cases","groupBy":["school"]}'}}]}).encode()

    def fake(req, timeout=0):
        seen["url"], seen["headers"], seen["body"] = req.full_url, {k.lower(): v for k, v in req.header_items()}, json.loads(req.data)
        return Resp()

    monkeypatch.setattr(llm.urllib.request, "urlopen", fake)
    out = llm.plan_with_llm("casos por escola", {"metrics": []}, [])
    assert out == {"metric": "cases", "groupBy": ["school"]}
    assert seen["url"] == "https://api.groq.com/openai/v1/chat/completions"
    assert "gsk_segredo" not in seen["url"] and seen["headers"]["authorization"] == "Bearer gsk_segredo"
    assert seen["body"]["model"] == "modelo-groq" and seen["body"]["response_format"] == {"type": "json_object"}
    assert "reasoning_effort" not in seen["body"]
    assert seen["body"]["messages"][0]["role"] == "system"


def test_groq_vence_gemini_e_provedor_forcado_respeita(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("GROQ_API_KEY", "q"); monkeypatch.setenv("GEMINI_API_KEY", "g"); monkeypatch.setenv("BI_LLM_MODEL", "m")
    assert llm.provider() == "groq"
    monkeypatch.setenv("BI_LLM_PROVIDER", "gemini")
    assert llm.provider() == "gemini"


def test_groq_gpt_oss_usa_raciocinio_baixo_e_cai_para_sem_modo_json_no_400(monkeypatch):
    import io, urllib.error
    _clear(monkeypatch)
    monkeypatch.setenv("GROQ_API_KEY", "q"); monkeypatch.setenv("BI_LLM_MODEL", "openai/gpt-oss-120b")
    bodies = []

    class Resp:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def read(self): return json.dumps({"choices": [{"message": {"content": 'texto {"metric":"cases"} fim'}}]}).encode()

    def fake(req, timeout=0):
        bodies.append(json.loads(req.data))
        if len(bodies) == 1:
            raise urllib.error.HTTPError(req.full_url, 400, "bad", {}, io.BytesIO(b"{}"))
        return Resp()

    monkeypatch.setattr(llm.urllib.request, "urlopen", fake)
    assert llm.plan_with_llm("x", {}, []) == {"metric": "cases"}
    assert bodies[0]["reasoning_effort"] == "low" and bodies[0]["max_completion_tokens"] >= 1000
    assert "response_format" in bodies[0] and "response_format" not in bodies[1]
