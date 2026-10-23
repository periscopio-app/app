/**
 * Retrato das escalas no Formulário I (Bloco 4).
 *
 * Gravado no ENVIO do RE, para que o médico veja o mesmo número que o RE viu e para que ele não mude depois
 * (a avaliação fica somente leitura). Só entra aqui o que a fonte permite calcular:
 *   ATA    — pontos por grupo (0/1/2) + 1 se apareceu antes dos 36 meses (regra do formulário-fonte).
 *   SNAP-IV — contagem dos itens 1 a 9 marcados "Bastante" ou "Demais". Os itens 10 a 18 só serão contados quando a
 *            Dra. validar os itens 12 a 18 (ausentes nos documentos). Pesos e pontos de corte: aguardando validação.
 * Nada aqui é diagnóstico, classe de risco ou recomendação.
 */
import { scoreAta, type AtaAnswers } from "./tea-scoring";
import { calcularContagem, SNAP4_ITENS, type Snap4Payload } from "./snap4-catalog";

export const ESCALAS_SUMARIO_VERSION = "0.1.0-rascunho" as const;

export interface EscalaAtaResumo {
  total: number;
  max: number;
  grupos_com_marca: number;
  grupos_total: number;
  antes_36_meses: boolean;
}

export interface EscalaSnap4Resumo {
  respondidos: number;
  itens_disponiveis: number;
  /** Itens 1 a 9 marcados Bastante ou Demais. */
  itens_1_a_9: { marcados: number; de: number; limiar_da_fonte: number };
  /** Itens 10 a 18: não contados até a validação clínica. */
  itens_10_a_18: { calculavel: false; motivo: string };
}

export interface EscalasSumario {
  versao: string;
  /** ATA enviada pelo RE (null = não enviada). */
  ata: EscalaAtaResumo | null;
  /** SNAP-IV opcional (null = não aplicado ou sem nenhuma resposta). */
  snap4: EscalaSnap4Resumo | null;
}

const objeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export function montarEscalasSumario(entrada: { ataAnswers?: unknown; ataEnviada?: boolean; snap4?: unknown }): EscalasSumario {
  let ata: EscalaAtaResumo | null = null;
  if (entrada.ataEnviada && objeto(entrada.ataAnswers)) {
    const a = entrada.ataAnswers as unknown as AtaAnswers;
    const s = scoreAta({ marcados: objeto(a.marcados) ? (a.marcados as AtaAnswers["marcados"]) : {}, antes36meses: a.antes36meses ?? null });
    ata = {
      total: s.total ?? 0,
      max: s.max ?? 0,
      grupos_com_marca: s.parts.filter((p) => p.points > 0).length,
      grupos_total: s.parts.length,
      antes_36_meses: a.antes36meses === true,
    };
  }

  let snap4: EscalaSnap4Resumo | null = null;
  if (objeto(entrada.snap4)) {
    const resp = (objeto((entrada.snap4 as any).respostas) ? (entrada.snap4 as any).respostas : {}) as Record<string, unknown>;
    const respondidos = SNAP4_ITENS.filter((it) => typeof resp[it.id] === "string" && resp[it.id]).length;
    if (respondidos > 0) {
      const c = calcularContagem({ snap4_version: "", respostas: resp as Snap4Payload["respostas"], rodape: {} });
      snap4 = {
        respondidos,
        itens_disponiveis: SNAP4_ITENS.length,
        itens_1_a_9: { marcados: c.c1.contagem, de: c.c1.total, limiar_da_fonte: c.c1.limiar },
        itens_10_a_18: { calculavel: false, motivo: c.c2.motivo },
      };
    }
  }
  return { versao: ESCALAS_SUMARIO_VERSION, ata, snap4 };
}
