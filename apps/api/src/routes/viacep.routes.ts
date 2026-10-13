import type { FastifyInstance } from "fastify";
import { lookupCep } from "../services/cep.service";

export async function viacepRoutes(app: FastifyInstance) {
  app.get<{ Params: { cep: string } }>(
    "/api/cep/:cep",
    {
      schema: {
        description: "Consulta endereço completo por CEP por provedores gratuitos (BrasilAPI, ViaCEP, OpenCEP) para cadastro de escolas, profissionais e pacientes",
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
            description: "Endereço localizado",
            type: "object",
            properties: {
              cep: { type: "string", example: "19820-000" },
              logradouro: { type: "string", example: "Avenida das Nações" },
              complemento: { type: "string", example: "Próximo à Secretaria de Educação" },
              bairro: { type: "string", example: "Centro" },
              localidade: { type: "string", example: "Tarumã" },
              uf: { type: "string", example: "SP" },
              ibge: { type: "string", example: "3553904" },
              ddd: { type: "string", example: "18" },
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
          502: {
            type: "object",
            properties: { error: { type: "string" } },
          },
        },
      },
    },
    async (request, reply) => {
      const cleanCep = (request.params.cep || "").replace(/\D/g, "");

      if (cleanCep.length !== 8) {
        return reply.status(400).send({
          error: "CEP inválido. Deve conter exatamente 8 dígitos numéricos.",
        });
      }

      const r = await lookupCep(cleanCep);
      if (r.status === "ok") return reply.send(r.address);
      if (r.status === "not_found") {
        return reply.status(404).send({ error: `CEP ${cleanCep} não encontrado.` });
      }
      return reply.status(502).send({
        error: "Não foi possível consultar os serviços de CEP agora. Preencha o endereço manualmente.",
      });
    }
  );
}
