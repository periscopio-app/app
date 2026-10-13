import { randomBytes } from "node:crypto";

/** Alfabeto sem caracteres ambíguos (0/O, 1/I) para o código ser fácil de ditar e digitar. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Código pseudonimizado do aluno: sigla da escola + ano + 8 caracteres aleatórios criptográficos.
 * Não deriva de nenhum dado da criança, então não pode ser revertido para identificá-la.
 */
export function generateStudentCode(slug: string | null | undefined, year = new Date().getFullYear()): string {
  const bytes = randomBytes(8);
  let suffix = "";
  for (const b of bytes) suffix += ALPHABET[b % ALPHABET.length];
  const prefix = (slug ?? "ESC").replace(/[^a-zA-Z0-9]/g, "").substring(0, 4).toUpperCase() || "ESC";
  return `${prefix}-${year}-${suffix}`;
}

export interface StudentBirthInput {
  birthYear?: unknown;
  birthMonth?: unknown;
}

/** Valida ano/mês de nascimento (apenas esses dois campos são guardados — diretriz LGPD). */
export function validateBirth(input: StudentBirthInput, now = new Date()): { ok: true; birthYear: number; birthMonth: number } | { ok: false; error: string } {
  const y = Number(input.birthYear);
  const m = Number(input.birthMonth);
  if (!Number.isInteger(y) || y < now.getFullYear() - 30 || y > now.getFullYear()) {
    return { ok: false, error: `Ano de nascimento inválido (use entre ${now.getFullYear() - 30} e ${now.getFullYear()}).` };
  }
  if (!Number.isInteger(m) || m < 1 || m > 12) {
    return { ok: false, error: "Mês de nascimento inválido (1 a 12)." };
  }
  if (y === now.getFullYear() && m > now.getMonth() + 1) {
    return { ok: false, error: "Data de nascimento no futuro." };
  }
  return { ok: true, birthYear: y, birthMonth: m };
}

export function ageBracketOf(birthYear: number, birthMonth: number, now = new Date()): string {
  let age = now.getFullYear() - birthYear;
  if (now.getMonth() + 1 < birthMonth) age -= 1;
  if (age < 6) return "00-05";
  if (age < 10) return "06-09";
  if (age < 13) return "10-12";
  if (age < 18) return "13-17";
  return "18+";
}

/** Faixa do piloto: de 6 anos completos até 9 anos e 11 meses (72 a 119 meses). */
export const PILOT_AGE_MIN_MONTHS = 72;
export const PILOT_AGE_MAX_MONTHS = 119;

export function ageInMonths(birthYear: number, birthMonth: number, now = new Date()): number {
  return now.getFullYear() * 12 + (now.getMonth() + 1) - (birthYear * 12 + birthMonth);
}

/** Trava do cadastro de alunos no piloto. Aceita só quem tem de 6 anos a 9 anos e 11 meses. */
export function validatePilotAge(birthYear: number, birthMonth: number, now = new Date()): { ok: true } | { ok: false; error: string } {
  const months = ageInMonths(birthYear, birthMonth, now);
  if (months < PILOT_AGE_MIN_MONTHS || months > PILOT_AGE_MAX_MONTHS) {
    return { ok: false, error: "Fora da faixa do piloto: o cadastro aceita alunos de 6 anos a 9 anos e 11 meses." };
  }
  return { ok: true };
}
