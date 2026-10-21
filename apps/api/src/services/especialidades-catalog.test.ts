import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ESPECIALIDADES_COM_FORMS,
  ESPECIALIDADE_FORMS,
  ESP_FORM_ID_MAX,
  ESPECIALIDADE_SUMARIOS,
  ehFormularioDeSumario,
  idsDeSumarioDaEspecialidade,
  camposDoForm,
  formDaEspecialidade,
  isEspecialidadeId,
  normalizarPayloadDef,
  progressoDef,
  resumoVisualDef,
  validarPayloadDef,
} from "@periscopio/shared";

const todos = ESPECIALIDADES_COM_FORMS.flatMap((e) => ESPECIALIDADE_FORMS[e].map((f) => ({ esp: e, f })));

describe("catálogo das especialidades", () => {
  test("toda especialidade delegável com formulário tem pelo menos um", () => {
    for (const e of ESPECIALIDADES_COM_FORMS) assert.ok(ESPECIALIDADE_FORMS[e].length > 0, e);
    assert.equal(isEspecialidadeId("fonoaudiologia"), true);
    assert.equal(isEspecialidadeId("medico"), false);
  });

  test("ids de formulário são únicos por especialidade e cabem na coluna", () => {
    for (const e of ESPECIALIDADES_COM_FORMS) {
      const ids = ESPECIALIDADE_FORMS[e].map((f) => f.id);
      assert.equal(new Set(ids).size, ids.length, `ids repetidos em ${e}`);
      for (const id of ids) {
        assert.ok(id.length <= ESP_FORM_ID_MAX, id);
        assert.match(id, /^[a-z0-9_]+$/);
      }
    }
  });

  test("chaves dos campos são únicas dentro de cada formulário", () => {
    for (const { f } of todos) {
      const keys = camposDoForm(f).map((c) => c.key);
      assert.equal(new Set(keys).size, keys.length, `chaves repetidas em ${f.id}`);
    }
  });

  test("nenhum campo pede nome, endereço, telefone, CPF ou e-mail", () => {
    const proibido = /(^|_)(nome|endereco|telefone|cpf|email|e_mail|rg)(_|$)/;
    for (const { f } of todos) {
      for (const c of camposDoForm(f)) assert.ok(!proibido.test(c.key), `${f.id}.${c.key}`);
    }
  });

  test("opções de uma mesma pergunta têm valores únicos", () => {
    for (const { f } of todos) {
      for (const c of camposDoForm(f)) {
        if (c.tipo === "unica" || c.tipo === "multipla" || c.tipo === "matriz") {
          const vals = c.opcoes.map((o) => o.value);
          assert.equal(new Set(vals).size, vals.length, `${f.id}.${c.key}`);
        }
        if (c.tipo === "matriz") {
          const rows = c.linhas.map((l) => l.key);
          assert.equal(new Set(rows).size, rows.length, `${f.id}.${c.key} linhas`);
        }
      }
    }
  });

  test("todo formulário declara de onde vieram as lacunas (cadastro e nomes omitidos)", () => {
    for (const { f } of todos) assert.ok(f.pendenciasDeValidacao.length >= 1, f.id);
  });

  test("instrumentos licenciados guardam só o resultado: SRS-2, MASC, SCARED, CBCL e ASQ não têm itens", () => {
    for (const id of ["fono_srs2", "psi_masc", "psi_scared"]) {
      const f = formDaEspecialidade(id.startsWith("fono") ? "fonoaudiologia" : "psicologia", id)!;
      assert.ok(camposDoForm(f).length <= 8, id);
    }
    const social = formDaEspecialidade("servico_social", "as_cbcl_asq")!;
    assert.ok(camposDoForm(social).length <= 10);
  });

  test("o sistema não calcula: nenhum campo guarda total, escore ou classe calculados", () => {
    // Totais existem só como campo opcional que o profissional digita (psicomotricidade).
    const total = camposDoForm(formDaEspecialidade("psicomotricidade", "psm_espaco_praxias")!).filter((c) => /^total_/.test(c.key));
    assert.ok(total.length > 0);
    for (const c of total) assert.equal(c.opcional, true, c.key);
  });

  test("o ponto de corte do SCARED não aparece em nenhum texto do formulário", () => {
    const f = formDaEspecialidade("psicologia", "psi_scared")!;
    const texto = JSON.stringify(f.secoes) + f.dica + f.titulo;
    assert.ok(!/25/.test(texto), "ponto de corte não deve ser exibido");
  });
});

describe("validação e normalização", () => {
  test("payload vazio é válido (em branco continua em branco)", () => {
    for (const { f } of todos) assert.equal(validarPayloadDef(f, {}), null, f.id);
  });

  test("em branco não vira 'não'", () => {
    const f = formDaEspecialidade("fonoaudiologia", "fono_anamnese")!;
    const p = normalizarPayloadDef(f, {});
    assert.deepEqual(p, {});
    assert.deepEqual(progressoDef(f, {}).respondidos, 0);
  });

  test("rejeita campo desconhecido e opção fora do catálogo", () => {
    const f = formDaEspecialidade("psicomotricidade", "psm_habilidades_basicas")!;
    assert.match(validarPayloadDef(f, { inexistente: "x" })!, /Campo desconhecido/);
    assert.match(validarPayloadDef(f, { manipulativa: { arremessar: { r: "z" } } })!, /opção inválida/);
    assert.equal(validarPayloadDef(f, { manipulativa: { arremessar: { r: "a" } } }), null);
  });

  test("número da tabela precisa ser finito e dentro do limite", () => {
    const f = formDaEspecialidade("fonoaudiologia", "fono_audicao")!;
    assert.equal(validarPayloadDef(f, { limiar_auditivo: { od: { r: "normal", n: 15 } } }), null);
    assert.match(validarPayloadDef(f, { limiar_auditivo: { od: { n: 5000 } } })!, /inválido/);
    assert.match(validarPayloadDef(f, { limiar_auditivo: { od: { n: Number.NaN } } })!, /inválido/);
  });

  test("datas: AAAA-MM-DD ou em branco", () => {
    const f = formDaEspecialidade("fonoaudiologia", "fono_plano_terapeutico")!;
    assert.equal(validarPayloadDef(f, { data_ultima_avaliacao: "2026-10-01" }), null);
    assert.equal(validarPayloadDef(f, { data_ultima_avaliacao: "" }), null);
    assert.match(validarPayloadDef(f, { data_ultima_avaliacao: "ontem" })!, /data inválida/);
    assert.match(validarPayloadDef(f, { data_prevista_reavaliacao: "2026-13-45" })!, /data inválida/);
  });

  test("texto longo demais é recusado", () => {
    const f = formDaEspecialidade("psicomotricidade", "psm_plano_terapeutico")!;
    assert.match(validarPayloadDef(f, { principais_achados: "x".repeat(5000) })!, /longo demais/);
  });

  test("genograma do serviço social usa o mesmo campo do médico", () => {
    const f = formDaEspecialidade("servico_social", "as_genograma_social")!;
    assert.ok(camposDoForm(f).some((c) => c.tipo === "genograma"));
    assert.equal(validarPayloadDef(f, { genograma_estrutura: "" }), null);
  });

  test("formDaEspecialidade não devolve formulário de outra especialidade", () => {
    assert.equal(formDaEspecialidade("fonoaudiologia", "psm_sumario"), null);
    assert.equal(formDaEspecialidade("medico", "fono_anamnese"), null);
  });
});

describe("resumo visual sem peso", () => {
  test("agrupa por resposta, na ordem das opções, sem somar nem classificar", () => {
    const f = formDaEspecialidade("fonoaudiologia", "fono_anamnese")!;
    const r = resumoVisualDef(f, {
      audicao: {
        pede_repetir: { r: "sim" },
        fala_alto: { r: "nao" },
        otites: { r: "sim", obs: "duas vezes" },
      },
    });
    const campo = r.secoes.find((s) => s.id === "audicao")!.campos[0];
    assert.equal(campo.tipo, "tabela");
    assert.deepEqual(
      campo.grupos!.map((g) => g.resposta),
      ["Não", "Sim"]
    );
    assert.deepEqual(
      campo.grupos!.find((g) => g.resposta === "Sim")!.linhas.map((l) => l.rotulo),
      ["Sempre pede para repetir a informação", "Teve otites de repetição"]
    );
    assert.equal(campo.emBranco!.length, 3);
    // Sem totais, escores ou classes.
    assert.ok(!("pontos" in r) && !("escore" in r) && !("classe" in r));
  });

  test("em branco não aparece como resposta e o andamento conta só o respondido", () => {
    const f = formDaEspecialidade("psicomotricidade", "psm_sumario")!;
    const vazio = resumoVisualDef(f, {});
    assert.equal(vazio.respondidos, 0);
    assert.ok(vazio.secoes.every((s) => s.campos.length === 0));
    const um = resumoVisualDef(f, { hipotese: "texto sintético" });
    assert.equal(um.respondidos, 1);
    assert.equal(um.secoes[0].campos[0].texto, "texto sintético");
  });

  test("número digitado aparece como veio, sem conversão", () => {
    const f = formDaEspecialidade("fonoaudiologia", "fono_audicao")!;
    const r = resumoVisualDef(f, { limiar_auditivo: { od: { r: "normal", n: 15 } } });
    const campo = r.secoes.flatMap((s) => s.campos).find((c) => c.key === "limiar_auditivo")!;
    assert.equal(campo.grupos![0].linhas[0].numero, "15");
  });
});

describe("sumário de cada especialidade (o que sai do bloco de notas)", () => {
  test("toda especialidade tem ao menos um sumário e ele existe no catálogo dela", () => {
    for (const e of ESPECIALIDADES_COM_FORMS) {
      const ids = ESPECIALIDADE_SUMARIOS[e];
      assert.ok(ids.length > 0, e);
      for (const id of ids) assert.ok(formDaEspecialidade(e, id), `${e}.${id}`);
    }
  });

  test("só o sumário sai; anamnese, instrumentos e plano terapêutico ficam com o profissional", () => {
    assert.equal(ehFormularioDeSumario("psicomotricidade", "psm_sumario"), true);
    assert.equal(ehFormularioDeSumario("psicomotricidade", "psm_plano_terapeutico"), false);
    assert.equal(ehFormularioDeSumario("fonoaudiologia", "fono_anamnese"), false);
    assert.equal(ehFormularioDeSumario("fonoaudiologia", "fono_srs2"), false);
    assert.equal(ehFormularioDeSumario("servico_social", "as_cbcl_asq"), false);
    assert.deepEqual(idsDeSumarioDaEspecialidade("medico"), []);
  });
});
