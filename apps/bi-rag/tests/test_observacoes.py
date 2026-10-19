import json

from fastapi.testclient import TestClient

import app as app_module
from bi_rag import llm, observacoes

client = TestClient(app_module.app)


def _clear(monkeypatch):
    for k in ("GROQ_API_KEY", "GEMINI_API_KEY", "ANTHROPIC_API_KEY", "BI_LLM_PROVIDER", "BI_LLM_MODEL"):
        monkeypatch.delenv(k, raising=False)


def test_prompt_proibe_diagnostico_e_conduta():
    s = observacoes.SYSTEM_OBS.lower()
    assert "não faça diagnóstico" in s and "não recomende" in s and "somente o que está no json" in s


def test_sem_provedor_devolve_none(monkeypatch):
    _clear(monkeypatch)
    assert observacoes.draft({"respostas": []}) is None


def test_endpoint_exige_token(monkeypatch):
    monkeypatch.setenv("BI_RAG_TOKEN", "t")
    assert client.post("/draft-observations", json={"payload": {}}).status_code == 401
    assert client.post("/draft-observations", json={"payload": {}}, headers={"x-service-token": "x"}).status_code == 401


def test_endpoint_sem_provedor_informa_disabled(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("BI_RAG_TOKEN", "t")
    r = client.post("/draft-observations", json={"payload": {"respostas": []}}, headers={"x-service-token": "t"})
    assert r.status_code == 200 and r.json() == {"draft": None, "source": "disabled"}


def test_endpoint_com_provedor_simulado(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("BI_RAG_TOKEN", "t")
    monkeypatch.setenv("GEMINI_API_KEY", "g"); monkeypatch.setenv("BI_LLM_MODEL", "m")
    seen = {}

    class Resp:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def read(self):
            txt = json.dumps({"texto": "Foi relatado que a criança gosta de ir à escola."})
            return json.dumps({"candidates": [{"content": {"parts": [{"text": txt}]}}]}).encode()

    def fake(req, timeout=0):
        seen["body"] = json.loads(req.data)
        return Resp()

    monkeypatch.setattr(llm.urllib.request, "urlopen", fake)
    r = client.post("/draft-observations", json={"payload": {"respostas": [{"pergunta": "Gosta da escola?", "resposta": "Sim"}]}}, headers={"x-service-token": "t"})
    assert r.status_code == 200 and r.json()["source"] == "llm"
    assert r.json()["draft"]["texto"].startswith("Foi relatado")
    assert "Gosta da escola?" in json.dumps(seen["body"], ensure_ascii=False)
    assert seen["body"]["systemInstruction"]["parts"][0]["text"] == observacoes.SYSTEM_OBS


def test_resposta_fora_do_formato_vira_none(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("GEMINI_API_KEY", "g"); monkeypatch.setenv("BI_LLM_MODEL", "m")
    monkeypatch.setattr(llm, "complete_json", lambda *a, **k: {"outro": 1})
    assert observacoes.draft({"respostas": []}) is None
