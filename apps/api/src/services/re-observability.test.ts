import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mediana, resumirTempoFogap, resumirTempos, resumirUsoOpcional, resumirTea } from "./re-observability.service";

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

describe("tempo do FOGAP pelo RE (REG-019)", () => {
  const caso = (id: string, partes: Record<string, number>) => Object.entries(partes).map(([step, activeSeconds]) => ({ caseId: id, step, activeSeconds }));

  test("soma as partes de cada caso e calcula mediana, média e quartis", () => {
    const rows = [
      ...caso("c1", { a: 100, b: 200 }), // 300
      ...caso("c2", { a: 600 }), // 600
      ...caso("c3", { a: 200, c: 400, i: 400 }), // 1000
      ...caso("c4", { b: 900 }), // 900
      ...caso("c5", { a: 1200, h: 300 }), // 1500
    ];
    const r = resumirTempoFogap(rows);
    assert.equal(r.casos, 5);
    assert.equal(r.suppressed, false);
    assert.equal(r.medianaSegundos, 900, "mediana dos totais 300,600,900,1000,1500");
    assert.equal(r.mediaSegundos, 860);
    assert.equal(r.p25Segundos, 600);
    assert.equal(r.p75Segundos, 1000);
  });

  test("a mediana não é puxada por um caso muito longo (a média é)", () => {
    const rows = [100, 110, 120, 130, 100000].flatMap((s, i) => caso(`c${i}`, { a: s }));
    const r = resumirTempoFogap(rows);
    assert.equal(r.medianaSegundos, 120);
    assert.ok(r.mediaSegundos! > 20000);
  });

  test("menos de 5 casos: tudo oculto (sem número), mas informa que há casos", () => {
    const r = resumirTempoFogap([...caso("c1", { a: 100 }), ...caso("c2", { a: 200 }), ...caso("c3", { a: 300 })]);
    assert.equal(r.casos, 3);
    assert.equal(r.suppressed, true);
    assert.deepEqual([r.medianaSegundos, r.mediaSegundos, r.p25Segundos, r.p75Segundos], [null, null, null, null]);
    assert.ok(r.passos.every((p) => p.medianaSegundos === null));
  });

  test("sem nenhum tempo: zero casos, não oculto", () => {
    const r = resumirTempoFogap([]);
    assert.deepEqual([r.casos, r.suppressed, r.medianaSegundos], [0, false, null]);
  });

  test("ignora passo desconhecido e tempo zero; resposta traz só números", () => {
    const rows = [...caso("c1", { a: 0, z: 999 }), ...[1, 2, 3, 4, 5].flatMap((i) => caso(`d${i}`, { a: 60 * i }))];
    const r = resumirTempoFogap(rows);
    assert.equal(r.casos, 5, "c1 só tem tempo zero/desconhecido");
    assert.ok(!JSON.stringify(r).includes("c1") && !JSON.stringify(r).includes("d1"), "nenhum identificador de caso");
  });
});
