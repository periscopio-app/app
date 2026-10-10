/**
 * Dados e serviços de localização geográfica (Países, Estados e Cidades do Brasil).
 * Estados e Cidades são montados a partir do json oficial cidade.json (5.568 municípios nos 27 estados).
 */
import countriesData from "./countries.json";
import cidadeData from "./cidade.json";

export interface Country {
  sigla: string;
  nome_pais: string;
  nome_pais_int: string;
  gentilico: string;
}

export function getCountryFlag(sigla: string): string {
  if (!sigla || sigla.length !== 2) return "🌐";
  try {
    const chars = [...sigla.toUpperCase()].map((c) => 127397 + c.charCodeAt(0));
    return String.fromCodePoint(...chars);
  } catch {
    return "🌐";
  }
}

export type BrazilianRegion = "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";

export interface BrazilianState {
  uf: string;
  name: string;
  region: BrazilianRegion;
  cidadesCount?: number;
}

export interface City {
  id: string | number;
  name: string;
  uf: string;
}

export const COUNTRIES: Country[] = countriesData;

const STATE_REGIONS: Record<string, BrazilianRegion> = {
  AC: "Norte",
  AP: "Norte",
  AM: "Norte",
  PA: "Norte",
  RO: "Norte",
  RR: "Norte",
  TO: "Norte",
  AL: "Nordeste",
  BA: "Nordeste",
  CE: "Nordeste",
  MA: "Nordeste",
  PB: "Nordeste",
  PE: "Nordeste",
  PI: "Nordeste",
  RN: "Nordeste",
  SE: "Nordeste",
  DF: "Centro-Oeste",
  GO: "Centro-Oeste",
  MT: "Centro-Oeste",
  MS: "Centro-Oeste",
  ES: "Sudeste",
  MG: "Sudeste",
  RJ: "Sudeste",
  SP: "Sudeste",
  PR: "Sul",
  RS: "Sul",
  SC: "Sul",
};

/**
 * Estados do Brasil montados diretamente a partir do arquivo cidade.json
 */
export const BRAZILIAN_STATES: BrazilianState[] = (
  cidadeData.estados as Array<{ sigla: string; nome: string; cidades: string[] }>
).map((e) => ({
  uf: e.sigla,
  name: e.nome,
  region: STATE_REGIONS[e.sigla] ?? "Sudeste",
  cidadesCount: e.cidades.length,
}));

/**
 * Mapa em memória de municípios por UF montado a partir de cidade.json.
 */
const CITIES_BY_UF_CACHE: Record<string, City[]> = {};

for (const estado of cidadeData.estados) {
  const cleanUf = estado.sigla.toUpperCase();
  CITIES_BY_UF_CACHE[cleanUf] = estado.cidades.map((name, idx) => ({
    id: `${cleanUf}-${idx}`,
    name,
    uf: cleanUf,
  }));
}

/**
 * Retorna sincronamente as cidades de uma UF a partir de cidade.json (0ms).
 */
export function getCitiesByStateSync(uf: string): City[] {
  const cleanUf = uf.toUpperCase().trim();
  return CITIES_BY_UF_CACHE[cleanUf] ?? [];
}

/**
 * Busca de cidades por estado (UF).
 * Retorna imediatamente os dados de cidade.json com fallback para a API oficial do IBGE.
 */
export async function fetchCitiesByState(uf: string): Promise<City[]> {
  const cleanUf = uf.toUpperCase().trim();
  if (!cleanUf) return [];

  const localCities = CITIES_BY_UF_CACHE[cleanUf];
  if (localCities && localCities.length > 0) {
    return localCities;
  }

  // Fallback online via API oficial do IBGE caso a UF não seja encontrada localmente
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${cleanUf}/municipios`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (res.ok) {
      const data: Array<{ id: number; nome: string }> = await res.json();
      const cities: City[] = data
        .map((c) => ({ id: c.id, name: c.nome, uf: cleanUf }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

      if (cities.length > 0) {
        CITIES_BY_UF_CACHE[cleanUf] = cities;
        return cities;
      }
    }
  } catch {
    // Falha tolerada
  }

  return [];
}
