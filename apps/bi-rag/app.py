"""Serviço do assistente do BI. Sem banco de dados e sem dados de aluno: recebe a pergunta + catálogo + exemplos aprovados
e devolve um plano de consulta. Quem valida e executa o plano é a API Node, com o escopo do usuário."""
import hmac
import os

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from bi_rag.planner import make_plan
from bi_rag.tea import summarize as summarize_tea

app = FastAPI(title="Periscópio BI — assistente", docs_url=None, redoc_url=None)


class PlanRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    role: str = ""
    catalog: dict
    examples: list[dict] = Field(default_factory=list, max_length=300)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/plan")
def plan(req: PlanRequest, x_service_token: str = Header(default="")):
    expected = os.environ.get("BI_RAG_TOKEN", "")
    if not expected or not hmac.compare_digest(x_service_token, expected):
        raise HTTPException(status_code=401, detail="não autorizado")
    return make_plan(req.question, req.catalog, req.examples)


class TeaRequest(BaseModel):
    """Resumo já sem identificador, montado pela API Node a partir dos formulários enviados."""
    digest: dict


@app.post("/summarize-tea")
def summarize_tea_route(req: TeaRequest, x_service_token: str = Header(default="")):
    expected = os.environ.get("BI_RAG_TOKEN", "")
    if not expected or not hmac.compare_digest(x_service_token, expected):
        raise HTTPException(status_code=401, detail="não autorizado")
    if len(str(req.digest)) > 60_000:
        raise HTTPException(status_code=413, detail="resumo grande demais")
    out = summarize_tea(req.digest)
    return {"summary": out, "source": "llm" if out else "disabled"}
