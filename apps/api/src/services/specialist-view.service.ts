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
import { MD_FORMS, normalizarPayloadMedico, sumarioMedicoComoTexto } from "@periscopio/shared";

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
  campos: { id: string; rotulo: string; tipo: "texto" | "lista" | "data"; valor: string | null; itens?: string[] }[];
}

export function sumarioExecutivoMedico(row: SumarioMedicoRow | undefined | null): SumarioExecutivoMedico {
  if (!row || row.status !== "concluido") return { status: "pendente", registro: null, completedAt: null, campos: [] };
  const p = row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {};
  const payload = normalizarPayloadMedico(SUMARIO_MEDICO_FORM_ID, p);
  const campos = MD_FORMS.sumario_medico.campos.map((campo) => {
    const valor = payload[campo.id]?.trim() || null;
    if (campo.tipo === "multi") {
      const marcados = new Set((payload[campo.id] ?? "").split(",").filter(Boolean));
      const itens = (campo.opcoes ?? []).filter((opcao) => marcados.has(opcao.valor)).map((opcao) => opcao.rotulo);
      return {
        id: campo.id,
        rotulo: campo.rotulo.replace(/\s*\([^)]*\)\s*$/, ""),
        tipo: "lista" as const,
        valor: null,
        itens,
      };
    }
    if (campo.tipo === "data") return { id: campo.id, rotulo: campo.rotulo, tipo: "data" as const, valor };
    return { id: campo.id, rotulo: campo.rotulo, tipo: "texto" as const, valor };
  });
  return { status: "concluido", registro: sumarioMedicoComoTexto(p), completedAt: row.completedAt, campos };
}
