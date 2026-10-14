/**
 * Envio de e-mails em formato HTML/texto via API direta do Resend.
 */
export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY não configurada" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? "Periscópio <no-reply@projetoperiscopio.com.br>",
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { ok: false, error: data.message ?? `Resend HTTP ${res.status}` };
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "falha de rede" };
  }
}
