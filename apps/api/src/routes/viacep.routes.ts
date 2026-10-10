import type { FastifyInstance } from "fastify";

export interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia?: string;
  ddd?: string;
  siafi?: string;
  erro?: boolean | string;
}

const cepCache = new Map<string, ViaCepResponse>();

export async function viacepRoutes(app: FastifyInstance) {
  app.get<{ Params: { cep: string } }>(
    "/api/cep/:cep",
    {
      schema: {
        description: "Consulta endereço completo por CEP via integração ViaCEP oficial para cadastro de escolas, profissionais e pacientes",
        tags: ["Localização & CEP"],
        params: {
          type: "object",
          properties: {
            cep: { type: "string", description: "CEP com ou sem formatação (8 dígitos)" },
          },
          required: ["cep"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              cep: { type: "string" },
              logradouro: { type: "string" },
              complemento: { type: "string" },
              bairro: { type: "string" },
              localidade: { type: "string" },
              uf: { type: "string" },
              ibge: { type: "string" },
              ddd: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: { error: { type: "string" } },
          },
          404: {
            type: "object",
            properties: { error: { type: "string" } },
          },
        },
      },
    },
    async (request, reply) => {
      const rawCep = request.params.cep || "";
      const cleanCep = rawCep.replace(/\D/g, "");

      if (cleanCep.length !== 8) {
        return reply.status(400).send({
          error: "CEP inválido. Deve conter exatamente 8 dígitos numéricos.",
        });
      }

      if (cepCache.has(cleanCep)) {
        return reply.send(cepCache.get(cleanCep));
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);

        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "User-Agent": "PeriscopioSaude/2.0 (sistema-medico-escolar)",
          },
        });
        clearTimeout(timeout);

        if (!response.ok) {
          return reply.status(502).send({
            error: "Falha na comunicação com o serviço ViaCEP.",
          });
        }

        const data: ViaCepResponse = await response.json();

        if (data.erro === true || data.erro === "true") {
          return reply.status(404).send({
            error: `CEP ${cleanCep} não encontrado na base dos Correios.`,
          });
        }

        const result = {
          cep: data.cep || `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`,
          logradouro: data.logradouro || "",
          complemento: data.complemento || "",
          bairro: data.bairro || "",
          localidade: data.localidade || "",
          uf: (data.uf || "").toUpperCase(),
          ibge: data.ibge || "",
          ddd: data.ddd || "",
        };

        cepCache.set(cleanCep, result);
        return reply.send(result);
      } catch (err: any) {
        if (err.name === "AbortError") {
          return reply.status(504).send({
            error: "Tempo de resposta do serviço ViaCEP excedido (timeout).",
          });
        }
        return reply.status(500).send({
          error: `Erro ao consultar CEP: ${err.message || "desconhecido"}`,
        });
      }
    }
  );
}
