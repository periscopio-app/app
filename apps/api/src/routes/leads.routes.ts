import type { FastifyInstance } from "fastify";
import { db } from "../db/client";
import { leads } from "@periscopio/shared";

interface LeadBody {
  nome: string;
  email: string;
  escola: string;
  cargo: string;
}

export async function leadsRoutes(app: FastifyInstance) {
  app.post<{ Body: LeadBody }>("/api/leads", async (request, reply) => {
    const { nome, email, escola, cargo } = request.body ?? {};

    if (!nome || !email || !escola || !cargo) {
      return reply.status(400).send({ error: "Todos os campos são obrigatórios" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return reply.status(400).send({ error: "E-mail inválido" });
    }

    await db.insert(leads).values({ nome, email, escola, cargo });

    app.log.info({ email, escola }, "novo lead capturado");

    return reply.status(201).send({ ok: true });
  });
}
