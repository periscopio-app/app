/**
 * ABC — Autism Behavior Checklist
 * Fonte: Forms Autismo plataforma jan 26.doc
 * Krug, Arick e Almond, 1993; validado por Marteleto e Pedromônico, 2005
 * Versão: 0.1.0-rascunho · aprovação clínica: PENDENTE
 *
 * ATENÇÃO: Pesos existem APENAS para os itens 52 a 57.
 * Itens 1 a 51 sem peso na fonte. NÃO IMPLEMENTAR O CÁLCULO ATÉ VALIDAÇÃO.
 * Colunas sem rótulo na fonte; faixa intermediária sem números; modo de marcação não declarado.
 */

export const ABC_FORM_CODE = "abc" as const;
export const ABC_VERSION = "0.1.0-rascunho" as const;

export interface AbcItem {
  id: string;
  n: number;
  texto: string;
  coluna_fonte: number | null; // 1–5; null = sem peso na fonte
  peso_fonte: number | null;
}

export interface AbcPayload {
  abc_version: string;
  respostas: Record<string, "sim" | "nao" | null>;
}

/**
 * Elegibilidade: criança > 3 anos (provisório; a fonte diz "> 3 anos" sem esclarecer 3a0m ou 3a1m).
 * Campo: idade_total_meses do caso; op: gte; valor: 36.
 * Pendência: confirmar com responsável clínico (questão 6 do documento).
 */
export const ABC_ELEGIBILIDADE_MIN_MESES = 36;

export const ABC_ITENS: AbcItem[] = [
  { id: "ABC-01", n: 1, texto: "Gira em torno de si por longo período de tempo.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-02", n: 2, texto: "Aprende uma tarefa, mas esquece rapidamente.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-03", n: 3, texto: "Raro atender estímulo não-verbal social ambiente (expressões, gesto, situações).", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-04", n: 4, texto: "Não responde à solicitações verbais-venha cá; sente-se.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-05", n: 5, texto: "Usa brinquedos inapropriadamente.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-06", n: 6, texto: "Pobre uso da discriminação visual (fixa um aspecto).", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-07", n: 7, texto: "Ausência do sorriso social.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-08", n: 8, texto: "Uso inadequado de pronomes (eu por ele).", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-09", n: 9, texto: "Insiste em manter certos objetos consigo.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-10", n: 10, texto: "Parece não escutar (suspeita-se de perda de audição).", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-11", n: 11, texto: "Fala monótona e sem ritmo.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-12", n: 12, texto: "Balança-se por longos períodos de tempo.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-13", n: 13, texto: "Não estende o braço para ser pego, mesmo bebê.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-14", n: 14, texto: "Fortes reações frente a mudanças no ambiente.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-15", n: 15, texto: "Ausência de atenção ao seu nome entre 2 crianças.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-16", n: 16, texto: "Corre com giros em torno de si, balança de mãos.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-17", n: 17, texto: "Sem resposta para expressão facial/sentimento de outros.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-18", n: 18, texto: 'Raramente usa "sim" ou "eu".', coluna_fonte: null, peso_fonte: null },
  { id: "ABC-19", n: 19, texto: "Possui habilidade numa área do desenvolvimento.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-20", n: 20, texto: "Sem respostas a solicitações verbais.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-21", n: 21, texto: "Reação de sobressalto a som intenso (surdez?).", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-22", n: 22, texto: "Balança as mãos.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-23", n: 23, texto: 'Intensos acessos de raiva e/ou frequentes "chiliques".', coluna_fonte: null, peso_fonte: null },
  { id: "ABC-24", n: 24, texto: "Evita ativamente o contato visual.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-25", n: 25, texto: "Resiste ao toque / ao ser pego / ao carinho.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-26", n: 26, texto: "Não reage a estímulos dolorosos.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-27", n: 27, texto: "Difícil e rígido no colo (ou foi quando bebê).", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-28", n: 28, texto: "Flácido quando no colo.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-29", n: 29, texto: "Aponta para indicar objeto desejado.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-30", n: 30, texto: "Anda nas pontas dos pés.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-31", n: 31, texto: "Machuca outros mordendo, batendo etc..", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-32", n: 32, texto: "Repete a mesma frase muitas vezes.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-33", n: 33, texto: "Ausência de imitação de brincadeiras de outros.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-34", n: 34, texto: "Ausência de reação do piscar quando luz forte nos olhos.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-35", n: 35, texto: "Machuca-se mordendo, batendo a cabeça, etc..", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-36", n: 36, texto: "Não espera para ser atendido (quer imediatamente).", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-37", n: 37, texto: "Não aponta para mais que cinco objetos.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-38", n: 38, texto: "Dificuldade de fazer amigos.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-39", n: 39, texto: "Tapa as orelhas para vários sons.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-40", n: 40, texto: "Gira, bate objetos muitas vezes.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-41", n: 41, texto: "Dificuldade para o treino de toalete.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-42", n: 42, texto: "0 a 5 palavras/dia para indicar necessidades e desejo.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-43", n: 43, texto: "Frequentemente muito ansioso ou medroso.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-44", n: 44, texto: "Franze, cobre ou vira os olhos na luz natural.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-45", n: 45, texto: "Não se veste sem ajuda.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-46", n: 46, texto: "Repete constantemente as mesmas palavras e/ou sons.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-47", n: 47, texto: '"Olha através" das pessoas.', coluna_fonte: null, peso_fonte: null },
  { id: "ABC-48", n: 48, texto: "Repete perguntas e frases ditas por outras pessoas.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-49", n: 49, texto: "Frequentemente inconsciente dos perigos.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-50", n: 50, texto: "Prefere manipular e ocupar-se com objetos inanimados.", coluna_fonte: null, peso_fonte: null },
  { id: "ABC-51", n: 51, texto: "Toca, cheira ou lambe objetos do ambiente.", coluna_fonte: null, peso_fonte: null },
  // Itens com peso na fonte:
  { id: "ABC-52", n: 52, texto: "Não reage com os olhos à presença de pessoas.", coluna_fonte: 1, peso_fonte: 3 },
  { id: "ABC-53", n: 53, texto: "Repete sequências de comportamentos complicados", coluna_fonte: 3, peso_fonte: 4 },
  { id: "ABC-54", n: 54, texto: "Destrutivo com seus brinquedos e coisas da família.", coluna_fonte: 3, peso_fonte: 2 },
  { id: "ABC-55", n: 55, texto: "Atraso no desenvolvimento antes dos 30 meses.", coluna_fonte: 5, peso_fonte: 1 },
  { id: "ABC-56", n: 56, texto: "Usa 15 e menos que 30 frases diárias para comunicar-se.", coluna_fonte: 4, peso_fonte: 3 },
  { id: "ABC-57", n: 57, texto: "Olha o ambiente por longos períodos de tempo.", coluna_fonte: 1, peso_fonte: 4 },
];

export function makeAbcPayloadVazio(): AbcPayload {
  return { abc_version: ABC_VERSION, respostas: {} };
}

export function validarPayloadAbc(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return "Payload inválido";
  const p = payload as Record<string, unknown>;
  const respostas = p["respostas"];
  if (respostas && typeof respostas === "object") {
    for (const [key, val] of Object.entries(respostas as Record<string, unknown>)) {
      if (val !== null && val !== "sim" && val !== "nao") {
        return `Item ${key}: valor inválido — use sim, nao ou null`;
      }
    }
  }
  return null;
}

/**
 * Calcula totais parciais (só para os 6 itens com peso conhecido).
 * NÃO IMPLEMENTAR total geral até os pesos 1-51 serem validados.
 */
export function calcularTotaisParciais(payload: AbcPayload): {
  calculavel: boolean;
  motivo: string;
  totais_parciais: { item_id: string; coluna: number; peso: number; marcado: boolean }[];
} {
  const comPeso = ABC_ITENS.filter((i) => i.coluna_fonte !== null && i.peso_fonte !== null);
  const totais_parciais = comPeso.map((item) => ({
    item_id: item.id,
    coluna: item.coluna_fonte!,
    peso: item.peso_fonte!,
    marcado: payload.respostas[item.id] === "sim",
  }));
  return {
    calculavel: false, // total geral bloqueado até pesos 1-51 chegarem
    motivo: "Pesos dos itens 1 a 51 pendentes de validação clínica — total geral indisponível",
    totais_parciais,
  };
}
