/**
 * SNAP-IV — Catálogo de itens e metadados
 * Fontes: ANEXOS cap MD 2109 (FORM 1), Cap RE ESCOLAR Plataforma 1809 (Formulário G) e a página do
 * "Formulário H: SNAP-IV" enviada pela Dra. em 26/out/2026 (18 itens completos).
 * Versão em português validada por Mattos P et al, 2005.
 *
 * REGRA DE PRODUTO (Dra., 23/out): os formulários não têm pesos nem pontos de corte. O sistema só conta
 * quantos itens estão em "Bastante" ou "Demais" em cada bloco e mostra o número; não compara com limiar,
 * não rotula sintoma e não classifica. A leitura clínica é do profissional.
 */

export const SNAP4_FORM_CODE = "snap4" as const;
export const SNAP4_VERSION = "1.0.0" as const;
export const SNAP4_FONTE_VERSAO = "Versão em português validada por Mattos P et al, 2005." as const;

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
  { id: "SNAP4-12", n: 12, bloco: "itens_10_a_18", texto: "Corre de um lado para outro ou sobe demais nas coisas em situações em que isto é inapropriado." },
  { id: "SNAP4-13", n: 13, bloco: "itens_10_a_18", texto: "Tem dificuldade em brincar ou envolver-se em atividades de lazer de forma calma." },
  { id: "SNAP4-14", n: 14, bloco: "itens_10_a_18", texto: "Não para ou frequentemente está a “mil por hora”." },
  { id: "SNAP4-15", n: 15, bloco: "itens_10_a_18", texto: "Fala em excesso." },
  { id: "SNAP4-16", n: 16, bloco: "itens_10_a_18", texto: "Responde às perguntas de forma precipitada antes de elas terem sido terminadas." },
  { id: "SNAP4-17", n: 17, bloco: "itens_10_a_18", texto: "Tem dificuldade em esperar sua vez." },
  { id: "SNAP4-18", n: 18, bloco: "itens_10_a_18", texto: "Interrompe os outros ou se intromete (por exemplo, mete-se nas conversas ou jogos)." },
];

export const SNAP4_CONTAGENS: Snap4Contagem[] = [
  {
    id: "snap4_c1",
    rotulo: "Itens 1 a 9 marcados Bastante ou Demais",
    itens: ["SNAP4-01","SNAP4-02","SNAP4-03","SNAP4-04","SNAP4-05","SNAP4-06","SNAP4-07","SNAP4-08","SNAP4-09"],
    conta_valores: ["bastante", "demais"],
  },
  {
    id: "snap4_c2",
    rotulo: "Itens 10 a 18 marcados Bastante ou Demais",
    itens: ["SNAP4-10","SNAP4-11","SNAP4-12","SNAP4-13","SNAP4-14","SNAP4-15","SNAP4-16","SNAP4-17","SNAP4-18"],
    conta_valores: ["bastante", "demais"],
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

/**
 * Texto de referência impresso no formulário-fonte (critérios B a E). São lembretes para o profissional;
 * o sistema não os avalia. O critério A (contagem de itens) aparece só como número, sem limiar.
 */
export const SNAP4_CRITERIOS_TEXTO: { id: string; texto: string }[] = [
  { id: "A", texto: "O SNAP-IV é útil para avaliar apenas o primeiro dos critérios (critério A). Existem outros critérios que também são necessários." },
  { id: "B", texto: "Alguns desses sintomas devem estar presentes antes dos 7 anos de idade." },
  { id: "C", texto: "Existem problemas causados pelos sintomas acima em pelo menos 2 contextos diferentes (por ex., na escola, no trabalho, na vida social e em casa)." },
  { id: "D", texto: "Há problemas evidentes na vida escolar, social ou familiar por conta dos sintomas." },
  { id: "E", texto: "Se existe um outro problema (tal como depressão, deficiência mental, psicose, etc.), os sintomas não podem ser atribuídos exclusivamente a ele." },
];

export function makeSnap4PayloadVazio(): Snap4Payload {
  return {
    snap4_version: SNAP4_VERSION,
    respostas: {},
    rodape: {},
  };
}

/** Conta os itens em "Bastante" ou "Demais" em cada bloco. Só números: sem limiar, sem rótulo, sem classificação. */
export function calcularContagem(payload: Snap4Payload): {
  c1: { contagem: number; total: number };
  c2: { contagem: number; total: number };
} {
  const conta = (ids: string[]) => ({
    contagem: ids.filter((id) => {
      const v = payload.respostas[id];
      return v === "bastante" || v === "demais";
    }).length,
    total: ids.length,
  });
  return { c1: conta(SNAP4_CONTAGENS[0].itens), c2: conta(SNAP4_CONTAGENS[1].itens) };
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
