/**
 * FOGAP — Formulário de Observação Geral do Aluno pelo Professor
 * Fonte: FOGAP.md (Drive do projeto) — 1º Trimestre do Ano Letivo
 * Versão do catálogo: 0.1.0-rascunho · aprovação clínica: PENDENTE (ver seção 11 do doc)
 *
 * Textos das perguntas copiados literalmente da fonte; nada foi reescrito.
 * O FOGAP não contém pontuação nem escore.
 * Piloto ativo: somente G3 (6 a 9 anos e 11 meses).
 */

export const FOGAP_FORM_CODE = "fogap" as const;
export const FOGAP_VERSION = "0.1.0-rascunho" as const;

export type GrupoId = "G1" | "G2" | "G3";
export type OpcaoDesenvolvimento = "adequada" | "inadequada";
export type OpcaoComportamento = "sim" | "nao";
export type EstadoFogap =
  | "aguardando_idade"
  | "fora_da_faixa"
  | "faixa_fora_do_piloto"
  | "rascunho"
  | "em_revisao";

export interface FogapItem {
  id: string;
  n: number;
  bloco_idade: string;
  fase_fonte: string | null;
  texto: string;
}

export interface FogapGrupoMeta {
  id: GrupoId;
  titulo: string;
  secao_fonte: string;
  idade_min_meses: number;
  idade_max_meses: number;
  infancia_fonte: string;
  ativo_no_piloto: boolean;
}

export interface FogapComportamentoItem {
  id: string;
  n: number;
  texto: string;
}

export interface FogapHistoricoInsuficiente {
  marcado: boolean;
  fonte: string | null;
  periodo_observado: string | null;
}

/** Datas dos encaminhamentos do Formulário I (AAAA-MM-DD, nunca futuras). */
export interface FogapEncaminhados {
  nucleo: string | null;
  cras: string | null;
  conselho_tutelar: string | null;
  ubs: string | null;
  outro_nome: string;
  outro: string | null;
}

export const FOGAP_DESTINOS: { key: Exclude<keyof FogapEncaminhados, "outro_nome" | "outro">; label: string }[] = [
  { key: "nucleo", label: "Núcleo" },
  { key: "cras", label: "CRAS" },
  { key: "conselho_tutelar", label: "Conselho Tutelar" },
  { key: "ubs", label: "UBS" },
];

/** Formulário I — Sumário da Avaliação do RE: é o que o médico recebe após o encaminhamento. */
export interface FogapSecaoSumario {
  dificuldades_persistentes: string[];
  conduta: "sim" | "nao" | null;
  qual: string;
  tempo: string;
  resultado: string;
  /** Série/ano escolar (texto curto). Opcional em registros antigos. */
  serie?: string;
  /** Queixa do professor, em linguagem observável. Sem nome nem dado que identifique a criança. */
  queixa_professor?: string;
  /** Hipótese do RE sobre o espectro (dimensão), escrita pelo profissional. Não é diagnóstico do sistema. */
  hipotese_espectro?: string;
  encaminhado?: FogapEncaminhados;
}

export const SUMARIO_TEXTO_MAX = 800;

export function encaminhadosVazio(): FogapEncaminhados {
  return { nucleo: null, cras: null, conselho_tutelar: null, ubs: null, outro_nome: "", outro: null };
}

/** Completa registros antigos com os campos novos do Formulário I. */
export function sumarioComPadroes(raw: Partial<FogapSecaoSumario> | null | undefined): FogapSecaoSumario {
  const r = raw ?? {};
  return {
    dificuldades_persistentes: Array.isArray(r.dificuldades_persistentes) ? r.dificuldades_persistentes : [],
    conduta: r.conduta === "sim" || r.conduta === "nao" ? r.conduta : null,
    qual: r.qual ?? "",
    tempo: r.tempo ?? "",
    resultado: r.resultado ?? "",
    serie: r.serie ?? "",
    queixa_professor: r.queixa_professor ?? "",
    hipotese_espectro: r.hipotese_espectro ?? "",
    encaminhado: { ...encaminhadosVazio(), ...(r.encaminhado ?? {}) },
  };
}

export interface FogapSecaoEncaminhamento {
  observacoes: string;
  data: string | null;
}

export interface FogapPayload {
  fogap_version: string;
  fogap_state: EstadoFogap;
  grupo: GrupoId | null;
  idade_anos: number | null;
  idade_meses: number | null;
  total_meses: number | null;
  respostas_desenvolvimento: Record<string, OpcaoDesenvolvimento | null>;
  respostas_comportamentos: Record<string, OpcaoComportamento | null>;
  historico_insuficiente: FogapHistoricoInsuficiente;
  secao_sumario: FogapSecaoSumario;
  secao_encaminhamento: FogapSecaoEncaminhamento;
}

// ── Roteamento por idade ───────────────────────────────────────────────────

const FAIXAS: { id: GrupoId; min: number; max: number }[] = [
  { id: "G1", min: 3, max: 35 },
  { id: "G2", min: 36, max: 71 },
  { id: "G3", min: 72, max: 119 },
];

export const GRUPOS_ATIVOS_NO_PILOTO: GrupoId[] = ["G3"];

export type ResultadoRoteamento =
  | { estado: "aguardando_idade"; erro: "idade_invalida" }
  | { estado: "fora_da_faixa"; total_meses: number }
  | { estado: "faixa_fora_do_piloto"; grupo: GrupoId; total_meses: number }
  | { estado: "rascunho"; grupo: GrupoId; total_meses: number };

export function rotearPorIdade(
  anos: number,
  meses: number,
  gruposAtivos: GrupoId[] = GRUPOS_ATIVOS_NO_PILOTO
): ResultadoRoteamento {
  if (
    !Number.isInteger(anos) ||
    !Number.isInteger(meses) ||
    anos < 0 ||
    meses < 0 ||
    meses > 11
  ) {
    return { estado: "aguardando_idade", erro: "idade_invalida" };
  }
  const total_meses = anos * 12 + meses;
  const faixa = FAIXAS.find((f) => total_meses >= f.min && total_meses <= f.max);
  if (!faixa) return { estado: "fora_da_faixa", total_meses };
  if (!gruposAtivos.includes(faixa.id)) {
    return { estado: "faixa_fora_do_piloto", grupo: faixa.id, total_meses };
  }
  return { estado: "rascunho", grupo: faixa.id, total_meses };
}

// Clicar na opção já marcada desmarca (null). Nunca converte null em inadequada/não.
export function alternarResposta<T extends string>(atual: T | null, clicada: T): T | null {
  return atual === clicada ? null : clicada;
}

// ── Grupos metadados ──────────────────────────────────────────────────────

export const GRUPOS_META: Record<GrupoId, FogapGrupoMeta> = {
  G1: {
    id: "G1",
    titulo: "Desenvolvimento (3 meses a 2 anos e 11 meses)",
    secao_fonte: "1",
    idade_min_meses: 3,
    idade_max_meses: 35,
    infancia_fonte: "1ª Infância",
    ativo_no_piloto: false,
  },
  G2: {
    id: "G2",
    titulo: "Desenvolvimento (3 a 5 anos e 11 meses)",
    secao_fonte: "2",
    idade_min_meses: 36,
    idade_max_meses: 71,
    infancia_fonte: "1ª Infância",
    ativo_no_piloto: false,
  },
  G3: {
    id: "G3",
    titulo: "Desenvolvimento (6 a 9 anos e 11 meses)",
    secao_fonte: "3",
    idade_min_meses: 72,
    idade_max_meses: 119,
    infancia_fonte: "2ª Infância",
    ativo_no_piloto: true,
  },
};

// ── G3 — itens de desenvolvimento (piloto ativo) ──────────────────────────

export const G3_ITENS: FogapItem[] = [
  { id: "FOGAP-D-095", n: 95, bloco_idade: "6 a 9 anos", fase_fonte: "Operacional-concreto Corpo representado", texto: "Conta e reconta histórias que fazem sentido" },
  { id: "FOGAP-D-096", n: 96, bloco_idade: "6 a 9 anos", fase_fonte: "Operacional-concreto Corpo representado", texto: "Pode falar sobre seus sentimentos e necessidades" },
  { id: "FOGAP-D-097", n: 97, bloco_idade: "6 a 9 anos", fase_fonte: "Operacional-concreto Corpo representado", texto: "Fala para esclarecer ideias" },
  { id: "FOGAP-D-098", n: 98, bloco_idade: "6 a 9 anos", fase_fonte: "Operacional-concreto Corpo representado", texto: "Pergunta para entender causa e efeito" },
  { id: "FOGAP-D-099", n: 99, bloco_idade: "6 a 9 anos", fase_fonte: "Operacional-concreto Corpo representado", texto: "Gosta de humor na fala e brinca com palavras" },
  { id: "FOGAP-D-100", n: 100, bloco_idade: "6 a 9 anos", fase_fonte: "Operacional-concreto Corpo representado", texto: "Faz perguntas apropriadas" },
  { id: "FOGAP-D-101", n: 101, bloco_idade: "6 a 9 anos", fase_fonte: "Operacional-concreto Corpo representado", texto: "Pode seguir histórias mais longas" },
  { id: "FOGAP-D-102", n: 102, bloco_idade: "6 a 9 anos", fase_fonte: "Operacional-concreto Corpo representado", texto: "Adapta-se a situações e a funções adversas" },
  { id: "FOGAP-D-103", n: 103, bloco_idade: "6 a 9 anos", fase_fonte: "Operacional-concreto Corpo representado", texto: "Entende regras" },
  { id: "FOGAP-D-104", n: 104, bloco_idade: "6 a 9 anos", fase_fonte: "Operacional-concreto Corpo representado", texto: "Tem autocuidado" },
  { id: "FOGAP-D-105", n: 105, bloco_idade: "6 a 9 anos", fase_fonte: "Operacional-concreto Corpo representado", texto: "O afeto é congruente com a realidade" },
  { id: "FOGAP-D-106", n: 106, bloco_idade: "6 a 9 anos", fase_fonte: "Operacional-concreto Corpo representado", texto: "Controla os impulsos" },
  { id: "FOGAP-D-107", n: 107, bloco_idade: "6 a 9 anos", fase_fonte: "Operacional-concreto Corpo representado", texto: "Faz a imagem completa do ser humano" },
  { id: "FOGAP-D-108", n: 108, bloco_idade: "6 a 9 anos", fase_fonte: "Operacional-concreto Corpo representado", texto: "Lê e escreve" },
  { id: "FOGAP-D-109", n: 109, bloco_idade: "6 a 9 anos", fase_fonte: "Operacional-concreto Corpo representado", texto: "Fala sem omissões e trocas" },
];

// ── Seção 4 — Comportamentos disfuncionais por 6 meses ────────────────────

export const FOGAP_COMPORTAMENTOS: FogapComportamentoItem[] = [
  { id: "FOGAP-C-01", n: 1, texto: "Não inicia a comunicação" },
  { id: "FOGAP-C-02", n: 2, texto: "Hiperativo" },
  { id: "FOGAP-C-03", n: 3, texto: "Desatento" },
  { id: "FOGAP-C-04", n: 4, texto: "Gagueja" },
  { id: "FOGAP-C-05", n: 5, texto: "Fala muito" },
  { id: "FOGAP-C-06", n: 6, texto: "Fala muito alto" },
  { id: "FOGAP-C-07", n: 7, texto: "Rói unhas" },
  { id: "FOGAP-C-08", n: 8, texto: "Arranca o cabelo" },
  { id: "FOGAP-C-09", n: 9, texto: "Se morde" },
  { id: "FOGAP-C-10", n: 10, texto: "Se envolve em conflitos com frequência" },
  { id: "FOGAP-C-11", n: 11, texto: "Desafia" },
  { id: "FOGAP-C-12", n: 12, texto: "Opõe-se, ostensivamente, a seguir regras" },
  { id: "FOGAP-C-13", n: 13, texto: "Morde os amigos" },
  { id: "FOGAP-C-14", n: 14, texto: "Agride fisicamente pessoas do seu entorno" },
  { id: "FOGAP-C-15", n: 15, texto: "Ameaça fugir" },
];

// ── Seção 5 — Dificuldades persistentes (múltipla escolha) ───────────────

export const DIFICULDADES_PERSISTENTES_OPCOES: string[] = [
  "Motora",
  "Fala",
  "Compreensão",
  "Aprendizagem",
  "Linguagem",
  "Cognitiva",
  "Comunicação Social",
  "Genética",
  "Familiar",
  "Outra",
];

// ── Helpers ───────────────────────────────────────────────────────────────

export function getItensGrupo(grupo: GrupoId): FogapItem[] {
  if (grupo === "G3") return G3_ITENS;
  return [];
}

export function makeFogapPayloadVazio(): FogapPayload {
  return {
    fogap_version: FOGAP_VERSION,
    fogap_state: "aguardando_idade",
    grupo: null,
    idade_anos: null,
    idade_meses: null,
    total_meses: null,
    respostas_desenvolvimento: {},
    respostas_comportamentos: {},
    historico_insuficiente: { marcado: false, fonte: null, periodo_observado: null },
    secao_sumario: sumarioComPadroes(null),
    secao_encaminhamento: { observacoes: "", data: null },
  };
}

/**
 * Regra confirmada pela Dra. (07/out/2026): o FOGAP pode ser enviado ao médico com itens em branco.
 * Só bloqueia o envio quando não há idade/grupo ou a criança está fora do piloto.
 * Itens em branco viram `avisos` (informativos), nunca `pendencias` (bloqueantes).
 */
export function prontoParaRevisao(payload: FogapPayload): { pronto: boolean; pendencias: string[]; avisos: string[] } {
  const pendencias: string[] = [];
  const avisos: string[] = [];

  if (!payload.grupo || payload.fogap_state === "aguardando_idade") {
    pendencias.push("Idade não informada");
    return { pronto: false, pendencias, avisos };
  }
  if (payload.fogap_state === "fora_da_faixa" || payload.fogap_state === "faixa_fora_do_piloto") {
    pendencias.push("Faixa etária não atendida pelo piloto");
    return { pronto: false, pendencias, avisos };
  }

  const itens = getItensGrupo(payload.grupo);
  const respostasDev = payload.respostas_desenvolvimento ?? {};
  const respostasComp = payload.respostas_comportamentos ?? {};
  const devPendentes = itens.filter((item) => !respostasDev[item.id]);
  if (devPendentes.length > 0) {
    avisos.push(`${devPendentes.length} item(s) de desenvolvimento em branco`);
  }

  const hiInsuf = payload.historico_insuficiente ?? { marcado: false, fonte: null, periodo_observado: null };
  const compPendentes = FOGAP_COMPORTAMENTOS.filter((c) => !respostasComp[c.id]);
  if (compPendentes.length > 0 && !hiInsuf.marcado) {
    avisos.push(`${compPendentes.length} comportamento(s) em branco`);
  }
  if (hiInsuf.marcado && (!hiInsuf.fonte?.trim() || !hiInsuf.periodo_observado?.trim())) {
    avisos.push("Histórico insuficiente: fonte ou período observado em branco");
  }

  return { pronto: true, pendencias, avisos };
}

/** Data de hoje no fuso de Brasília (AAAA-MM-DD), para travar datas futuras. */
export function hojeBrasilia(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function validarPayloadFogap(payload: unknown, now = new Date()): string | null {
  if (!payload || typeof payload !== "object") return "Payload inválido";
  const p = payload as Record<string, unknown>;

  const enc = p["secao_encaminhamento"];
  if (enc && typeof enc === "object") {
    const data = (enc as Record<string, unknown>)["data"];
    if (data !== null && data !== undefined && data !== "") {
      if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(data))) {
        return "Data do encaminhamento inválida.";
      }
      if (data > hojeBrasilia(now)) return "A data do encaminhamento não pode ser futura.";
    }
  }

  const sum = p["secao_sumario"];
  if (sum && typeof sum === "object") {
    const q = sum as Record<string, unknown>;
    for (const campo of ["serie", "queixa_professor", "hipotese_espectro", "qual", "tempo", "resultado"]) {
      const v = q[campo];
      if (v !== undefined && v !== null && (typeof v !== "string" || v.length > SUMARIO_TEXTO_MAX)) {
        return `Campo "${campo}" inválido ou longo demais (máximo ${SUMARIO_TEXTO_MAX} caracteres).`;
      }
    }
    const enc2 = q["encaminhado"];
    if (enc2 && typeof enc2 === "object") {
      const hoje = hojeBrasilia(now);
      for (const [k, v] of Object.entries(enc2 as Record<string, unknown>)) {
        if (k === "outro_nome") {
          if (v !== undefined && v !== null && (typeof v !== "string" || v.length > 120)) return "Nome do outro encaminhamento inválido.";
          continue;
        }
        if (v === null || v === undefined || v === "") continue;
        if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) return `Data de encaminhamento (${k}) inválida.`;
        if (v > hoje) return "A data do encaminhamento não pode ser futura.";
      }
    }
  }

  const dev = p["respostas_desenvolvimento"];
  if (dev && typeof dev === "object") {
    for (const [key, val] of Object.entries(dev as Record<string, unknown>)) {
      if (val !== null && val !== "adequada" && val !== "inadequada") {
        return `Item ${key}: valor inválido — use adequada, inadequada ou null`;
      }
    }
  }

  const comp = p["respostas_comportamentos"];
  if (comp && typeof comp === "object") {
    for (const [key, val] of Object.entries(comp as Record<string, unknown>)) {
      if (val !== null && val !== "sim" && val !== "nao") {
        return `Comportamento ${key}: valor inválido — use sim, nao ou null`;
      }
    }
  }

  return null;
}
