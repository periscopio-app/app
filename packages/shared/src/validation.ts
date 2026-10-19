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

export const VALID_SPECIALTIES = [
  "fonoaudiologia",
  "medicina",
  "neuropsicologia",
  "psicologia",
  "psicopedagogia",
  "psicomotricidade",
  "servico_social",
] as const;

export type ValidSpecialty = (typeof VALID_SPECIALTIES)[number];

export const ALLOWED_SPECIALTIES = VALID_SPECIALTIES;

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
  lgpdConsentAccepted: z.boolean().refine((val) => val === true, {
    message: "É obrigatório aceitar o Termo de Responsabilidade Clínica e Proteção de Dados (LGPD).",
  }).optional(),
});

export const professionalsListSchema = z
  .array(professionalSchema)
  .min(1, "Cadastre ao menos um profissional")
  .max(50, "No máximo 50 profissionais por envio");

export type ProfessionalFormData = z.infer<typeof professionalSchema>;

/**
 * Validação rigorosa de texto clínico, parecer de especialista e conduta médica.
 * Exige um mínimo de 100 caracteres para garantir embasamento técnico, descritivo e rastreabilidade conforme LGPD e diretrizes clínicas do NEMT.
 */
export const clinicalOpinionTextSchema = z
  .string({ required_error: "O parecer clínico é obrigatório" })
  .trim()
  .min(100, "O parecer ou descrição clínica deve conter no mínimo 100 caracteres para fundamentação técnica adequada.");

export const specialistOpinionSchema = z.object({
  notes: clinicalOpinionTextSchema,
  specialty: z.string().min(2).optional(),
  markAsCompleted: z.boolean().optional(),
});

export type SpecialistOpinionFormData = z.infer<typeof specialistOpinionSchema>;

/**
 * CPF opcional, mas, quando informado, precisa passar na máscara e nos dois dígitos verificadores.
 * Vazio vira undefined; válido vira "000.000.000-00".
 */
export const optionalCpfSchema = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || validateCpf(v), {
    message: "CPF inválido: confira os 11 dígitos e os dígitos verificadores.",
  })
  .transform((v) => (v === undefined ? undefined : formatCpf(v)));

/** Aceite do TCLE pelo responsável legal. */
export const CONSENT_SIGNER_ROLES = ["mae", "pai", "responsavel_legal", "outro"] as const;

export const consentAcceptSchema = z.object({
  signerName: z
    .string({ required_error: "Informe o nome completo do responsável." })
    .trim()
    .min(5, "Informe o nome completo do responsável (nome e sobrenome).")
    .max(200, "Nome muito longo."),
  signerRole: z.enum(CONSENT_SIGNER_ROLES, {
    errorMap: () => ({ message: "Escolha o grau de parentesco na lista." }),
  }),
  signerDocument: optionalCpfSchema,
});

/** Mensagem de erro do CPF para campos de formulário (null = válido ou vazio). */
export function cpfFieldError(value: string): string | null {
  const parsed = optionalCpfSchema.safeParse(value);
  return parsed.success ? null : parsed.error.issues[0]?.message ?? "CPF inválido.";
}
