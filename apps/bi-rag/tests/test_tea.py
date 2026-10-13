import json

from fastapi.testclient import TestClient

import app as app_module
from bi_rag import llm, tea

client = TestClient(app_module.app)


def _clear(monkeypatch):
    for k in ("GROQ_API_KEY", "GEMINI_API_KEY", "ANTHROPIC_API_KEY", "BI_LLM_PROVIDER", "BI_LLM_MODEL"):
        monkeypatch.delenv(k, raising=False)


def test_prompt_proibe_diagnostico_e_conduta():
    s = tea.SYSTEM_TEA.lower()
    assert "não faça diagnóstico" in s and "não recomende tratamento" in s and "somente o que está no json" in s


def test_sem_provedor_devolve_none(monkeypatch):
    _clear(monkeypatch)
    assert tea.summarize({"instrumentos": []}) is None


def test_endpoint_exige_token(monkeypatch):
    monkeypatch.setenv("BI_RAG_TOKEN", "t")
    assert client.post("/summarize-tea", json={"digest": {}}).status_code == 401
    assert client.post("/summarize-tea", json={"digest": {}}, headers={"x-service-token": "errado"}).status_code == 401


def test_endpoint_sem_provedor_informa_disabled(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("BI_RAG_TOKEN", "t")
    r = client.post("/summarize-tea", json={"digest": {"instrumentos": []}}, headers={"x-service-token": "t"})
    assert r.status_code == 200 and r.json() == {"summary": None, "source": "disabled"}


def test_endpoint_com_provedor_simulado_envia_so_o_digest(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("BI_RAG_TOKEN", "t")
    monkeypatch.setenv("GEMINI_API_KEY", "g"); monkeypatch.setenv("BI_LLM_MODEL", "m")
    seen = {}

    class Resp:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def read(self):
            txt = json.dumps({"visao_geral": "Foram registrados 2 instrumentos.", "por_instrumento": [], "lacunas": [], "perguntas_ao_profissional": []})
            return json.dumps({"candidates": [{"content": {"parts": [{"text": txt}]}}]}).encode()

    def fake(req, timeout=0):
        seen["body"] = json.loads(req.data)
        return Resp()

    monkeypatch.setattr(llm.urllib.request, "urlopen", fake)
    digest = {"instrumentos": [{"codigo": "ata", "marcados": ["Não sorri"]}]}
    r = client.post("/summarize-tea", json={"digest": digest}, headers={"x-service-token": "t"})
    assert r.status_code == 200 and r.json()["source"] == "llm"
    assert r.json()["summary"]["visao_geral"].startswith("Foram registrados")
    sent = json.dumps(seen["body"], ensure_ascii=False)
    assert "Não sorri" in sent
    assert "temperature" in sent and seen["body"]["systemInstruction"]["parts"][0]["text"] == tea.SYSTEM_TEA
