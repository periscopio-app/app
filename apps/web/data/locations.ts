/**
 * Dados e serviços de localização geográfica (Países, Estados e Cidades do Brasil).
 */
import countriesData from "./countries.json";

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

export interface BrazilianState {
  uf: string;
  name: string;
  region: "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";
}

export interface City {
  id: string | number;
  name: string;
  uf: string;
}

export const COUNTRIES: Country[] = countriesData;

export const BRAZILIAN_STATES: BrazilianState[] = [
  { uf: "AC", name: "Acre", region: "Norte" },
  { uf: "AL", name: "Alagoas", region: "Nordeste" },
  { uf: "AP", name: "Amapá", region: "Norte" },
  { uf: "AM", name: "Amazonas", region: "Norte" },
  { uf: "BA", name: "Bahia", region: "Nordeste" },
  { uf: "CE", name: "Ceará", region: "Nordeste" },
  { uf: "DF", name: "Distrito Federal", region: "Centro-Oeste" },
  { uf: "ES", name: "Espírito Santo", region: "Sudeste" },
  { uf: "GO", name: "Goiás", region: "Centro-Oeste" },
  { uf: "MA", name: "Maranhão", region: "Nordeste" },
  { uf: "MT", name: "Mato Grosso", region: "Centro-Oeste" },
  { uf: "MS", name: "Mato Grosso do Sul", region: "Centro-Oeste" },
  { uf: "MG", name: "Minas Gerais", region: "Sudeste" },
  { uf: "PA", name: "Pará", region: "Norte" },
  { uf: "PB", name: "Paraíba", region: "Nordeste" },
  { uf: "PR", name: "Paraná", region: "Sul" },
  { uf: "PE", name: "Pernambuco", region: "Nordeste" },
  { uf: "PI", name: "Piauí", region: "Nordeste" },
  { uf: "RJ", name: "Rio de Janeiro", region: "Sudeste" },
  { uf: "RN", name: "Rio Grande do Norte", region: "Nordeste" },
  { uf: "RS", name: "Rio Grande do Sul", region: "Sul" },
  { uf: "RO", name: "Rondônia", region: "Norte" },
  { uf: "RR", name: "Roraima", region: "Norte" },
  { uf: "SC", name: "Santa Catarina", region: "Sul" },
  { uf: "SP", name: "São Paulo", region: "Sudeste" },
  { uf: "SE", name: "Sergipe", region: "Nordeste" },
  { uf: "TO", name: "Tocantins", region: "Norte" },
];

/**
 * Cidades principais locais para resposta instantânea e fallback sem dependência de rede.
 */
const DEFAULT_CITIES_BY_STATE: Record<string, string[]> = {
  SP: ["São Paulo", "Tarumã", "Campinas", "Guarulhos", "São Bernardo do Campo", "Santo André", "Osasco", "Sorocaba", "Ribeirão Preto", "São José dos Campos", "Assis", "Marília", "Bauru", "Presidente Prudente", "Santos", "Piracicaba"],
  RJ: ["Rio de Janeiro", "São Gonçalo", "Duque de Caxias", "Nova Iguaçu", "Niterói", "Belford Roxo", "Campos dos Goytacazes", "Petrópolis", "Volta Redonda", "Macaé"],
  MG: ["Belo Horizonte", "Uberlândia", "Contagem", "Juiz de Fora", "Betim", "Montes Claros", "Ribeirão das Neves", "Uberaba", "Governador Valadares", "Ipatinga"],
  PR: ["Curitiba", "Londrina", "Maringá", "Ponta Grossa", "Cascavel", "São José dos Pinhais", "Foz do Iguaçu", "Colombo", "Guarapuava", "Paranaguá"],
  RS: ["Porto Alegre", "Caxias do Sul", "Canoas", "Pelotas", "Santa Maria", "Gravataí", "Viamão", "Novo Hamburgo", "São Leopoldo", "Rio Grande"],
  BA: ["Salvador", "Feira de Santana", "Vitória da Conquista", "Camaçari", "Juazeiro", "Itabuna", "Lauro de Freitas", "Ilhéus", "Jequié", "Teixeira de Freitas"],
  SC: ["Florianópolis", "Joinville", "Blumenau", "São José", "Chapecó", "Itajaí", "Criciúma", "Jaraguá do Sul", "Palhoça", "Lages"],
  GO: ["Goiânia", "Aparecida de Goiânia", "Anápolis", "Rio Verde", "Águas Lindas de Goiás", "Luziânia", "Valparaíso de Goiás", "Trindade", "Formosa", "Itumbiara"],
  PE: ["Recife", "Jaboatão dos Guararapes", "Olinda", "Caruaru", "Petrolina", "Paulista", "Cabo de Santo Agostinho", "Camaragibe", "Garanhuns", "Vitória de Santo Antão"],
  CE: ["Fortaleza", "Caucaia", "Juazeiro do Norte", "Maracanaú", "Sobral", "Crato", "Itapipoca", "Maranguape", "Iguatu", "Quixadá"],
  DF: ["Brasília", "Ceilândia", "Taguatinga", "Samambaia", "Plano Piloto", "Águas Claras", "Gama", "Guará", "Santa Maria", "Sobradinho"],
  ES: ["Vitória", "Vila Velha", "Serra", "Cariacica", "Cachoeiro de Itapememirim", "Linhares", "São Mateus", "Colatina", "Guarapari", "Aracruz"],
  PA: ["Belém", "Ananindeua", "Santarém", "Marabá", "Parauapebas", "Castanhal", "Abaetetuba", "Cametá", "Bragança", "Altamira"],
  MT: ["Cuiabá", "Várzea Grande", "Rondonópolis", "Sinop", "Tangará da Serra", "Sorriso", "Lucas do Rio Verde", "Primavera do Leste", "Barra do Garças"],
  MS: ["Campo Grande", "Dourados", "Três Lagoas", "Corumbá", "Ponta Porã", "Sidrolândia", "Naviraí", "Nova Andradina", "Aquidauana", "Maracaju"],
  MA: ["São Luís", "Imperatriz", "São José de Ribamar", "Timon", "Caxias", "Codó", "Paço do Lumiar", "Açailândia", "Bacabal", "Balsas"],
  PB: ["João Pessoa", "Campina Grande", "Santa Rita", "Patos", "Bayeux", "Sousa", "Cajazeiras", "Cabedelo", "Guarabira", "Mamanguape"],
  RN: ["Natal", "Mossoró", "Parnamirim", "São Gonçalo do Amarante", "Macaíba", "Ceará-Mirim", "Caicó", "Açu", "Currais Novos", "São José de Mipibu"],
  AL: ["Maceió", "Arapiraca", "Rio Largo", "Palmeira dos Índios", "União dos Palmares", "Penedo", "São Miguel dos Campos", "Campo Alegre", "Coruripe", "Delmiro Gouveia"],
  PI: ["Teresina", "Parnaíba", "Picos", "Piripiri", "Floriano", "Barras", "Campo Maior", "União", "Altos", "Esperantina"],
  SE: ["Aracaju", "Nossa Senhora do Socorro", "Lagarto", "Itabaiana", "São Cristóvão", "Estância", "Tobias Barreto", "Simão Dias", "Nossa Senhora da Glória", "Propriá"],
  RO: ["Porto Velho", "Ji-Paraná", "Ariquemes", "Vilhena", "Cacoal", "Rolim de Moura", "Jaru", "Guajará-Mirim", "Ouro Preto do Oeste", "Pimenta Bueno"],
  TO: ["Palmas", "Araguaína", "Gurupi", "Porto Nacional", "Paraíso do Tocantins", "Araguatins", "Colinas do Tocantins", "Guaraí", "Tocantinópolis", "Dianópolis"],
  AM: ["Manaus", "Parintins", "Itacoatiara", "Manacapuru", "Coari", "Tabatinga", "Maués", "Tefé", "Manicoré", "Humaitá"],
  AC: ["Rio Branco", "Cruzeiro do Sul", "Sena Madureira", "Tarauacá", "Feijó", "Brasiléia", "Senador Guiomard", "Plácido de Castro", "Xapuri", "Mâncio Lima"],
  AP: ["Macapá", "Santana", "Laranjal do Jari", "Oiapoque", "Porto Grande", "Mazagão", "Tartarugalzinho", "Pedra Branca do Amapari", "Vitória do Jari", "Calçoene"],
  RR: ["Boa Vista", "Rorainópolis", "Caracaraí", "Cantá", "Mucajaí", "Alto Alegre", "Pacaraima", "Bonfim", "Amajari", "Iracema"],
};

const cache: Record<string, City[]> = {};

/**
 * Busca a lista de municípios de uma UF.
 * Carrega dinamicamente a base completa local com 5.570 municípios do Brasil (0ms de latência),
 * com fallback para a API oficial do IBGE e cache em memória.
 */
export async function fetchCitiesByState(uf: string): Promise<City[]> {
  const cleanUf = uf.toUpperCase().trim();
  if (!cleanUf) return [];

  if (cache[cleanUf]) {
    return cache[cleanUf];
  }

  // 1. Base local completa (instantânea e resiliente a falhas de rede)
  try {
    const localData = await import("./brazil-cities.json");
    const estado = localData.estados?.find((e: { sigla: string }) => e.sigla === cleanUf);
    if (estado && Array.isArray(estado.cidades) && estado.cidades.length > 0) {
      const cities: City[] = estado.cidades
        .map((name: string, idx: number) => ({
          id: `${cleanUf}-${idx}`,
          name,
          uf: cleanUf,
        }))
        .sort((a: City, b: City) => a.name.localeCompare(b.name, "pt-BR"));

      cache[cleanUf] = cities;
      return cities;
    }
  } catch {
    // Continua para o fallback de rede caso ocorra erro
  }

  // 2. Fallback online via API oficial do IBGE
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
        cache[cleanUf] = cities;
        return cities;
      }
    }
  } catch {
    // Falha de rede tolerada
  }

  // 3. Fallback estático das cidades principais
  const defaultList = DEFAULT_CITIES_BY_STATE[cleanUf] ?? [];
  const fallbackCities: City[] = defaultList.map((name, idx) => ({
    id: `${cleanUf}-${idx}`,
    name,
    uf: cleanUf,
  }));

  cache[cleanUf] = fallbackCities;
  return fallbackCities;
}
