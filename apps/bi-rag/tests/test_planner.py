from datetime import date

from bi_rag.planner import make_plan

TODAY = date(2026, 10, 8)
S1, S2 = "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"


def catalog():
    dims = {
        "school": "Escola", "age_bracket": "Faixa etária do aluno", "journey_state": "Etapa", "month": "Mês",
        "specialty": "Especialidade", "delegation_status": "Situação", "age_band": "Faixa (base)", "complaint": "Queixa", "service": "Serviço",
    }
    live = ["schoolId", "ageBracket", "from", "to"]
    return {
        "dimensions": dims,
        "schools": [{"id": S1, "name": "Escola Maria Antonia Beneli"}, {"id": S2, "name": "EMEF Gilberto Lex"}],
        "metrics": [
            {"id": "students", "label": "Alunos cadastrados", "dims": ["school", "age_bracket", "month"], "filters": live, "synonyms": ["alunos"]},
            {"id": "cases", "label": "Casos abertos", "dims": ["school", "age_bracket", "journey_state", "month"], "filters": live + ["journeyState"], "synonyms": ["casos"]},
            {"id": "case_cycle_days", "label": "Tempo médio", "dims": ["school", "age_bracket", "month"], "filters": live, "synonyms": ["tempo medio"]},
            {"id": "delegations", "label": "Delegações", "dims": ["school", "specialty", "delegation_status", "month"], "filters": ["schoolId", "specialty", "from", "to"], "synonyms": ["delegacoes"]},
            {"id": "population_total", "label": "Base populacional", "dims": ["school"], "filters": ["schoolId"], "synonyms": ["taruma"]},
            {"id": "population_by_age", "label": "Base por idade", "dims": ["school", "age_band"], "filters": ["schoolId"], "synonyms": []},
            {"id": "population_by_complaint", "label": "Queixas", "dims": ["school", "complaint"], "filters": ["schoolId"], "synonyms": ["queixas"]},
            {"id": "population_by_service", "label": "Demanda por serviço", "dims": ["school", "service"], "filters": ["schoolId"], "synonyms": ["demanda"]},
            {"id": "professionals_needed", "label": "Profissionais necessários", "dims": ["school", "service"], "filters": ["schoolId"], "synonyms": ["profissionais"]},
        ],
    }


def ask(q, examples=None):
    return make_plan(q, catalog(), examples or [], TODAY)


def test_casos_por_escola():
    r = ask("Quantos casos temos por escola?")
    assert r["plan"]["metric"] == "cases" and r["plan"]["groupBy"] == ["school"]


def test_tempo_medio_por_mes_com_periodo():
    r = ask("Qual o tempo médio até o encerramento por mês nos últimos 6 meses?")
    p = r["plan"]
    assert p["metric"] == "case_cycle_days"
    assert "month" in p["groupBy"]
    assert p["filters"]["from"] == "2026-05"


def test_profissionais_por_servico():
    r = ask("Quantos profissionais precisamos contratar por serviço?")
    assert r["plan"]["metric"] == "professionals_needed" and "service" in r["plan"]["groupBy"]


def test_queixas_exige_agrupar_por_queixa():
    r = ask("Quais as queixas mais registradas em Tarumã?")
    assert r["plan"]["metric"] == "population_by_complaint" and "complaint" in r["plan"]["groupBy"]


def test_filtro_de_escola_e_idade():
    r = ask("casos de alunos de 10 a 12 anos na Escola Maria Antonia Beneli por etapa")
    p = r["plan"]
    assert p["filters"]["schoolId"] == S1 and p["filters"]["ageBracket"] == "10-12"
    assert p["groupBy"] == ["journey_state"]


def test_delegacoes_por_especialidade():
    r = ask("delegações para fonoaudiologia")
    assert r["plan"]["metric"] == "delegations" and r["plan"]["filters"]["specialty"] == "fonoaudiologia"


def test_recusa_pedido_individual_e_diagnostico():
    for q in ["qual aluno tem autismo?", "me dê a lista de alunos da escola", "o CPF do aluno", "quem tem tdah"]:
        r = ask(q)
        assert r["plan"] is None and "individualmente" in r["clarification"], q


def test_pergunta_sem_sentido_pede_esclarecimento():
    r = ask("bom dia como vai")
    assert r["plan"] is None and r["clarification"]


def test_exemplo_aprovado_e_reutilizado_e_respeita_escola_nova():
    ex = [{"question": "casos encerrados por escola neste ano", "plan": {"metric": "cases", "groupBy": ["school"], "filters": {"journeyState": "encerrado", "schoolId": "00000000-0000-4000-8000-000000000000"}}}]
    r = ask("casos encerrados por escola neste ano", ex)
    assert r["source"] == "example"
    assert "schoolId" not in r["plan"]["filters"]  # escola do exemplo não existe mais no catálogo
    assert r["plan"]["filters"]["journeyState"] == "encerrado"


def test_aprendizado_muda_a_resposta():
    q = "panorama da rede"
    assert ask(q)["plan"] is None
    ex = [{"question": "panorama da rede", "plan": {"metric": "cases", "groupBy": ["school"], "filters": {}}}]
    assert ask(q, ex)["plan"]["metric"] == "cases"
