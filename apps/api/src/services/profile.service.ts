import { z } from "zod";

/**
 * Dados que a própria pessoa pode editar no "Meu painel".
 *
 * Ficam de fora, de propósito: e-mail (é o login), perfil/papel, escola, especialidade e registro no
 * conselho (CRM/CRP...) — quem define é a gestão da plataforma — e o CPF, que nunca é exibido por inteiro.
 * `.strict()` faz a API recusar qualquer campo fora desta lista em vez de ignorá-lo em silêncio.
 */
export const perfilPatchSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome com pelo menos 2 letras.").max(120, "O nome pode ter até 120 caracteres.").optional(),
    phone: z.string().trim().max(30, "Telefone muito longo.").nullable().optional(),
    bio: z.string().trim().max(280, "A apresentação pode ter até 280 caracteres.").nullable().optional(),
  })
  .strict();

export type PerfilPatch = z.infer<typeof perfilPatchSchema>;

/** Telefone brasileiro: só dígitos, 10 (fixo) ou 11 (celular), aceitando +55. Vazio apaga. */
export function normalizarTelefone(valor: string | null | undefined): { ok: true; value: string | null } | { ok: false; error: string } {
  if (valor === null || valor === undefined) return { ok: true, value: null };
  let digitos = valor.replace(/\D/g, "");
  if (digitos === "") return { ok: true, value: null };
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) digitos = digitos.slice(2);
  if (digitos.length !== 10 && digitos.length !== 11) {
    return { ok: false, error: "Telefone inválido. Use DDD + número, por exemplo (11) 91234-5678." };
  }
  if (/^(\d)\1+$/.test(digitos)) return { ok: false, error: "Telefone inválido." };
  return { ok: true, value: digitos };
}

/** Mostra só os dois últimos dígitos do CPF: ***.***.***-NN. */
export function mascararCpf(cpf: string | null | undefined): string | null {
  if (!cpf) return null;
  const d = cpf.replace(/\D/g, "");
  if (d.length < 2) return null;
  return `***.***.***-${d.slice(-2)}`;
}

/** Texto vazio vira null (apagar o campo). */
export function textoOuNulo(valor: string | null | undefined): string | null {
  if (valor === null || valor === undefined) return null;
  const t = valor.trim();
  return t === "" ? null : t;
}
