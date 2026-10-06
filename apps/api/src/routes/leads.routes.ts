import type { FastifyInstance } from "fastify";
import { db } from "../db/client";
import { leads } from "@periscopio/shared";
import { sendEmail } from "../email/index";

interface LeadBody {
  nome: string;
  email: string;
  escola: string;
  cargo: string;
  rede: "publica" | "privada";
}

const CARGOMAP: Record<string, string> = {
  gestor_escolar: "Gestor(a) escolar",
  secretaria_educacao: "Secretaria de Educação",
  professor: "Professor(a)",
  psicologo: "Psicólogo(a) / PpI",
  medico: "Médico(a) / MD1",
  outro: "Outro",
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

export async function leadsRoutes(app: FastifyInstance) {
  app.post<{ Body: LeadBody }>("/api/leads", async (request, reply) => {
    const { nome, email, escola, cargo, rede } = request.body ?? {};

    if (!nome || !email || !escola || !cargo || !rede) {
      return reply.status(400).send({ error: "Todos os campos são obrigatórios" });
    }

    if (rede !== "publica" && rede !== "privada") {
      return reply.status(400).send({ error: "Valor inválido para rede" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return reply.status(400).send({ error: "E-mail inválido" });
    }

    await db.insert(leads).values({ nome, email, escola, cargo, rede });

    app.log.info("novo lead capturado");

    const safeNome = escapeHtml(nome);
    const safeEmail = escapeHtml(email);
    const safeEscola = escapeHtml(escola);
    const safeCargo = escapeHtml(CARGOMAP[cargo] ?? cargo);
    const safeRede = rede === "publica" ? "Pública" : "Privada";

    // Notificação interna — não bloqueia a resposta
    sendEmail(
      "equipe@projetoperiscopio.com.br",
      `Novo interesse no piloto: ${safeEscola}`,
      `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px">
          <h2 style="margin:0 0 24px;color:#0f172a">Novo interesse no piloto</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#64748b;width:120px">Nome</td><td style="padding:8px 0;font-weight:600">${safeNome}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b">E-mail</td><td style="padding:8px 0"><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
            <tr><td style="padding:8px 0;color:#64748b">Escola</td><td style="padding:8px 0">${safeEscola}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b">Cargo</td><td style="padding:8px 0">${safeCargo}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b">Rede</td><td style="padding:8px 0">${safeRede}</td></tr>
          </table>
          <p style="margin:24px 0 0;font-size:12px;color:#94a3b8">Periscópio Saúde · Lead capturado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
        </div>
      `
    ).catch((err) => app.log.error({ err }, "falha ao enviar email de lead"));

    return reply.status(201).send({ ok: true });
  });
}
