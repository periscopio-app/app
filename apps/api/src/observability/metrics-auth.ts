import { timingSafeEqual } from "node:crypto";

/**
 * Confere o Bearer enviado ao /metrics. Tolera espaços e quebras de linha nas pontas dos dois lados
 * (erro comum ao colar o segredo no painel da Render ou do Grafana) e um "Bearer " repetido.
 * `expected` vazio ou só com espaços conta como "rota desligada" e nunca autoriza.
 */
export function metricsTokenOk(authorization: string | undefined, expected: string | undefined): boolean {
  const want = (expected ?? "").trim();
  if (!want) return false;
  const given = (authorization ?? "").trim().replace(/^(Bearer\s+)+/i, "").trim();
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const metricsEnabled = (expected: string | undefined): boolean => (expected ?? "").trim().length > 0;
