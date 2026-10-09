import { test } from "node:test";
import assert from "node:assert";
import { buildTarumaDashboard, type TarumaSchoolInput } from "./taruma-dashboard.service";
import { CAPACITY_DEFAULTS, type AggregatePayload } from "./population-planning.service";

// Agregados reais da base já carregada (contagens por escola, sem dado individual).
const total: AggregatePayload = {
  total: 500,
  ageBands: { "18+": 151, "3-5": 19, "6-9": 71, "10-12": 84, "13-17": 175 },
  services: {
    psicoterapia: 128, fonoaudiologia: 227, psicopedagogia: 191, consulta_medica: 500,
    neuropsicologia: 223, psicomotricidade: 56, assistencia_social: 19,
  },
  complaints: { "Escrita + leitura": 224, "Falta de atenção": 120, Agressividade: 106, "Humor deprimido": 3, Leitura: 11, Escrita: 0 },
};
const mk = (t: number | null, pilot: number | null, fono: number | null): AggregatePayload => ({
  total: t,
  ageBands: { "6-9": pilot },
  complaints: {},
  services: { fonoaudiologia: fono, consulta_medica: t },
});
const schools: TarumaSchoolInput[] = [
  { code: "2", label: "GL", payload: mk(117, 16, 66) },
  { code: "4", label: "JR", payload: mk(107, 15, 49) },
  { code: "1", label: "MAB", payload: mk(104, 14, 40) },
  { code: "3", label: "JOO", payload: mk(88, 9, 41) },
  { code: "7", label: "IOF", payload: mk(null, null, null) },
  { code: "0", label: "Não se aplica", payload: mk(15, null, null) },
];

test("painel do município: KPIs fixos calculados sobre os agregados", () => {
  const d = buildTarumaDashboard(total, schools, CAPACITY_DEFAULTS, "municipio");
  const kpi = (id: string) => d.kpis.find((k) => k.id === id)!;
  assert.equal(kpi("casos").value, "500");
  assert.equal(kpi("escolas").value, "4 de 5"); // "Não se aplica" não é escola; IOF está oculta (<5)
  assert.equal(kpi("piloto").value, "71");
  assert.match(kpi("piloto").detail, /14,2%/);
  assert.equal(kpi("ate17").value, "349");
  assert.equal(kpi("queixa").value, "Escrita + leitura");
  assert.match(kpi("queixa").detail, /44,8%/);
  assert.equal(kpi("especialidade").value, "Fonoaudiologia"); // consulta médica (100%) não entra
  assert.equal(kpi("profissionais").value, "30,1");
  assert.equal(kpi("concentracao").value, "65,6%"); // (117+107+104)/500
});

test("ranking por escola exclui 'Não se aplica' e mantém células ocultas como null", () => {
  const d = buildTarumaDashboard(total, schools, CAPACITY_DEFAULTS, "municipio");
  assert.deepEqual(d.casesBySchool.map((x) => x.label), ["GL", "JR", "MAB", "JOO", "IOF"]);
  assert.equal(d.casesBySchool.at(-1)!.value, null);
  assert.equal(d.pilotBySchool[0].label, "GL");
  assert.ok(!d.heatmap.rows.some((r) => r.school === "IOF"), "escola sem total visível não entra no mapa de calor");
  assert.ok(!d.heatmap.services.some((s) => s.key === "consulta_medica"));
});

test("faixa do piloto é destacada e queixas ficam ordenadas, sem valor zero", () => {
  const d = buildTarumaDashboard(total, schools, CAPACITY_DEFAULTS, "municipio");
  assert.equal(d.ageBands.find((a) => a.highlight)!.key, "6-9");
  assert.deepEqual(d.complaints.map((c) => c.label).slice(0, 3), ["Escrita + leitura", "Falta de atenção", "Agressividade"]);
  assert.ok(!d.complaints.some((c) => c.value === 0));
});

test("profissionais recalculam com a capacidade editada e escola isolada não mostra ranking", () => {
  const d = buildTarumaDashboard(total, schools, { ...CAPACITY_DEFAULTS, fonoaudiologia: 20 }, "municipio");
  assert.equal(d.services.find((s) => s.key === "fonoaudiologia")!.professionals, 11.4);
  const solo = buildTarumaDashboard(schools[0].payload, [schools[0]], CAPACITY_DEFAULTS, "escola");
  assert.equal(solo.scope, "escola");
  assert.ok(!solo.kpis.some((k) => k.id === "concentracao" || k.id === "escolas"));
});

test("o painel não carrega campo individual algum", () => {
  const d = JSON.stringify(buildTarumaDashboard(total, schools, CAPACITY_DEFAULTS, "municipio"));
  assert.ok(!/nome|cpf|prontu|nascimento|hip[óo]tese|f[áa]rmaco/i.test(d));
});
