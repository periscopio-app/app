/**
 * Busca de endereço por CEP.
 * 1) API do Periscópio (cadeia BrasilAPI → ViaCEP → OpenCEP no servidor);
 * 2) se a API estiver fora do ar, BrasilAPI e depois ViaCEP direto do navegador (ambos gratuitos e com CORS aberto).
 */

export interface ViaCepAddress {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  ddd: string;
}

const cepCache: Record<string, ViaCepAddress> = {};

export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export async function fetchAddressByCep(rawCep: string): Promise<ViaCepAddress | null> {
  const cleanCep = rawCep.replace(/\D/g, "");
  if (cleanCep.length !== 8) return null;

  if (cepCache[cleanCep]) {
    return cepCache[cleanCep];
  }

  try {
    // 1. Tenta a rota interna da API Periscópio
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const res = await fetch(`${apiUrl}/api/cep/${cleanCep}`, {
      headers: { Accept: "application/json" },
    });

    if (res.ok) {
      const data: ViaCepAddress = await res.json();
      cepCache[cleanCep] = data;
      return data;
    }
  } catch {
    // Fallback direto para o ViaCEP caso a API interna não esteja acessível no cliente
  }

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`);
    if (res.ok) {
      const d = await res.json();
      if (d?.city && d?.state) {
        const addr: ViaCepAddress = {
          cep: formatCep(cleanCep),
          logradouro: d.street || "",
          complemento: "",
          bairro: d.neighborhood || "",
          localidade: d.city,
          uf: String(d.state).toUpperCase(),
          ibge: "",
          ddd: "",
        };
        cepCache[cleanCep] = addr;
        return addr;
      }
    }
  } catch {
    // tenta o próximo provedor
  }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    if (res.ok) {
      const data = await res.json();
      if (!data.erro) {
        const addr: ViaCepAddress = {
          cep: data.cep || formatCep(cleanCep),
          logradouro: data.logradouro || "",
          complemento: data.complemento || "",
          bairro: data.bairro || "",
          localidade: data.localidade || "",
          uf: (data.uf || "").toUpperCase(),
          ibge: data.ibge || "",
          ddd: data.ddd || "",
        };
        cepCache[cleanCep] = addr;
        return addr;
      }
    }
  } catch {
    // Falha silenciosa
  }

  return null;
}
