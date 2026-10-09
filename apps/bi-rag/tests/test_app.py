from fastapi.testclient import TestClient

from app import app
from tests.test_planner import catalog

c = TestClient(app)


def test_exige_token(monkeypatch):
    monkeypatch.setenv("BI_RAG_TOKEN", "segredo")
    r = c.post("/plan", json={"question": "casos por escola", "catalog": catalog()})
    assert r.status_code == 401
    r = c.post("/plan", json={"question": "casos por escola", "catalog": catalog()}, headers={"x-service-token": "errado"})
    assert r.status_code == 401


def test_plano_com_token(monkeypatch):
    monkeypatch.setenv("BI_RAG_TOKEN", "segredo")
    r = c.post("/plan", json={"question": "casos por escola", "catalog": catalog()}, headers={"x-service-token": "segredo"})
    assert r.status_code == 200 and r.json()["plan"]["metric"] == "cases"


def test_sem_token_configurado_recusa_tudo(monkeypatch):
    monkeypatch.delenv("BI_RAG_TOKEN", raising=False)
    r = c.post("/plan", json={"question": "casos por escola", "catalog": catalog()}, headers={"x-service-token": ""})
    assert r.status_code == 401
