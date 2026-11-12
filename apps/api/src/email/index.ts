import { Resend } from "resend";
import { fromAddress } from "./sender";

export type SendEmailResult = { ok: true; id?: string } | { ok: false; error: string };

/**
 * Envia e DEVOLVE o resultado, sem lançar. Quem precisa dizer ao usuário se o e-mail saiu (convite, link de acesso)
 * usa esta função e mostra o `error`; o Resend devolve `{ error }` em vez de lançar, e sem olhar para ele uma chave
 * inválida ou um domínio não verificado passa em silêncio.
 */
export async function sendEmailResult(to: string, subject: string, html: string): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY não configurada" };

  try {
    const result = await new Resend(apiKey).emails.send({ from: fromAddress(), to, subject, html });
    if (result.error) return { ok: false, error: `Resend recusou o envio (${result.error.name}): ${result.error.message}` };
    return { ok: true, id: result.data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "falha de rede" };
  }
}

/** Versão que lança, para os chamadores que já tratam exceção (Better Auth, formulários públicos). */
export async function sendEmail(to: string, subject: string, html: string) {
  const result = await sendEmailResult(to, subject, html);
  if (!result.ok) throw new Error(result.error);
  return result;
}
