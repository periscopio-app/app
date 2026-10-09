"""O conjunto de aprendizado inicial (seed) precisa ser coerente com o catálogo e realmente ser reaproveitado."""
import json
import re
from pathlib import Path

from bi_rag.planner import make_plan
from tests.test_planner import TODAY, catalog

SEED = json.loads((Path(__file__).resolve().parent.parent / "seed" / "bi_examples_taruma.json").read_text(encoding="utf-8"))
EX = SEED["examples"]


def test_seed_tem_forma_valida():
    cat = {m["id"]: m for m in catalog()["metrics"]}
    assert len(EX) >= 50 and len({e["question"] for e in EX}) == len(EX)
    for e in EX:
        p = e["plan"]
        m = cat[p["metric"]]
        assert set(p["groupBy"]) <= set(m["dims"]), e["question"]
        assert set(p["filters"]) <= set(m["filters"]), e["question"]
        assert "schoolId" not in p["filters"], "seed não carrega id de escola"
        assert not re.search(r"\d{3}\.\d{3}\.\d{3}-\d{2}|@|\d{4}-\d{4}", e["question"])


def test_pergunta_do_seed_e_reaproveitada():
    for e in EX:
        r = make_plan(e["question"], catalog(), EX, TODAY)
        assert r["source"] == "example", e["question"]
        assert r["plan"]["metric"] == e["plan"]["metric"] and r["plan"]["groupBy"] == e["plan"]["groupBy"], e["question"]


def test_escola_citada_vence_o_plano_do_seed():
    r = make_plan("Casos registrados por escola no Tarumã na Escola Maria Antonia Beneli", catalog(), EX, TODAY)
    assert r["plan"]["metric"] == "population_total"


def test_regras_sozinhas_entendem_o_vocabulario_de_taruma():
    cases = {
        "e a agressividade, quantos casos?": "population_by_complaint",
        "quantos precisam de fonoaudiologia": "population_by_service",
        "quantos alunos têm ansiedade": "population_by_complaint",
        "quantos casos com dificuldade de matemática": "population_by_complaint",
    }
    for q, metric in cases.items():
        r = make_plan(q, catalog(), [], TODAY)
        assert r["plan"] and r["plan"]["metric"] == metric, q
        assert r["plan"]["groupBy"], q
