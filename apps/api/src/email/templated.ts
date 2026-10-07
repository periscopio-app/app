/**
 * Envio de e-mails por template publicado no Resend (via REST: o SDK 4.8 não suporta `template`).
 * Os templates usam {{{VAR}}} (sem escape), então escapamos o HTML de toda variável aqui.
 */
export type TemplateAlias =
  | "expert-meeting-request"
  | "expert-meeting-confirmed"
  | "expert-meeting-declined";

const DEFAULT_ALIASES: Record<TemplateAlias, string> = {
  "expert-meeting-request": "expert-meeting-request",
  "expert-meeting-confirmed": "expert-meeting-confirmed",
  "expert-meeting-declined": "expert-meeting-declined",
};

export function escapeVar(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function templateId(alias: TemplateAlias): string {
  const envKey = `RESEND_TEMPLATE_${alias.toUpperCase().replace(/-/g, "_")}`;
  return process.env[envKey]?.trim() || DEFAULT_ALIASES[alias];
}

export type TemplatedEmailResult = { ok: true; id?: string } | { ok: false; error: string };

/** Nunca lança: falha de e-mail não pode derrubar o agendamento. */
export async function sendTemplatedEmail(params: {
  to: string | string[];
  alias: TemplateAlias;
  variables: Record<string, string>;
}): Promise<TemplatedEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY não configurada" };

  const variables = Object.fromEntries(
    Object.entries(params.variables).map(([k, v]) => [k, escapeVar(String(v ?? ""))]),
  );

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? "Periscópio <no-reply@projetoperiscopio.com.br>",
        to: params.to,
        template: { id: templateId(params.alias), variables },
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { ok: false, error: data.message ?? `Resend HTTP ${res.status}` };
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "falha de rede" };
  }
}
