/**
 * Consulta de CEP com cadeia de provedores gratuitos e sem chave.
 *
 * Ordem: BrasilAPI v2 (agrega Correios, ViaCEP e outros) → ViaCEP → OpenCEP.
 * - "Não encontrado" definitivo (404 / erro:true) encerra a cadeia.
 * - Falha de rede, timeout, 5xx, 429 ou resposta inválida passa para o próximo.
 */

export interface CepAddress {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  ddd: string;
}

export type CepLookup =
  | { status: "ok"; address: CepAddress; provider: string }
  | { status: "not_found" }
  | { status: "unavailable" };

interface Provider {
  name: string;
  url: (cep: string) => string;
  /** Devolve o endereço, "not_found" se o provedor afirma que o CEP não existe, ou null se a resposta é inutilizável. */
  parse: (data: any, cep: string) => CepAddress | "not_found" | null;
}

const fmt = (cep: string) => `${cep.slice(0, 5)}-${cep.slice(5)}`;
const str = (v: unknown) => (typeof v === "string" ? v : "");

const PROVIDERS: Provider[] = [
  {
    name: "brasilapi",
    url: (cep) => `https://brasilapi.com.br/api/cep/v2/${cep}`,
    parse: (d, cep) => {
      if (!d || typeof d !== "object" || !d.city || !d.state) return null;
      return {
        cep: fmt(cep),
        logradouro: str(d.street),
        complemento: "",
        bairro: str(d.neighborhood),
        localidade: str(d.city),
        uf: str(d.state).toUpperCase(),
        ibge: "",
        ddd: "",
      };
    },
  },
  {
    name: "viacep",
    url: (cep) => `https://viacep.com.br/ws/${cep}/json/`,
    parse: (d, cep) => {
      if (!d || typeof d !== "object") return null;
      if (d.erro === true || d.erro === "true") return "not_found";
      if (!d.localidade || !d.uf) return null;
      return {
        cep: str(d.cep) || fmt(cep),
        logradouro: str(d.logradouro),
        complemento: str(d.complemento),
        bairro: str(d.bairro),
        localidade: str(d.localidade),
        uf: str(d.uf).toUpperCase(),
        ibge: str(d.ibge),
        ddd: str(d.ddd),
      };
    },
  },
  {
    name: "opencep",
    url: (cep) => `https://opencep.com/v1/${cep}`,
    parse: (d, cep) => {
      if (!d || typeof d !== "object" || !d.localidade || !d.uf) return null;
      return {
        cep: str(d.cep) || fmt(cep),
        logradouro: str(d.logradouro),
        complemento: str(d.complemento),
        bairro: str(d.bairro),
        localidade: str(d.localidade),
        uf: str(d.uf).toUpperCase(),
        ibge: str(d.ibge),
        ddd: "",
      };
    },
  },
];

const TIMEOUT_MS = 3500;
const CACHE_MAX = 2000;
const cache = new Map<string, CepAddress>();

export function clearCepCache() {
  cache.clear();
}

async function ask(p: Provider, cep: string): Promise<CepAddress | "not_found" | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(p.url(cep), {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "PeriscopioSaude/2.0 (+https://periscopio.app)" },
    });
    if (res.status === 404) return "not_found";
    if (!res.ok) return null; // 429, 5xx, etc.: tenta o próximo
    return p.parse(await res.json(), cep);
  } catch {
    return null; // rede, DNS, TLS, timeout, JSON inválido
  } finally {
    clearTimeout(timer);
  }
}

export async function lookupCep(cleanCep: string): Promise<CepLookup> {
  const hit = cache.get(cleanCep);
  if (hit) return { status: "ok", address: hit, provider: "cache" };

  for (const p of PROVIDERS) {
    const r = await ask(p, cleanCep);
    if (r === "not_found") return { status: "not_found" };
    if (r) {
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
      cache.set(cleanCep, r);
      return { status: "ok", address: r, provider: p.name };
    }
  }
  return { status: "unavailable" };
}
