/** Guardrails do cadastro em lote de profissionais (complete-school). */
export const ALLOWED_SPECIALTIES = [
  "psicopedagogia",
  "medicina",
  "fonoaudiologia",
  "psicologia",
  "neuropsicologia",
  "psicomotricidade",
  "servico_social",
] as const;
export const MAX_PROFESSIONALS = 50;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateProfessionalsInput(list: unknown): { ok: true } | { ok: false; error: string } {
  if (list === undefined || list === null) return { ok: true };
  if (!Array.isArray(list)) return { ok: false, error: "Lista de profissionais inválida." };
  if (list.length > MAX_PROFESSIONALS) {
    return { ok: false, error: `No máximo ${MAX_PROFESSIONALS} profissionais por envio.` };
  }
  for (const p of list) {
    if (!p || typeof p !== "object") return { ok: false, error: "Profissional inválido." };
    const { name, email, specialty } = p as Record<string, unknown>;
    if (typeof name !== "string" || !name.trim() || name.length > 200) {
      return { ok: false, error: "Nome de profissional inválido." };
    }
    if (typeof email !== "string" || !EMAIL_RE.test(email.trim()) || email.length > 255) {
      return { ok: false, error: "E-mail de profissional inválido." };
    }
    if (typeof specialty !== "string" || !(ALLOWED_SPECIALTIES as readonly string[]).includes(specialty)) {
      return { ok: false, error: "Especialidade não reconhecida." };
    }
  }
  return { ok: true };
}
