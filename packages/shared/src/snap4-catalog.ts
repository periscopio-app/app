/**
 * SNAP-IV — Catálogo de itens e metadados
 * Fontes: ANEXOS cap MD 2109.pdf (FORM 1) e Cap RE ESCOLAR Plataforma 1809.pdf (Formulário G)
 * Versão: 0.1.0-rascunho · aprovação clínica: PENDENTE
 *
 * ATENÇÃO: A fonte tem 11 itens, mas a regra de avaliação cita itens 1 a 18.
 * Itens 12 a 18 AUSENTES NA FONTE. NÃO IMPLEMENTAR ATÉ VALIDAÇÃO.
 */

export const SNAP4_FORM_CODE = "snap4" as const;
export const SNAP4_VERSION = "0.1.0-rascunho" as const;

export type OpcaoSnap4 = "nem_um_pouco" | "so_um_pouco" | "bastante" | "demais";
export type BlocoSnap4 = "itens_1_a_9" | "itens_10_a_18" | "rodape";

export interface Snap4Item {
  id: string;
  n: number;
  texto: string;
  bloco: BlocoSnap4;
}

export interface Snap4RodapeItem {
  id: string;
  rotulo: string;
  tipo: "sim_nao_exclusivo" | "texto" | "numero" | "data" | "identificacao_da_sessao";
  visivel_se?: { campo: string; op: "eq"; valor: string };
  nota?: string;
  apenas_na_versao?: string;
}

export interface Snap4Contagem {
  id: string;
  rotulo: string;
  itens: string[];
  conta_valores: OpcaoSnap4[];
  limiar_fonte: number;
  calculavel: boolean;
  itens_ausentes_na_fonte?: number[];
}

export interface Snap4Payload {
  snap4_version: string;
  respostas: Record<string, OpcaoSnap4 | null>;
  rodape: Record<string, string | null>;
}

export const SNAP4_OPCOES: { valor: OpcaoSnap4; rotulo: string }[] = [
  { valor: "nem_um_pouco", rotulo: "Nem um pouco" },
  { valor: "so_um_pouco", rotulo: "Só um pouco" },
  { valor: "bastante", rotulo: "Bastante" },
  { valor: "demais", rotulo: "Demais" },
];

export const SNAP4_ITENS: Snap4Item[] = [
  { id: "SNAP4-01", n: 1, bloco: "itens_1_a_9", texto: "Não consegue prestar atenção a detalhes ou comete erros por descuido nos trabalhos da escola ou tarefas." },
  { id: "SNAP4-02", n: 2, bloco: "itens_1_a_9", texto: "Tem dificuldade de manter a atenção em tarefas ou em atividades de lazer." },
  { id: "SNAP4-03", n: 3, bloco: "itens_1_a_9", texto: "Parece não estar ouvindo quando se fala diretamente com ele." },
  { id: "SNAP4-04", n: 4, bloco: "itens_1_a_9", texto: "Não segue instruções até o fim e não termina deveres da escola, tarefas ou obrigações." },
  { id: "SNAP4-05", n: 5, bloco: "itens_1_a_9", texto: "Tem dificuldade para organizar tarefas e atividades." },
  { id: "SNAP4-06", n: 6, bloco: "itens_1_a_9", texto: "Evita, não gosta ou se envolve contra a vontade em tarefas que exigem esforço mental prolongado." },
  { id: "SNAP4-07", n: 7, bloco: "itens_1_a_9", texto: "Perde coisas necessárias para atividades, como, por exemplo, brinquedos, deveres da escola, lápis ou livros." },
  { id: "SNAP4-08", n: 8, bloco: "itens_1_a_9", texto: "Distrai-se com estímulos externos." },
  { id: "SNAP4-09", n: 9, bloco: "itens_1_a_9", texto: "É esquecido em atividades do dia a dia." },
  { id: "SNAP4-10", n: 10, bloco: "itens_10_a_18", texto: "Mexe com as mãos ou com os pés, ou se remexe na cadeira." },
  { id: "SNAP4-11", n: 11, bloco: "itens_10_a_18", texto: "Sai do lugar na sala de aula ou em outras situações em que se espera que fique sentado." },
  // NÃO IMPLEMENTAR ATÉ VALIDAÇÃO: itens 12 a 18 ausentes na fonte
];

export const SNAP4_CONTAGENS: Snap4Contagem[] = [
  {
    id: "snap4_c1",
    rotulo: "Itens 1 a 9 marcados Bastante ou Demais",
    itens: ["SNAP4-01","SNAP4-02","SNAP4-03","SNAP4-04","SNAP4-05","SNAP4-06","SNAP4-07","SNAP4-08","SNAP4-09"],
    conta_valores: ["bastante", "demais"],
    limiar_fonte: 6,
    calculavel: true,
  },
  {
    id: "snap4_c2",
    rotulo: "Itens 10 a 18 marcados Bastante ou Demais",
    itens: ["SNAP4-10","SNAP4-11"],
    itens_ausentes_na_fonte: [12, 13, 14, 15, 16, 17, 18],
    conta_valores: ["bastante", "demais"],
    limiar_fonte: 6,
    calculavel: false, // itens 12-18 ausentes na fonte — NÃO IMPLEMENTAR ATÉ VALIDAÇÃO
  },
];

export const SNAP4_RODAPE: Snap4RodapeItem[] = [
  { id: "distribuido", rotulo: "O SNAP foi distribuído para pais, avós, demais adultos que convivem com a criança?", tipo: "sim_nao_exclusivo" },
  {
    id: "quem_respondeu",
    rotulo: "Quem respondeu?",
    tipo: "texto",
    visivel_se: { campo: "distribuido", op: "eq", valor: "sim" },
    nota: "condição presumida; a fonte não a declara",
  },
  { id: "quantos_snaps_30d", rotulo: "Quantos SNAPs foram aplicados no mesmo período (30 dias)?", tipo: "numero" },
  { id: "obs", rotulo: "OBS", tipo: "texto" },
  { id: "data", rotulo: "Data", tipo: "data" },
  { id: "profissional", rotulo: "RE", tipo: "identificacao_da_sessao" },
];

export const SNAP4_CRITERIOS_B_A_E_TEXTO = [
  "Critério B",
  "Critério C",
  "Critério D",
  "Critério E",
] as const;

export function makeSnap4PayloadVazio(): Snap4Payload {
  return {
    snap4_version: SNAP4_VERSION,
    respostas: {},
    rodape: {},
  };
}

/** Calcula contagem do bloco 1 (itens 1-9). Bloco 2 é marcado como não calculável. */
export function calcularContagem(payload: Snap4Payload): {
  c1: { contagem: number; total: number; limiar: number; calculavel: true };
  c2: { calculavel: false; motivo: string };
} {
  const c1Itens = SNAP4_CONTAGENS[0].itens;
  const contagem = c1Itens.filter((id) => {
    const v = payload.respostas[id];
    return v === "bastante" || v === "demais";
  }).length;
  return {
    c1: { contagem, total: c1Itens.length, limiar: 6, calculavel: true },
    c2: { calculavel: false, motivo: "Itens 12 a 18 ausentes na fonte — aguardando validação clínica" },
  };
}

export function validarPayloadSnap4(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return "Payload inválido";
  const p = payload as Record<string, unknown>;
  const respostas = p["respostas"];
  if (respostas && typeof respostas === "object") {
    const validos: Set<string> = new Set(["nem_um_pouco", "so_um_pouco", "bastante", "demais"]);
    for (const [key, val] of Object.entries(respostas as Record<string, unknown>)) {
      if (val !== null && !validos.has(val as string)) {
        return `Item ${key}: valor inválido`;
      }
    }
  }
  return null;
}
