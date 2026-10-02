import { NextResponse } from "next/server";
import { Resend } from "resend";
import { Pool } from "pg";

let pool: Pool | null = null;
function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nome, email, escola, org, instituicao, cargo, rede, tipo, msg } = body;

    const leadNome = (nome || "").trim();
    const leadEmail = (email || "").trim().toLowerCase();
    const leadInstituicao = (instituicao || org || escola || "").trim();
    const leadCargo = (cargo || tipo || "Candidatura Piloto").trim();
    const leadRede = (rede || (tipo === "Governo" ? "publica" : "privada")).toLowerCase();
    const leadMensagem = (msg || "").trim();

    if (!leadNome || !leadEmail) {
      return NextResponse.json(
        { error: "Nome e e-mail são obrigatórios." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(leadEmail)) {
      return NextResponse.json(
        { error: "E-mail informado é inválido." },
        { status: 400 }
      );
    }

    // 1. Salvar no banco (se configurado)
    const dbPool = getPool();
    if (dbPool) {
      try {
        await dbPool.query(
          `INSERT INTO leads (nome, email, escola, cargo, rede)
           VALUES ($1, $2, $3, $4, $5)`,
          [leadNome, leadEmail, leadInstituicao || "Não informada", leadCargo, leadRede]
        );
      } catch (dbErr) {
        console.warn("Aviso ao persistir lead no banco (continuando com envio):", dbErr);
      }
    }

    // 2. Disparar notificação por e-mail para equipe@projetoperiscopio.com.br via Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    const destinatario = "equipe@projetoperiscopio.com.br";
    const remetente = process.env.RESEND_FROM_EMAIL || "equipe@projetoperiscopio.com.br";

    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
          <div style="border-bottom: 2px solid #8a3d93; padding-bottom: 16px; margin-bottom: 24px;">
            <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #8a3d93;">Periscópio Saúde Mental</span>
            <h1 style="margin: 8px 0 0; font-size: 22px; color: #0f172a;">🎯 Novo Lead / Candidatura ao Piloto</h1>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-size: 14px; width: 140px; font-weight: 500;">Nome:</td>
              <td style="padding: 10px 0; color: #0f172a; font-size: 15px; font-weight: 600;">${leadNome}</td>
            </tr>
            <tr style="border-top: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: 500;">E-mail:</td>
              <td style="padding: 10px 0; font-size: 15px;"><a href="mailto:${leadEmail}" style="color: #2563eb; text-decoration: none; font-weight: 600;">${leadEmail}</a></td>
            </tr>
            <tr style="border-top: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: 500;">Instituição / Escola:</td>
              <td style="padding: 10px 0; color: #0f172a; font-size: 15px;">${leadInstituicao || "Não informada"}</td>
            </tr>
            <tr style="border-top: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: 500;">Tipo / Cargo:</td>
              <td style="padding: 10px 0; color: #0f172a; font-size: 15px;">${leadCargo}</td>
            </tr>
            <tr style="border-top: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: 500;">Rede:</td>
              <td style="padding: 10px 0; color: #0f172a; font-size: 15px; text-transform: capitalize;">${leadRede}</td>
            </tr>
            ${leadMensagem ? `
            <tr style="border-top: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: 500; vertical-align: top;">Mensagem:</td>
              <td style="padding: 10px 0; color: #334155; font-size: 14px; line-height: 1.5; white-space: pre-wrap;">${leadMensagem}</td>
            </tr>
            ` : ""}
          </table>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #94a3b8; display: flex; justify-content: space-between;">
            <span>Programa Periscópio</span>
            <span>${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
          </div>
        </div>
      `;

      try {
        await resend.emails.send({
          from: remetente,
          to: destinatario,
          replyTo: leadEmail,
          subject: `Novo Lead do Piloto: ${leadNome} - ${leadInstituicao || "Periscópio"}`,
          html: emailHtml,
        });
      } catch (emailErr) {
        console.error("Erro ao enviar e-mail via Resend:", emailErr);
      }
    } else {
      console.warn("RESEND_API_KEY não configurada no ambiente.");
    }

    return NextResponse.json({ ok: true, message: "Candidatura enviada com sucesso! Entraremos em contato." });
  } catch (error) {
    console.error("Erro no processamento de /api/leads:", error);
    return NextResponse.json(
      { error: "Ocorreu um erro ao processar o formulário. Tente novamente mais tarde." },
      { status: 500 }
    );
  }
}
