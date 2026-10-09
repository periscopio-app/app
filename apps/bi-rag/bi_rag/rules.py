"""Planejador por regras: transforma a pergunta em um plano de consulta da camada semântica.

Funciona sem modelo de linguagem e sem custo. Nunca produz SQL: só escolhe métrica, agrupamentos e filtros
que existem no catálogo recebido. Pedidos sobre pessoas identificáveis ou diagnóstico são recusados.
"""
from __future__ import annotations

import re
from datetime import date

from .text import fold, stem, tokens

REFUSE = re.compile(
    r"\b(qual aluno|quais alunos|nome do aluno|nomes dos alunos|lista de alunos|listar alunos|quem e o aluno|"
    r"cpf|endereco do aluno|telefone|diagnostic|diagnose|tem autismo|tem tdah|e autista|prescrev|remedio|medicamento|"
    r"identificar|reidentific)\b"
)

REFUSAL = (
    "O BI não mostra alunos individualmente nem faz diagnóstico. Posso responder com contagens agregadas "
    "(por escola, faixa etária, etapa da jornada, mês ou serviço), sempre ocultando grupos com menos de 5 casos."
)

MONTHS = {
    "janeiro": 1, "fevereiro": 2, "marco": 3, "abril": 4, "maio": 5, "junho": 6, "julho": 7,
    "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12,
}

STATE_WORDS = [
    ("encerrad", "encerrado"), ("rascunho", "rascunho"), ("revisao medica", "revisao_medica"),
    ("em revisao", "revisao_medica"), ("delegad", "delegado"), ("retornad", "retornado"),
    ("enviado pelo re", "enviado_re"), ("enviado ao medico", "enviado_re"),
]
SPECIALTY_WORDS = [
    ("fono", "fonoaudiologia"), ("medic", "medicina"), ("psicolog", "psicologia"), ("psicopedag", "psicopedagogia"),
    ("psicomot", "psicomotricidade"), ("servico social", "servico_social"), ("assistencia social", "servico_social"),
]

# (frase, métrica, peso)
INTENTS: list[tuple[str, str, float]] = [
    ("tempo medio", "case_cycle_days", 4), ("quantos dias", "case_cycle_days", 4), ("demora", "case_cycle_days", 3),
    ("prazo", "case_cycle_days", 2), ("duracao", "case_cycle_days", 3), ("ate o encerramento", "case_cycle_days", 3),
    ("profissiona", "professionals_needed", 4), ("contratar", "professionals_needed", 4),
    ("equipe necessaria", "professionals_needed", 4), ("capacidade", "professionals_needed", 2),
    ("queixa", "population_by_complaint", 4), ("motivo", "population_by_complaint", 3),
    ("dificuldade", "population_by_complaint", 2),
    ("demanda", "population_by_service", 3), ("servico", "population_by_service", 3),
    ("psicoterapia", "population_by_service", 2), ("neuropsicologia", "population_by_service", 2),
    ("delega", "delegations", 4), ("especialidade", "delegations", 2), ("especialista", "delegations", 2),
    ("alunos", "students", 3), ("estudantes", "students", 3), ("criancas", "students", 2), ("cadastrad", "students", 2),
    ("caso", "cases", 3), ("jornada", "cases", 2), ("etapa", "cases", 2), ("andamento", "cases", 2),
    ("taruma", "population_total", 3), ("prevalencia", "population_total", 3), ("base populacional", "population_total", 3),
    ("populacao", "population_total", 2), ("casos registrados", "population_total", 3),
    ("faixa etaria", "population_by_age", 1),
]

GROUP_PHRASES: list[tuple[str, str]] = [
    (r"\b(por|cada|das|nas|entre as|ranking de) escolas?\b", "school"),
    (r"\bescola por escola\b", "school"),
    (r"\b(por|a cada|mes a mes|mensal|evolucao|ao longo|tendencia|historico)\b.*\b(mes|meses|tempo)\b|\bmes a mes\b|\bmensal\b|\bevolucao\b|\bao longo do tempo\b|\btendencia\b", "month"),
    (r"\b(por|em cada) (etapa|situacao do caso|fase)\b|\bjornada\b", "journey_state"),
    (r"\bpor (faixa etaria|idade|faixas etarias)\b|\bfaixa etaria\b", "age"),
    (r"\bpor especialidade\b", "specialty"),
    (r"\bpor (servico|tipo de servico)\b|\bpor tipo de atendimento\b", "service"),
    (r"\bpor (queixa|motivo)\b", "complaint"),
    (r"\bpor (status|situacao) da delegacao\b", "delegation_status"),
]


def _month_back(today: date, n: int) -> str:
    y, m = today.year, today.month - n
    while m <= 0:
        m += 12
        y -= 1
    return f"{y:04d}-{m:02d}"


def detect_school(q: str, schools: list[dict]) -> str | None:
    qf = fold(q)
    qtok = {stem(t) for t in tokens(q)}
    generic = {"escol", "emef", "emei", "emeb", "colegio", "municipal", "estadual", "centro", "educacao"}
    best, best_score = None, 0.0
    for s in schools:
        nf = fold(s["name"]).strip()
        if nf and nf in qf:
            return s["id"]
        toks = {stem(t) for t in tokens(s["name"])} - generic
        if not toks:
            continue
        score = len(toks & qtok) / len(toks)
        if score > best_score:
            best, best_score = s["id"], score
    return best if best_score >= 0.67 else None


def detect_age(q: str) -> str | None:
    f = fold(q)
    m = re.search(r"(\d{1,2})\s*(?:a|-|ate|e)\s*(\d{1,2})\s*anos", f)
    if m:
        lo = int(m.group(1))
        return "00-05" if lo <= 5 else "06-09" if lo <= 9 else "10-12" if lo <= 12 else "13-17" if lo <= 17 else "18+"
    if re.search(r"\badolescent", f):
        return "13-17"
    if re.search(r"\b(maiores de 18|adultos?|18 anos ou mais)\b", f):
        return "18+"
    if re.search(r"\b(pre ?escolar|primeira infancia)\b", f):
        return "00-05"
    return None


def detect_period(q: str, today: date) -> tuple[str | None, str | None]:
    f = fold(q)
    m = re.search(r"ultimos?\s+(\d{1,2})\s+mes", f)
    if m:
        return _month_back(today, int(m.group(1)) - 1), None
    if re.search(r"\b(este|neste) mes\b", f):
        return _month_back(today, 0), _month_back(today, 0)
    if re.search(r"\bmes passado\b", f):
        return _month_back(today, 1), _month_back(today, 1)
    if re.search(r"\b(este|neste) ano\b", f):
        return f"{today.year:04d}-01", None
    m = re.search(r"\b(\d{4})-(0[1-9]|1[0-2])\b", f)
    if m:
        return m.group(0), m.group(0)
    for name, num in MONTHS.items():
        mm = re.search(rf"\b{name}(?: de (\d{{4}}))?\b", f)
        if mm:
            y = int(mm.group(1)) if mm.group(1) else today.year
            return f"{y:04d}-{num:02d}", f"{y:04d}-{num:02d}"
    return None, None


def plan_from_rules(question: str, catalog: dict, today: date | None = None) -> dict:
    today = today or date.today()
    f = fold(question)
    if REFUSE.search(f):
        return {"plan": None, "confidence": 0.0, "source": "rules", "clarification": REFUSAL, "explanation": None}

    metrics = {m["id"]: m for m in catalog["metrics"]}
    scores: dict[str, float] = {k: 0.0 for k in metrics}
    for phrase, mid, w in INTENTS:
        if mid in metrics and re.search(rf"\b{phrase}", f):
            scores[mid] += w
    for mid, m in metrics.items():
        for syn in m.get("synonyms", []):
            if fold(syn) in f:
                scores[mid] += 1
    wants_pop = bool(re.search(r"\b(taruma|populac|base agregada|prevalencia)\b", f))
    if scores.get("population_by_age") is not None and re.search(r"faixa etaria|idade", f) and wants_pop:
        scores["population_by_age"] += 4
    # "casos" sozinho perde para uma intenção mais específica
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    top, top_score = ranked[0]
    if top_score <= 0:
        return {
            "plan": None, "confidence": 0.0, "source": "rules", "explanation": None,
            "clarification": "Não entendi o que medir. Tente: “casos por escola”, “tempo médio até o encerramento por mês”, "
                             "“profissionais necessários por serviço” ou “queixas mais registradas”.",
        }
    second = ranked[1][1] if len(ranked) > 1 else 0.0
    confidence = round(min(1.0, 0.45 + 0.1 * top_score + 0.15 * (top_score - second > 1)), 2)
    metric = metrics[top]
    dims_ok = set(metric["dims"])

    group: list[str] = []
    for pat, key in GROUP_PHRASES:
        if re.search(pat, f):
            d = key
            if key == "age":
                d = "age_band" if "age_band" in dims_ok else "age_bracket"
            if d in dims_ok and d not in group:
                group.append(d)
    required = {"population_by_age": "age_band", "population_by_complaint": "complaint", "population_by_service": "service"}
    if top in required and required[top] not in group:
        group.insert(0, required[top])
    if top == "professionals_needed" and "service" not in group and "school" not in group:
        group.append("service")
    if top == "delegations" and not group:
        group.append("specialty")
    group = group[:2]

    flt: dict = {}
    allowed = set(metric["filters"])
    sid = detect_school(question, catalog.get("schools", []))
    if sid and "schoolId" in allowed:
        flt["schoolId"] = sid
        if "school" in group and len(group) > 1:
            group.remove("school")
    age = detect_age(question)
    if age and "ageBracket" in allowed and top not in ("population_by_age",):
        flt["ageBracket"] = age
    if "journeyState" in allowed:
        for w, st in STATE_WORDS:
            if re.search(rf"\b{w}", f):
                flt["journeyState"] = st
                break
    if "specialty" in allowed:
        for w, sp in SPECIALTY_WORDS:
            if re.search(rf"\b{w}", f):
                flt["specialty"] = sp
                break
    frm, to = detect_period(question, today)
    if "from" in allowed and frm:
        flt["from"] = frm
    if "to" in allowed and to:
        flt["to"] = to
    if "from" in allowed and frm and "month" not in group and re.search(r"ultimos?\s+\d+\s+mes|por mes|mensal", f):
        group = (["month"] + group)[:2]

    plan: dict = {"metric": top, "groupBy": group, "filters": flt}
    if re.search(r"\b(grafico de linha|linha)\b", f):
        plan["viz"] = "line"
    elif re.search(r"\b(barras?|ranking)\b", f):
        plan["viz"] = "bar"
    elif re.search(r"\btabela\b", f):
        plan["viz"] = "table"

    parts = [metric["label"]]
    if group:
        parts.append("agrupado por " + " e ".join(catalog["dimensions"].get(d, d) for d in group))
    if flt:
        parts.append("com filtros: " + ", ".join(f"{k}={v}" for k, v in flt.items() if k != "schoolId") + (" escola selecionada" if "schoolId" in flt else ""))
    return {"plan": plan, "confidence": confidence, "source": "rules", "explanation": "Entendi: " + "; ".join(parts) + ".", "clarification": None}
