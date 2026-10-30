/**
 * Templates de e-mail transacional com a identidade visual do Periscópio
 * (roxo #682880, verde-petróleo #3D6B6B, fundo #F6F9FB).
 * Estilos inline e layout em tabela, por compatibilidade com clientes de e-mail.
 */

const BRAND = {
  primary: "#682880",
  teal: "#3D6B6B",
  bg: "#F6F9FB",
  border: "#E1E9ED",
  text: "#14202B",
  muted: "#5B6B78",
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

interface LayoutOptions {
  preheader: string;
  title: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  footnote: string;
}

function layout(o: LayoutOptions): string {
  const logo = `${appUrl()}/landing-logo.webp`;
  return `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:Arial,Helvetica,sans-serif;color:${BRAND.text};">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(o.preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
        <tr><td style="background:${BRAND.primary};padding:24px 32px;" align="left">
          <img src="${logo}" alt="Periscópio Saúde" height="40" style="display:block;height:40px;border:0;" />
        </td></tr>
        <tr><td style="height:4px;background:${BRAND.teal};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:22px;color:${BRAND.primary};">${escapeHtml(o.title)}</h1>
          ${o.bodyHtml}
          <p style="margin:28px 0;">
            <a href="${o.ctaUrl}" style="background:${BRAND.primary};color:#ffffff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block;">${escapeHtml(o.ctaLabel)}</a>
          </p>
          <p style="font-size:12px;color:${BRAND.muted};word-break:break-all;">
            Se o botão não funcionar, copie e cole este link no navegador:<br/>${o.ctaUrl}
          </p>
          <hr style="border:none;border-top:1px solid ${BRAND.border};margin:24px 0;" />
          <p style="font-size:12px;color:${BRAND.muted};margin:0;">${escapeHtml(o.footnote)}</p>
        </td></tr>
        <tr><td style="background:${BRAND.bg};padding:16px 32px;font-size:11px;color:${BRAND.muted};">
          Periscópio Saúde · Plataforma de Saúde Mental Escolar · Dados protegidos conforme a LGPD.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function verificationEmail(name: string, url: string) {
  return {
    subject: "Confirme seu e-mail — Periscópio Saúde",
    html: layout({
      preheader: "Confirme seu e-mail para ativar o acesso ao Periscópio.",
      title: "Confirme seu e-mail",
      bodyHtml: `<p style="margin:0 0 12px;line-height:1.5;">Olá, <strong>${escapeHtml(name)}</strong>.</p>
          <p style="margin:0;line-height:1.5;">Recebemos o seu cadastro no Periscópio Saúde. Para ativar o acesso, confirme o seu endereço de e-mail.</p>`,
      ctaLabel: "Confirmar e-mail",
      ctaUrl: url,
      footnote: "Se você não criou esta conta, ignore este e-mail. Nenhuma ação é necessária.",
    }),
  };
}

export function resetPasswordEmail(name: string, url: string) {
  return {
    subject: "Redefinição de senha — Periscópio Saúde",
    html: layout({
      preheader: "Use o link para criar uma nova senha.",
      title: "Redefinir sua senha",
      bodyHtml: `<p style="margin:0 0 12px;line-height:1.5;">Olá, <strong>${escapeHtml(name)}</strong>.</p>
          <p style="margin:0;line-height:1.5;">Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha.</p>`,
      ctaLabel: "Criar nova senha",
      ctaUrl: url,
      footnote: "Se você não fez este pedido, ignore este e-mail. Sua senha atual continua valendo.",
    }),
  };
}

/** Link para criar (primeiro acesso) ou redefinir a senha de quem já está cadastrado. */
export function accessLinkEmail(name: string, url: string) {
  return {
    subject: "Crie ou redefina sua senha — Periscópio Saúde",
    html: layout({
      preheader: "Use o link para definir a sua senha de acesso ao Periscópio.",
      title: "Defina a sua senha",
      bodyHtml: `<p style="margin:0 0 12px;line-height:1.5;">Olá, <strong>${escapeHtml(name)}</strong>.</p>
          <p style="margin:0;line-height:1.5;">Recebemos um pedido para criar ou redefinir a senha de acesso ao Periscópio Saúde com este e-mail. Clique no botão abaixo para escolher a sua senha.</p>`,
      ctaLabel: "Definir minha senha",
      ctaUrl: url,
      footnote: "O link vale por 1 hora e só pode ser usado uma vez. Se você não fez este pedido, ignore este e-mail: nada será alterado.",
    }),
  };
}

export function twoFactorOtpEmail(name: string, otp: string) {
  const BRAND_PRIMARY = "#682880";
  const BRAND_BG = "#F6F9FB";
  const BRAND_BORDER = "#E1E9ED";
  const BRAND_TEXT = "#14202B";
  const BRAND_MUTED = "#5B6B78";
  return {
    subject: "Código de verificação — Periscópio Saúde",
    html: `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:${BRAND_BG};font-family:Arial,Helvetica,sans-serif;color:${BRAND_TEXT};">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">Código de verificação em dois fatores — válido por 10 minutos.</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_BG};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid ${BRAND_BORDER};border-radius:16px;overflow:hidden;">
        <tr><td style="background:${BRAND_PRIMARY};padding:24px 32px;">
          <span style="color:#ffffff;font-size:20px;font-weight:bold;">Periscópio Saúde</span>
        </td></tr>
        <tr><td style="height:4px;background:#3D6B6B;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:22px;color:${BRAND_PRIMARY};">Código de verificação</h1>
          <p style="margin:0 0 12px;line-height:1.5;">Olá, <strong>${escapeHtml(name)}</strong>.</p>
          <p style="margin:0 0 24px;line-height:1.5;">Use o código abaixo para confirmar seu acesso. Ele é válido por <strong>10 minutos</strong> e só pode ser usado uma vez.</p>
          <div style="text-align:center;margin:24px 0;padding:20px;background:${BRAND_BG};border:2px dashed ${BRAND_PRIMARY};border-radius:12px;">
            <span style="font-size:36px;font-weight:bold;letter-spacing:0.3em;color:${BRAND_PRIMARY};">${escapeHtml(otp)}</span>
          </div>
          <p style="font-size:12px;color:${BRAND_MUTED};margin:0;">Se você não tentou acessar o Periscópio agora, ignore este e-mail. Não compartilhe este código com ninguém.</p>
          <hr style="border:none;border-top:1px solid ${BRAND_BORDER};margin:24px 0;" />
          <p style="font-size:12px;color:${BRAND_MUTED};margin:0;">Código de uso único gerado automaticamente. Não responda a este e-mail.</p>
        </td></tr>
        <tr><td style="background:${BRAND_BG};padding:16px 32px;font-size:11px;color:${BRAND_MUTED};">
          Periscópio Saúde · Plataforma de Saúde Mental Escolar · Dados protegidos conforme a LGPD.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

export const SPECIALTY_LABELS: Record<string, string> = {
  psicopedagogia: "Psicopedagogia",
  medicina: "Medicina",
  fonoaudiologia: "Fonoaudiologia",
  psicologia: "Psicologia",
  neuropsicologia: "Neuropsicologia",
  psicomotricidade: "Psicomotricidade",
  servico_social: "Serviço Social",
};

export function specialtyLabel(specialty?: string | null): string {
  if (!specialty) return "Profissional da equipe";
  return SPECIALTY_LABELS[specialty] ?? specialty;
}

/** Convite enviado ao profissional cadastrado por uma escola; confirmar libera o acesso. */
export function professionalInviteEmail(opts: {
  name: string;
  schoolName: string;
  specialty?: string | null;
  confirmUrl: string;
}) {
  const area = specialtyLabel(opts.specialty);
  return {
    subject: `${opts.schoolName} cadastrou você no Periscópio Saúde`,
    html: layout({
      preheader: `Confirme seu e-mail para acessar o Periscópio como ${area}.`,
      title: "Você foi cadastrado(a) no Periscópio",
      bodyHtml: `<p style="margin:0 0 12px;line-height:1.5;">Olá, <strong>${escapeHtml(opts.name)}</strong>.</p>
          <p style="margin:0 0 12px;line-height:1.5;">A escola <strong>${escapeHtml(opts.schoolName)}</strong> cadastrou você na equipe multiprofissional do Periscópio Saúde, na especialidade <strong>${escapeHtml(area)}</strong>.</p>
          <p style="margin:0;line-height:1.5;">Para liberar o seu acesso, clique no botão abaixo e crie a sua senha. Este link é pessoal e só funciona para este e-mail.</p>`,
      ctaLabel: "Criar minha senha e liberar o acesso",
      ctaUrl: opts.confirmUrl,
      footnote: "O link vale por 7 dias. Se você não reconhece este cadastro, ignore este e-mail: o acesso não será liberado.",
    }),
  };
}
