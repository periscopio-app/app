#!/usr/bin/env python3
"""
Extrai AGREGADOS por escola da base clínica do Tarumã (BD NEMT) — sem dado individual.

Uso:  python3 -I extract_aggregates.py <planilha.xlsx> <saida.json>

LGPD / diretrizes do Periscópio:
- NÃO lê nem grava: nome, nº de prontuário, data de nascimento, familiar responsável,
  religião, trabalho dos pais, classificação econômica, hipóteses diagnósticas,
  antecedentes familiares, fármacos.
- Só contagens por escola (sigla). Células com 1 a 4 casos são suprimidas (null).
- O total geral do município (linha "TOTAL") guarda as contagens reais, sem supressão.
"""
import json, sys, collections
import openpyxl

SMALL = 5
SCHOOLS = {0: "Não se aplica", 1: "MAB", 2: "GL", 3: "JOO", 4: "JR", 5: "HH", 6: "RR",
           7: "IOF", 8: "DONA COTA", 9: "VILA DO LAGO", 10: "DAVID LUZ", 11: "SJ"}
COMPLAINTS = ["Não devidamente esclarecida", "Falta de atenção", "Hiperatividade",
              "Hiperatividade + falta de atenção", "Escrita", "Leitura", "Escrita + leitura",
              "Indisciplina", "Agressividade", "Atraso de fala e linguagem", "Não compreende",
              "Dificuldade em matemática", "Transtorno de ajustamento", "Ansiedade com ou sem tiques",
              "Compulsões/obsessões com ou sem tiques", "Humor deprimido"]
# nome da coluna -> serviço (valor > 0 = houve indicação/atendimento)
SERVICES = {
    "fonoaudiologia": ["FONOID", "FONOaval", "FONOter"],
    "psicopedagogia": ["PpCaval", "PpCter"],
    "psicoterapia": ["PSICOter"],
    "psicomotricidade": ["PsicoM aval", "PsicoM ter"],
    "neuropsicologia": ["ANP"],
    "assistencia_social": ["AS"],
    "consulta_medica": ["SESSÕES MD 1", "SESSÕES MD 2", "SESSÕES MD 3"],
}
AGE_BANDS = [("3-5", 0, 5), ("6-9", 6, 9), ("10-12", 10, 12), ("13-17", 13, 17), ("18+", 18, 200)]


def pos(v):
    return isinstance(v, (int, float)) and v > 0


def band(age):
    for name, lo, hi in AGE_BANDS:
        if lo <= age <= hi:
            return name
    return None


def sup(n):
    return None if 0 < n < SMALL else n


def build(rows, ix):
    out = {"total": len(rows), "ageBands": collections.Counter(), "complaints": collections.Counter(),
           "services": collections.Counter(), "entryYear": collections.Counter()}
    for r in rows:
        age = r[ix["ID ATUAL"]]
        if isinstance(age, (int, float)):
            b = band(int(age))
            if b:
                out["ageBands"][b] += 1
        for i, label in enumerate(COMPLAINTS):
            if r[ix[f"QUEIXA-{i}"]] == 1:
                out["complaints"][label] += 1
        for svc, cols in SERVICES.items():
            if any(pos(r[ix[c]]) for c in cols):
                out["services"][svc] += 1
        y = r[ix["ANO"]]
        if isinstance(y, (int, float)):
            out["entryYear"][str(int(y))] += 1
    return out


def finalize(o, suppress):
    f = (lambda n: sup(n)) if suppress else (lambda n: n)
    return {
        "total": o["total"] if not suppress or o["total"] >= SMALL else None,
        "ageBands": {k: f(o["ageBands"].get(k, 0)) for k, _, _ in AGE_BANDS},
        "complaints": {k: f(o["complaints"].get(k, 0)) for k in COMPLAINTS},
        "services": {k: f(o["services"].get(k, 0)) for k in SERVICES},
    }


def main(src, dst):
    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
    rows = list(wb["Dados"].iter_rows(values_only=True))
    header = [str(x) if x is not None else "" for x in rows[0]]
    ix = {n: i for i, n in enumerate(header)}
    data = [r for r in rows[1:] if r[0] is not None]
    by_school = collections.defaultdict(list)
    for r in data:
        code = r[ix["Escola"]]
        by_school[int(code) if isinstance(code, (int, float)) else 0].append(r)
    result = {"source": "taruma-nemt-2024", "referenceYear": 2024, "smallCellThreshold": SMALL,
              "total": finalize(build(data, ix), suppress=False), "schools": []}
    for code in sorted(by_school):
        result["schools"].append({"schoolCode": str(code), "schoolLabel": SCHOOLS.get(code, str(code)),
                                  **finalize(build(by_school[code], ix), suppress=True)})
    with open(dst, "w", encoding="utf-8") as fh:
        json.dump(result, fh, ensure_ascii=False, indent=2)
    print(f"{len(data)} registros -> {len(result['schools'])} escolas; nenhum dado individual gravado")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
