import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mediana, resumirTempos, resumirUsoOpcional, resumirTea } from "./re-observability.service";

describe("observabilidade do RE", () => {
  test("mediana", () => {
    assert.equal(mediana([]), null);
    assert.equal(mediana([5, 1, 3]), 3);
    assert.equal(mediana([1, 2, 3, 4]), 3);
  });

  test("oculta células com menos de 5 casos", () => {
    const rows = [1, 2, 3, 4].map((i) => ({ caseId: `c${i}`, step: "a", activeSeconds: 600 }));
    const r = resumirTempos(rows, { a: 30 });
    const a = r.passos.find((p) => p.step === "a")!;
    assert.equal(a.casos, 4);
    assert.equal(a.medianaSegundos.value, null);
    assert.equal(a.medianaSegundos.suppressed, true);
    assert.equal(a.ganhoMedianoMinutos, null);
    assert.equal(r.medianaTotalSegundos.suppressed, true);
  });

  test("com 5 ou mais casos, calcula mediana e tempo ganho", () => {
    const rows = [300, 600, 600, 900, 1200].map((s, i) => ({ caseId: `c${i}`, step: "a", activeSeconds: s }));
    rows.push({ caseId: "c0", step: "b", activeSeconds: 60 });
    const r = resumirTempos(rows, { a: 30 });
    const a = r.passos.find((p) => p.step === "a")!;
    assert.equal(a.medianaSegundos.value, 600);
    assert.equal(a.ganhoMedianoMinutos, 20);
    assert.equal(r.horasGanhasEstimadas.value, Math.round((20 * 5) / 60 * 10) / 10);
    assert.equal(r.passos.find((p) => p.step === "b")!.medianaSegundos.value, null);
  });

  test("soma sessões do mesmo passo e ignora passo desconhecido", () => {
    const rows = [
      ...[0, 1, 2, 3, 4].flatMap((i) => [
        { caseId: `c${i}`, step: "c", activeSeconds: 100 },
        { caseId: `c${i}`, step: "c", activeSeconds: 200 },
        { caseId: `c${i}`, step: "z", activeSeconds: 999 },
      ]),
    ];
    const r = resumirTempos(rows, {});
    assert.equal(r.passos.find((p) => p.step === "c")!.medianaSegundos.value, 300);
    assert.equal(r.medianaTotalSegundos.value, 300);
  });

  test("uso do G: considera o último registro do caso e oculta <5", () => {
    const t = (n: number) => new Date(2026, 9, 1, 0, n);
    const poucos = resumirUsoOpcional([{ caseId: "1", action: "pulado", createdAt: t(1) }], 20);
    assert.equal(poucos.casosComGPulado.suppressed, true);
    assert.equal(poucos.percentual.value, null);
    const rows = [
      ...[1, 2, 3, 4, 5].map((i) => ({ caseId: String(i), action: "pulado", createdAt: t(i) })),
      { caseId: "5", action: "retomado", createdAt: t(9) },
    ];
    const r = resumirUsoOpcional(rows, 10);
    assert.equal(r.casosComGPulado.value, null, "4 pulados (o 5º foi retomado) fica oculto");
    assert.equal(r.casosComGPulado.suppressed, true);
    assert.equal(r.retomadas.suppressed, true);
  });

  test("TEA: sem pontuação, só andamento", () => {
    const d = (n: number) => new Date(2026, 9, n);
    const rows = [1, 2, 3, 4, 5].map((i) => ({
      caseId: `c${i}`, instrument: "ata", status: "enviado", respondent: "mae_pai", createdAt: d(1), submittedAt: d(3),
    }));
    const r = resumirTea(rows, 2);
    assert.equal(r.instrumentos[0]!.enviados.value, 5);
    assert.equal(r.instrumentos[0]!.medianaDiasAteEnvio.value, 2);
    assert.equal(r.ataAguardandoResponsavel.suppressed, true);
    assert.equal(JSON.stringify(r).includes("scor"), false);
  });
});
