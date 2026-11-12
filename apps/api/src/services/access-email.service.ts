import { credentialFingerprint } from "../auth/credentials";
import { ADMIN_ACCESS_LINK_TTL_MS, createAccessToken } from "../auth/access-link";
import { sendEmailResult, type SendEmailResult } from "../email";
import { accessLinkEmail } from "../email/templates";

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Monta o link de "criar/redefinir senha" do e-mail cadastrado e o envia, devolvendo o resultado (nunca lança).
 * `invited`: o administrador liberou o acesso (texto de boas-vindas e validade de 7 dias, porque a pessoa pode abrir
 * o e-mail dias depois). Sem `invited`, é o pedido feito por ela mesma em /primeiro-acesso (1 hora).
 */
export async function sendAccessLinkEmail(
  user: { email: string; name: string },
  opts: { invited?: boolean } = {},
): Promise<SendEmailResult> {
  try {
    const email = user.email.toLowerCase().trim();
    const fingerprint = await credentialFingerprint(email);
    const token = opts.invited
      ? createAccessToken(email, fingerprint, Date.now(), ADMIN_ACCESS_LINK_TTL_MS)
      : createAccessToken(email, fingerprint);
    const mail = accessLinkEmail(user.name, `${appUrl()}/redefinir?token=${encodeURIComponent(token)}`, {
      invited: opts.invited,
      validity: opts.invited ? "7 dias" : "1 hora",
    });
    return await sendEmailResult(email, mail.subject, mail.html);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "falha ao montar o link de acesso" };
  }
}
