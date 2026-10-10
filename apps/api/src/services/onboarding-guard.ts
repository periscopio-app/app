import {
  ALLOWED_SPECIALTIES,
  professionalSchema,
  professionalsListSchema,
  validateCpf,
} from "@periscopio/shared";

export { ALLOWED_SPECIALTIES, validateCpf, professionalSchema, professionalsListSchema };
export const MAX_PROFESSIONALS = 50;

export function validateProfessionalsInput(list: unknown): { ok: true } | { ok: false; error: string } {
  if (list === undefined || list === null) return { ok: true };
  if (!Array.isArray(list)) return { ok: false, error: "Lista de profissionais inválida." };
  
  const parsed = professionalsListSchema.safeParse(list);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const field = firstIssue?.path.join(".") || "campo";
    return { ok: false, error: `${firstIssue?.message || "Dados de profissional inválidos"} (${field}).` };
  }

  return { ok: true };
}
