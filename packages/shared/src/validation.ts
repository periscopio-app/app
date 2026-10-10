import { z } from "zod";

/**
 * Validador oficial de CPF conforme algoritmo da Receita Federal (módulo 11).
 * Rejeita dígitos repetidos e verifica os 2 dígitos verificadores.
 */
export function validateCpf(cpfRaw: string): boolean {
  if (!cpfRaw) return false;
  const cpf = cpfRaw.replace(/\D/g, "");

  if (cpf.length !== 11) return false;

  // Rejeita sequências repetidas como 111.111.111-11
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // Primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i), 10) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(9), 10)) return false;

  // Segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i), 10) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(10), 10)) return false;

  return true;
}

/**
 * Aplica máscara de CPF no formato 000.000.000-00
 */
export function formatCpf(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Aplica máscara de Telefone brasileiro (10 ou 11 dígitos): (00) 00000-0000 ou (00) 0000-0000
 */
export function formatPhone(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export const ALLOWED_SPECIALTIES = [
  "psicopedagogia",
  "medicina",
  "fonoaudiologia",
  "psicologia",
  "neuropsicologia",
  "psicomotricidade",
  "servico_social",
] as const;

export const professionalSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Nome completo deve ter pelo menos 3 caracteres")
    .max(200, "Nome deve ter no máximo 200 caracteres"),
  email: z
    .string()
    .trim()
    .email("E-mail profissional inválido")
    .max(255, "E-mail deve ter no máximo 255 caracteres"),
  phone: z
    .string()
    .trim()
    .min(10, "Telefone / WhatsApp é obrigatório com DDD (mínimo 10 dígitos)"),
  cpf: z
    .string()
    .trim()
    .refine((val) => validateCpf(val), {
      message: "CPF obrigatório e deve ser válido (11 dígitos com dígito verificador correto)",
    }),
  classCode: z
    .string()
    .trim()
    .min(2, "Registro / Conselho de Classe é obrigatório (ex: CRP, CRM, CBO, etc.)")
    .max(50, "Registro de classe muito longo"),
  specialty: z.enum(ALLOWED_SPECIALTIES, {
    errorMap: () => ({ message: "Especialidade inválida" }),
  }),
});

export const professionalsListSchema = z
  .array(professionalSchema)
  .min(1, "Cadastre ao menos um profissional")
  .max(50, "No máximo 50 profissionais por envio");

export type ProfessionalFormData = z.infer<typeof professionalSchema>;
