import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { cases } from "@periscopio/shared";

export function calculateSnapIvScore(
  respostas: number[]
): "Desatenção" | "Hiperatividade" | null {
  const desatencao = respostas.slice(0, 9).filter((r) => r >= 2).length;
  const hiperatividade = respostas.slice(9, 18).filter((r) => r >= 2).length;

  if (desatencao >= 6) return "Desatenção";
  if (hiperatividade >= 6) return "Hiperatividade";
  return null;
}

export function calculateAbcScore(
  totalScore: number
): "Baixo" | "Leve" | "Moderada" | "Alta probabilidade" {
  if (totalScore < 47) return "Baixo";
  if (totalScore <= 53) return "Leve";
  if (totalScore <= 67) return "Moderada";
  return "Alta probabilidade";
}

export async function canProceedToMedical(
  caseId: string,
  isCrisisBypass: boolean
): Promise<void> {
  if (isCrisisBypass) return;

  const [caso] = await db
    .select()
    .from(cases)
    .where(eq(cases.id, caseId))
    .limit(1);

  if (!caso) {
    throw new Error(`Caso não encontrado: ${caseId}`);
  }

  if (!caso.dataInicioIntervencao) {
    throw new Error("data_inicio_intervencao não definida no caso");
  }

  const inicio = new Date(caso.dataInicioIntervencao);
  const hoje = new Date();
  const diffMs = hoje.getTime() - inicio.getTime();
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias < 120) {
    const faltam = 120 - diffDias;
    throw new Error(
      `Janela terapêutica: faltam ${faltam} dia(s) para encaminhar ao MD1`
    );
  }
}
