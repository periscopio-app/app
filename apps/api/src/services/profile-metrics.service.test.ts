import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { cartaoAgregado, medianaEmDias, medianaEmHoras, resumirTempoPessoal } from "./profile-metrics.service";

const DIA = 86_400_000;

describe("Meu painel: métricas (funções puras)", () => {
  test("mediana em dias só com amostra mínima de 3", () => {
    assert.equal(medianaEmDias([DIA, 2 * DIA]), null);
    assert.equal(medianaEmDias([DIA, 2 * DIA, 9 * DIA]), 2);
    assert.equal(medianaEmDias([DIA * 1.5, DIA * 1.5, DIA * 1.5]), 1.5);
    assert.equal(medianaEmDias([-1, DIA, DIA, DIA]), 1); // duração negativa é descartada
  });

  test("mediana em horas", () => {
    assert.equal(medianaEmHoras([3_600_000, 7_200_000, 10_800_000]), 2);
    assert.equal(medianaEmHoras([3_600_000]), null);
  });

  test("agregado da gestão oculta grupos de 1 a 4 e mostra zero e 5+", () => {
    assert.equal(cartaoAgregado("x", "X", 0, "a").valor, 0);
    assert.deepEqual(
      [cartaoAgregado("x", "X", 3, "a").valor, cartaoAgregado("x", "X", 3, "a").oculto],
      [null, true]
    );
    assert.equal(cartaoAgregado("x", "X", 5, "a").valor, 5);
    assert.equal(cartaoAgregado("x", "X", 12, "a").oculto, false);
  });

  test("tempo pessoal do RE: mediana por parte, referência do papel e ganho estimado", () => {
    const rows = [
      // parte A em 3 casos: 10, 20, 30 min → mediana 20 min
      { caseId: "c1", step: "a", activeSeconds: 600 },
      { caseId: "c2", step: "a", activeSeconds: 1200 },
      { caseId: "c3", step: "a", activeSeconds: 1800 },
      // parte B em só 2 casos: sem mediana
      { caseId: "c1", step: "b", activeSeconds: 300 },
      { caseId: "c2", step: "b", activeSeconds: 300 },
      { caseId: "c1", step: "zz", activeSeconds: 999 }, // parte inexistente é ignorada
    ];
    const r = resumirTempoPessoal(rows, { a: 30, b: 10 });
    assert.equal(r.casosMedidos, 3);
    const a = r.passos.find((p) => p.step === "a")!;
    const b = r.passos.find((p) => p.step === "b")!;
    assert.deepEqual([a.casos, a.medianaMin, a.referenciaMin, a.ganhoMin], [3, 20, 30, 10]);
    assert.deepEqual([b.casos, b.medianaMin, b.ganhoMin], [2, null, null]);
    // 10 min × 3 casos = 30 min = 0,5 h
    assert.equal(r.horasGanhasEstimadas, 0.5);
    // totais por caso: c1=900s, c2=1500s, c3=1800s → mediana 1500s = 25 min
    assert.equal(r.medianaTotalMin, 25);
  });
});
