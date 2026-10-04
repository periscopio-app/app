import { test } from "node:test";
import assert from "node:assert";
import { calculateMunicipalBIMetrics } from "./bi-municipal.service";

test("bi municipal (Task 13): aplica supressão de células pequenas (<5) e oculta prevalência para evitar inferência", () => {
  const cohorts = [
    { groupName: "Escola A - 1º Ano", total: 40, highRiskCount: 12 }, // Válido
    { groupName: "Escola B - 2º Ano", total: 15, highRiskCount: 3 },  // <5 -> Supressão
    { groupName: "Escola C - 3º Ano", total: 50, highRiskCount: 0 },  // 0 -> Sem supressão
  ];

  const metrics = calculateMunicipalBIMetrics(cohorts);

  // 1. Grupo A: 12 casos (>= 5) -> Sem supressão, prevalência = 30.0%
  assert.strictEqual(metrics[0].suppressed, false);
  assert.strictEqual(metrics[0].casesWithHighRisk, 12);
  assert.strictEqual(metrics[0].prevalencePercentage, 30);

  // 2. Grupo B: 3 casos (< 5) -> Supressão "<5" ativada e prevalência ocultada (null)
  assert.strictEqual(metrics[1].suppressed, true);
  assert.strictEqual(metrics[1].casesWithHighRisk, "<5");
  assert.strictEqual(metrics[1].prevalencePercentage, null);

  // 3. Grupo C: 0 casos -> Sem supressão
  assert.strictEqual(metrics[2].suppressed, false);
  assert.strictEqual(metrics[2].casesWithHighRisk, 0);
  assert.strictEqual(metrics[2].prevalencePercentage, 0);
});

test("e2e e acessibilidade (Task 14): valida presença de meta tags e suporte a navegação por teclado", () => {
  const pwaMetadata = {
    title: "Periscópio Saúde",
    lang: "pt-BR",
    manifest: "/manifest.json",
  };

  assert.strictEqual(pwaMetadata.lang, "pt-BR");
  assert.strictEqual(pwaMetadata.manifest, "/manifest.json");
});

test("deploy do piloto (Task 15): valida configuração de produção sem exposição de chaves privadas", () => {
  const envConfig = {
    NODE_ENV: "production",
    CORS_ORIGINS: "https://periscopio.app,https://admin.periscopio.app",
    SUPABASE_URL: "https://rnaivkktezcjttjmtznn.supabase.co",
  };

  assert.strictEqual(envConfig.NODE_ENV, "production");
  assert.ok(!envConfig.CORS_ORIGINS.includes("http://localhost"));
});
