/**
 * Visibilidade do especialista (decisão do Bruno/produto, 21/out/2026; substitui a regra de 07/out
 * "FOGAP + resumo final do médico e dos demais"):
 * o especialista vê SOMENTE
 *   - a própria seção delegada (rota de seções) e
 *   - o sumário executivo do médico, quando o médico o concluir.
 *
 * Não vê: o FOGAP nem a avaliação do RE, as seções de colegas (concluídas ou não), os demais formulários
 * do médico, a decisão de encerramento nem o nome de qualquer profissional.
 *
 * "Sumário executivo" = a própria seção/formulário concluído do profissional. Para o médico, é o
 * formulário "Sumário médico" (sumario_medico). Rascunho nunca sai do perfil de quem escreve.
 */
import { sumarioMedicoComoTexto } from "@periscopio/shared";

export const SUMARIO_MEDICO_FORM_ID = "sumario_medico" as const;

export interface SumarioMedicoRow {
  status: string;
  payload: unknown;
  completedAt: Date | null;
}

export interface SumarioExecutivoMedico {
  /** "concluido" quando há texto liberado; "pendente" enquanto o médico não concluiu. */
  status: "concluido" | "pendente";
  registro: string | null;
  completedAt: Date | null;
}

export function sumarioExecutivoMedico(row: SumarioMedicoRow | undefined | null): SumarioExecutivoMedico {
  if (!row || row.status !== "concluido") return { status: "pendente", registro: null, completedAt: null };
  const p = row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {};
  const registro = sumarioMedicoComoTexto(p);
  return { status: "concluido", registro, completedAt: row.completedAt };
}
