"""
Testes do extrator local com planilha SINTÉTICA (nomes e endereços inventados) e um Mapbox falso em localhost.
Rodar:  python3 -m pytest -q apps/api/scripts/taruma/test_individual_extract.py
"""
import datetime as dt
import json
import os
import sys
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))
import individual_extract as ex  # noqa: E402

openpyxl = pytest.importorskip("openpyxl")
SECRET = "segredo-de-teste-com-mais-de-32-caracteres!!"

HEADER = ["NOME", "PRONTUÁRIO", "NASCIMENTO", "ID ATUAL", "ANO", "Escola", "FAMILIAR RESPONSÁVEL", "RELIGIÃO",
          "ENDEREÇO", "HIPÓTESE", "FÁRMACOS", "ANTECEDENTES", "QUEIXA-0", "QUEIXA-1", "FONOID", "ANP", "SESSÕES MD 1", "OBS"]
ROWS = [
    ["Aluno Sintético Um", "P-001", dt.datetime(2016, 5, 3), 8, 2022, 2, "Mãe Sintética Um", "Católica", "Rua Fictícia 10", "H1; H2", "F1", "Pai: A", 0, 1, 1, 0, 3, "nada"],
    ["Aluno Sintético Dois", "P-002", "12/09/2012", 12, 2019, 2, "Mãe Sintética Um", None, "Rua Fictícia 10", None, None, None, 1, 1, None, 2, 1, None],
    ["Aluno Sintético Três", "P-003", dt.datetime(2008, 1, 9), 18, 2015, 0, None, None, "Rua Longe 99", "H3", None, None, None, None, 0, None, 1, "x"],
    ["Aluno Sintético Quatro", "P-004", "data quebrada", 6, 2023, 1, "Pai Sintético", None, None, None, None, None, 0, 0, None, None, 2, None],
]


class FakeMapbox(BaseHTTPRequestHandler):
    seen = []

    def log_message(self, *a):  # silencioso
        pass

    def do_GET(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        FakeMapbox.seen.append(q)
        addr = q["q"][0]
        if "Longe" in addr:
            lon, lat, acc = -46.6, -23.5, "rooftop"  # São Paulo: fora da caixa de Tarumã
        elif "Fictícia" in addr:
            lon, lat, acc = -50.58, -22.75, "rooftop"
        else:
            self.send_response(200); self.end_headers(); self.wfile.write(b'{"features": []}'); return
        body = {"features": [{"geometry": {"coordinates": [lon, lat]},
                              "properties": {"coordinates": {"latitude": lat, "longitude": lon, "accuracy": acc},
                                             "match_code": {"confidence": "exact"}}}]}
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(json.dumps(body).encode())


@pytest.fixture()
def env(tmp_path):
    wb = openpyxl.Workbook()
    ws = wb.active; ws.title = "Dados"
    ws.append(HEADER)
    for r in ROWS:
        ws.append(r)
    xlsx = tmp_path / "sintetica.xlsx"
    wb.save(xlsx)
    server = HTTPServer(("127.0.0.1", 0), FakeMapbox)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    FakeMapbox.seen.clear()
    yield tmp_path, xlsx, f"http://127.0.0.1:{server.server_port}"
    server.shutdown()


def make_mapping(tmp_path, xlsx):
    m = ex.suggest(str(xlsx), "Dados")
    m["patient"]["guardian"]["as"] = "pseudonym"
    m["address"]["appendToQuery"] = ""
    path = tmp_path / "mapping.json"
    path.write_text(json.dumps(m, ensure_ascii=False))
    return m, path


def run(tmp_path, xlsx, mapping, base, geocode=True):
    geo = ex.Geocoder("tok", base, pause=0) if geocode else None
    return ex.build_manifest_and_lines(str(xlsx), str(mapping), geo, SECRET)


def test_suggest_acha_colunas_pelo_cabecalho_e_nao_inventa(env):
    tmp, xlsx, _ = env
    m, _ = make_mapping(tmp, xlsx)
    p = m["patient"]
    assert p["nameColumn"] == "NOME" and p["recordNumber"] == "PRONTUÁRIO" and p["birthDate"] == "NASCIMENTO"
    assert p["guardian"]["column"] == "FAMILIAR RESPONSÁVEL" and p["religion"] == "RELIGIÃO"
    assert m["address"]["columns"] == ["ENDEREÇO"]
    assert m["items"]["hypothesis"]["column"] == "HIPÓTESE" and m["items"]["family_history"]["column"] == "ANTECEDENTES"
    assert m["_unmappedColumns"] == ["OBS"]


def test_nome_vira_uuid_estavel_e_endereco_vira_coordenada_sem_vazar(env):
    tmp, xlsx, base = env
    _, mp = make_mapping(tmp, xlsx)
    manifest, lines = run(tmp, xlsx, mp, base)
    out = tmp / "o.ndjson"
    ex.write_ndjson(str(out), manifest, lines)
    text = out.read_text(encoding="utf-8")
    for proibido in ["Aluno Sintético", "Mãe Sintética", "Pai Sintético", "Rua Fictícia", "Rua Longe"]:
        assert proibido not in text, proibido
    a, b = lines[0], lines[1]
    assert a["patientId"] != b["patientId"]
    assert a["patient"]["guardianRef"] == b["patient"]["guardianRef"], "mesma mãe = mesmo UUID (irmãos ligados)"
    assert a["raw"]["FAMILIAR RESPONSÁVEL"] == a["patient"]["guardianRef"], "camada bruta usa o mesmo UUID"
    assert "NOME" not in a["raw"] and "ENDEREÇO" not in a["raw"]
    _, again = run(tmp, xlsx, mp, base, geocode=False)
    assert again[0]["patientId"] == a["patientId"], "UUID é determinístico (carga repetível)"
    assert oct(os.stat(out).st_mode & 0o777) == "0o600"


def test_geocodificacao_status_cache_e_permanent(env):
    tmp, xlsx, base = env
    _, mp = make_mapping(tmp, xlsx)
    manifest, lines = run(tmp, xlsx, mp, base)
    loc = [l["location"] for l in lines]
    assert loc[0]["status"] == "ok" and loc[0]["latitude"] == -22.75 and loc[0]["permanent"] is True
    assert loc[0]["addressKey"] == loc[1]["addressKey"]
    assert loc[2]["status"] == "out_of_area" and loc[2]["latitude"] is None, "fora de Tarumã não vira pino"
    assert loc[3]["status"] == "no_address"
    assert len(FakeMapbox.seen) == 2, "endereço repetido consulta uma vez só"
    assert all(q.get("permanent") == ["true"] for q in FakeMapbox.seen)


def test_campos_do_contrato_e_camada_bruta_sem_perda(env):
    tmp, xlsx, base = env
    _, mp = make_mapping(tmp, xlsx)
    manifest, lines = run(tmp, xlsx, mp, base, geocode=False)
    mf = manifest["manifest"]
    a, d = lines[0], lines[3]
    assert a["patient"]["birthDate"] == "2016-05-03" and a["patient"]["entryYear"] == 2022 and a["patient"]["religion"] == "Católica"
    assert lines[1]["patient"]["birthDate"] == "2012-09-12"
    assert d["patient"]["birthDate"] is None and any("datas" in w for w in mf["warnings"])
    assert a["complaints"] == ["Falta de atenção"] and lines[1]["complaints"] == ["Não devidamente esclarecida", "Falta de atenção"]
    assert [i["text"] for i in a["items"] if i["kind"] == "hypothesis"] == ["H1", "H2"]
    svc = {(s["column"], s["valueNum"]) for s in a["services"]}
    assert ("FONOID", 1.0) in svc and ("ANP", 0.0) in svc and ("SESSÕES MD 1", 3.0) in svc
    assert a["raw"]["OBS"] == "nada" and a["raw"]["PRONTUÁRIO"] == "P-001"
    assert mf["rowCount"] == 4 and mf["columnNonNull"]["NOME"] == 4 and mf["columnNonNull"]["RELIGIÃO"] == 1
    assert set(mf["transformedColumns"]) >= {"NOME", "ENDEREÇO", "FAMILIAR RESPONSÁVEL"}
    assert a["school"] == {"code": "2", "label": "GL"} and lines[2]["school"]["code"] == "0"


def test_coluna_inexistente_no_mapeamento_falha_citando_so_o_nome_da_coluna(env):
    tmp, xlsx, base = env
    m, mp = make_mapping(tmp, xlsx)
    m["patient"]["religion"] = "COLUNA QUE NÃO EXISTE"
    mp.write_text(json.dumps(m, ensure_ascii=False))
    with pytest.raises(ex.ExtractError, match="COLUNA QUE NÃO EXISTE"):
        run(tmp, xlsx, mp, base)


def test_registros_identicos_recebem_uuid_distinto(env):
    tmp, xlsx, base = env
    wb = openpyxl.load_workbook(xlsx)
    wb["Dados"].append(ROWS[0])  # duplicado exato
    wb.save(xlsx)
    _, mp = make_mapping(tmp, xlsx)
    manifest, lines = run(tmp, xlsx, mp, base, geocode=False)
    assert len({l["patientId"] for l in lines}) == 5
    assert any("duplicado" in w for w in manifest["manifest"]["warnings"])


def test_responsavel_nome_vira_uuid_e_parentesco_fica_escrito(env):
    tmp, xlsx, base = env
    _, mp = make_mapping(tmp, xlsx)
    manifest, lines = run(tmp, xlsx, mp, base, geocode=False)
    a, d = lines[0], lines[3]
    assert a["patient"]["guardianRelation"] == "mãe" and d["patient"]["guardianRelation"] == "pai"
    assert a["patient"]["guardianRef"] and a["patient"]["guardianRef"] != d["patient"]["guardianRef"]
    assert lines[2]["patient"].get("guardianRef") is None


def test_split_guardian_casos():
    sg = ex.split_guardian
    ref, rel = sg("Maria da Silva (mãe)", "pseudonym")
    ref2, _ = sg("MARIA DA SILVA - Mãe", "pseudonym")
    assert rel == "mãe" and ref == ref2 and "maria" in ref  # base do HMAC, nunca gravada
    assert sg("mãe", "pseudonym") == (None, "mãe")  # só parentesco: não há nome
    assert sg("João Souza", "pseudonym") == ("joao souza", None)  # nome sem parentesco
    assert sg("João Souza", "pseudonym", "tio") == ("joao souza", "tio")  # coluna de parentesco separada
    assert sg("avó", "text") == (None, "avó")
    assert sg(None, "pseudonym", "pai") == (None, "pai")


def test_flags_dicionario_e_coluna_liberada(tmp_path):
    wb = openpyxl.Workbook()
    ws = wb.active; ws.title = "Dados"
    ws.append(["seq", "NOME", "Escola", "FAM R", "CELULAR", "HD-0", "HD-1", "ANTEC-FAM-1"])
    ws.append([1, "Aluno Sintético A", 2, "Maria Sintética", 1, 0, 1, 1])
    ws.append([2, "Aluno Sintético B", 3, None, 0, 1, 1, 0])
    dic = wb.create_sheet("Variáveis")
    dic.append([None, None, "Dicionário"]); dic.append([None, None, "ATUALIZADO"]); dic.append([])
    dic.append(["Coluna", "Nome da Coluna", "Variável", "Valor", None, "Rótulo"]); dic.append([])
    dic.append(["E", "CELULAR", "Paciente usa o celular", 0, None, "Não"])
    dic.append([None, None, None, 1, None, "Sim"])
    path = tmp_path / "f.xlsx"; wb.save(path)
    m = {"schemaVersion": 1, "source": "t", "referenceYear": 2024, "sheet": "Dados", "rowFilterColumn": "seq",
         "school": {"column": "Escola", "labels": {}}, "patient": {"nameColumn": "NOME", "guardian": {"column": "FAM R", "as": "pseudonym"}},
         "complaints": {"columns": {}}, "services": {}, "allowColumns": ["CELULAR"], "dictionarySheet": "Variáveis",
         "items": {"hypothesis": {"flags": {"HD-0": "Normal", "HD-1": "Hipótese Um"}, "flagValue": 1},
                   "family_history": {"flags": {"ANTEC-FAM-1": "Doença mental"}, "flagValue": 1}}}
    mp = tmp_path / "m.json"; mp.write_text(json.dumps(m, ensure_ascii=False))
    manifest, lines = ex.build_manifest_and_lines(str(path), str(mp), None, SECRET)
    assert [i["text"] for i in lines[0]["items"] if i["kind"] == "hypothesis"] == ["Hipótese Um"]
    assert [i["text"] for i in lines[1]["items"] if i["kind"] == "hypothesis"] == ["Normal", "Hipótese Um"]
    assert [i["text"] for i in lines[0]["items"] if i["kind"] == "family_history"] == ["Doença mental"]
    assert lines[0]["patient"]["guardianRef"] and lines[1]["patient"].get("guardianRef") is None
    mf = manifest["manifest"]
    assert mf["allowedColumns"] == ["CELULAR"] and lines[0]["raw"]["CELULAR"] == 1
    d = mf["dictionary"]
    assert [x["variable"] for x in d] == ["CELULAR", "CELULAR"] and [x["label"] for x in d] == ["Não", "Sim"]
