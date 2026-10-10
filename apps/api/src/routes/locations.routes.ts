import type { FastifyInstance } from "fastify";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CidadeDataset {
  estados: Array<{
    sigla: string;
    nome: string;
    cidades: string[];
  }>;
}

let cachedDataset: CidadeDataset | null = null;

function getCidadeDataset(): CidadeDataset {
  if (cachedDataset) return cachedDataset;
  const possiblePaths = [
    path.resolve(__dirname, "../../scripts/data/cidade.json"),
    path.resolve(__dirname, "../scripts/data/cidade.json"),
    path.resolve(process.cwd(), "apps/api/scripts/data/cidade.json"),
    path.resolve(process.cwd(), "scripts/data/cidade.json"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf8");
      cachedDataset = JSON.parse(content);
      return cachedDataset!;
    }
  }

  return { estados: [] };
}

const REGIOES: Record<string, string> = {
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

export async function locationsRoutes(app: FastifyInstance) {
  // Lista todos os 27 estados brasileiros
  app.get("/api/locations/states", async () => {
    const dataset = getCidadeDataset();
    return {
      total: dataset.estados.length,
      estados: dataset.estados.map((e) => ({
        sigla: e.sigla,
        nome: e.nome,
        regiao: REGIOES[e.sigla] ?? "Sudeste",
        totalCidades: e.cidades.length,
      })),
    };
  });

  // Lista cidades de uma UF (ex: /api/locations/cities/SP)
  app.get<{ Params: { uf: string } }>("/api/locations/cities/:uf", async (request, reply) => {
    const uf = request.params.uf.toUpperCase().trim();
    const dataset = getCidadeDataset();
    const estado = dataset.estados.find((e) => e.sigla === uf);

    if (!estado) {
      return reply.status(404).send({ error: `Estado com sigla "${uf}" não encontrado` });
    }

    return {
      sigla: estado.sigla,
      nome: estado.nome,
      regiao: REGIOES[estado.sigla] ?? "Sudeste",
      totalCidades: estado.cidades.length,
      cidades: estado.cidades,
    };
  });

  // Query parameter alternativo: /api/locations/cities?uf=SP
  app.get<{ Querystring: { uf?: string } }>("/api/locations/cities", async (request, reply) => {
    const uf = request.query.uf?.toUpperCase().trim();
    if (!uf) {
      return reply.status(400).send({ error: "Parâmetro 'uf' é obrigatório (ex: ?uf=SP)" });
    }

    const dataset = getCidadeDataset();
    const estado = dataset.estados.find((e) => e.sigla === uf);

    if (!estado) {
      return reply.status(404).send({ error: `Estado com sigla "${uf}" não encontrado` });
    }

    return {
      sigla: estado.sigla,
      nome: estado.nome,
      regiao: REGIOES[estado.sigla] ?? "Sudeste",
      totalCidades: estado.cidades.length,
      cidades: estado.cidades,
    };
  });
}
