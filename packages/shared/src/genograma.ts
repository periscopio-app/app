/**
 * Genograma por parentesco (editor guiado).
 *
 * O profissional não digita nomes: escolhe o parentesco (mãe, pai, avó materna, irmão…) e o desenho é montado
 * pela biblioteca pública @famtree (licença MIT) a partir deste modelo. Este arquivo NÃO importa a biblioteca:
 * guarda o dado do Periscópio (pequeno, validável no servidor) e converte para o documento que ela desenha.
 *
 * Regras de produto (não mudar sem validação clínica):
 *  - só parentesco, sem nome, telefone ou endereço; o aluno aparece como "Aluno(a)" (o código fica no cabeçalho do caso);
 *  - o sistema não interpreta o desenho: não classifica, não sugere padrão familiar e não calcula risco;
 *  - "anotação" é texto curto digitado pelo profissional (ex.: "informado pelo responsável"); o sistema não cria rótulos clínicos;
 *  - a validação clínica do modelo de genograma (quem preenche, que símbolos usar) continua pendente: ver `GENOGRAMA_PENDENCIAS`.
 */

export const GENOGRAMA_VERSAO = 1 as const;
export const GENOGRAMA_MAX_MEMBROS = 24;
export const GENOGRAMA_ANOTACAO_MAX = 120;
/** Limite do JSON guardado no payload do formulário. */
export const GENOGRAMA_JSON_MAX = 8000;

export type Forma = "male" | "female" | "unknown";

export const PARENTESCO_IDS = [
  "mae",
  "pai",
  "irmao",
  "irma",
  "avo_materna",
  "avo_materno",
  "avo_paterna",
  "avo_paterno",
  "tio_materno",
  "tia_materna",
  "tio_paterno",
  "tia_paterna",
] as const;
export type ParentescoId = (typeof PARENTESCO_IDS)[number];

export type GrupoParentesco = "pais" | "irmaos" | "avos" | "tios";

export interface ParentescoDef {
  id: ParentescoId;
  /** Texto completo, para o botão e a lista. */
  rotulo: string;
  /** Texto curto, escrito embaixo da figura. */
  curto: string;
  forma: "male" | "female";
  grupo: GrupoParentesco;
  /** Só pode existir um. */
  unico: boolean;
  /** Pelo menos um destes precisa estar no desenho (o desenho precisa de onde ligar). Vazio = sem exigência. */
  precisaDeUmDe: ParentescoId[];
  /** Explicação curta quando falta quem ligar. */
  precisaTexto?: string;
}

const P = (d: ParentescoDef): ParentescoDef => d;

export const PARENTESCOS: ParentescoDef[] = [
  P({ id: "mae", rotulo: "Mãe", curto: "Mãe", forma: "female", grupo: "pais", unico: true, precisaDeUmDe: [] }),
  P({ id: "pai", rotulo: "Pai", curto: "Pai", forma: "male", grupo: "pais", unico: true, precisaDeUmDe: [] }),
  P({ id: "irmao", rotulo: "Irmão (mesma mãe e mesmo pai)", curto: "Irmão", forma: "male", grupo: "irmaos", unico: false, precisaDeUmDe: ["mae", "pai"], precisaTexto: "Adicione a mãe ou o pai primeiro." }),
  P({ id: "irma", rotulo: "Irmã (mesma mãe e mesmo pai)", curto: "Irmã", forma: "female", grupo: "irmaos", unico: false, precisaDeUmDe: ["mae", "pai"], precisaTexto: "Adicione a mãe ou o pai primeiro." }),
  P({ id: "avo_materna", rotulo: "Avó materna (mãe da mãe)", curto: "Avó materna", forma: "female", grupo: "avos", unico: true, precisaDeUmDe: ["mae"], precisaTexto: "Adicione a mãe primeiro." }),
  P({ id: "avo_materno", rotulo: "Avô materno (pai da mãe)", curto: "Avô materno", forma: "male", grupo: "avos", unico: true, precisaDeUmDe: ["mae"], precisaTexto: "Adicione a mãe primeiro." }),
  P({ id: "avo_paterna", rotulo: "Avó paterna (mãe do pai)", curto: "Avó paterna", forma: "female", grupo: "avos", unico: true, precisaDeUmDe: ["pai"], precisaTexto: "Adicione o pai primeiro." }),
  P({ id: "avo_paterno", rotulo: "Avô paterno (pai do pai)", curto: "Avô paterno", forma: "male", grupo: "avos", unico: true, precisaDeUmDe: ["pai"], precisaTexto: "Adicione o pai primeiro." }),
  P({ id: "tio_materno", rotulo: "Tio materno (irmão da mãe)", curto: "Tio materno", forma: "male", grupo: "tios", unico: false, precisaDeUmDe: ["avo_materna", "avo_materno"], precisaTexto: "Adicione um avô ou avó materno(a) primeiro." }),
  P({ id: "tia_materna", rotulo: "Tia materna (irmã da mãe)", curto: "Tia materna", forma: "female", grupo: "tios", unico: false, precisaDeUmDe: ["avo_materna", "avo_materno"], precisaTexto: "Adicione um avô ou avó materno(a) primeiro." }),
  P({ id: "tio_paterno", rotulo: "Tio paterno (irmão do pai)", curto: "Tio paterno", forma: "male", grupo: "tios", unico: false, precisaDeUmDe: ["avo_paterna", "avo_paterno"], precisaTexto: "Adicione um avô ou avó paterno(a) primeiro." }),
  P({ id: "tia_paterna", rotulo: "Tia paterna (irmã do pai)", curto: "Tia paterna", forma: "female", grupo: "tios", unico: false, precisaDeUmDe: ["avo_paterna", "avo_paterno"], precisaTexto: "Adicione um avô ou avó paterno(a) primeiro." }),
];

export const GRUPOS_PARENTESCO: { id: GrupoParentesco; titulo: string }[] = [
  { id: "pais", titulo: "Pais" },
  { id: "irmaos", titulo: "Irmãos" },
  { id: "avos", titulo: "Avós" },
  { id: "tios", titulo: "Tios" },
];

const DEF = new Map(PARENTESCOS.map((d) => [d.id, d] as const));
export function parentescoDef(id: ParentescoId): ParentescoDef {
  return DEF.get(id)!;
}
export function isParentescoId(v: unknown): v is ParentescoId {
  return typeof v === "string" && DEF.has(v as ParentescoId);
}

export interface GenogramaMembro {
  /** Identificador interno estável (não aparece na tela). */
  id: string;
  parentesco: ParentescoId;
  /** Marcado pelo profissional, conforme informado. */
  falecido?: boolean;
  /** Texto curto digitado pelo profissional. Sem nomes. Quando existe, a figura é sombreada. */
  anotacao?: string;
}

export interface Genograma {
  v: typeof GENOGRAMA_VERSAO;
  /** Forma da figura do aluno: "unknown" desenha um símbolo neutro. */
  aluno: Forma;
  /** O profissional informou que mãe e pai não vivem juntos (linha de união marcada como separada). */
  paisSeparados?: boolean;
  membros: GenogramaMembro[];
}

export const GENOGRAMA_VAZIO: Genograma = { v: GENOGRAMA_VERSAO, aluno: "unknown", membros: [] };

export const GENOGRAMA_PENDENCIAS = [
  "Meio-irmãos e padrasto/madrasta ficam de fora do desenho: a biblioteca (@famtree 0.1.5) ainda não desenha uma pessoa em duas uniões nem filho de um só dos pais quando os dois estão no desenho (aparece como filho dos dois, o que seria enganoso). Registrar no campo de descrição em texto até haver solução validada.",
  "Modelo do genograma: confirmar com a equipe clínica quais parentescos entram, quem preenche (RE ou médico) e quais símbolos adicionais são necessários (adoção, gêmeos, união encerrada etc.). NAO IMPLEMENTAR ATE VALIDACAO.",
  "O sistema só desenha o que foi informado. Não existe interpretação automática do desenho.",
] as const;

// ── Normalização ────────────────────────────────────────────────────────────────

function anotacaoLimpa(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.replace(/\s+/g, " ").trim().slice(0, GENOGRAMA_ANOTACAO_MAX);
  return t || undefined;
}

/**
 * Aceita qualquer entrada e devolve um genograma válido: só parentescos conhecidos, um por vez onde é único,
 * dentro do limite e sem membros "soltos" (quem depende de outro só fica se o outro estiver no desenho).
 */
export function normalizarGenograma(bruto: unknown): Genograma {
  const o = bruto && typeof bruto === "object" && !Array.isArray(bruto) ? (bruto as Record<string, unknown>) : {};
  const aluno: Forma = o.aluno === "male" || o.aluno === "female" ? o.aluno : "unknown";
  const lista = Array.isArray(o.membros) ? o.membros : [];

  const vistos = new Set<string>();
  const ids = new Set<string>();
  let membros: GenogramaMembro[] = [];
  for (const m of lista) {
    if (membros.length >= GENOGRAMA_MAX_MEMBROS) break;
    if (!m || typeof m !== "object") continue;
    const r = m as Record<string, unknown>;
    if (!isParentescoId(r.parentesco)) continue;
    const def = parentescoDef(r.parentesco);
    if (def.unico && vistos.has(def.id)) continue;
    vistos.add(def.id);
    let id = typeof r.id === "string" && /^[a-z0-9_]{1,24}$/.test(r.id) && r.id !== "aluno" ? r.id : "";
    if (!id || ids.has(id)) {
      let n = membros.length + 1;
      while (ids.has(`m${n}`) || n === 0) n += 1;
      id = `m${n}`;
    }
    ids.add(id);
    const membro: GenogramaMembro = { id, parentesco: def.id };
    if (r.falecido === true) membro.falecido = true;
    const a = anotacaoLimpa(r.anotacao);
    if (a) membro.anotacao = a;
    membros.push(membro);
  }

  // Remove quem ficou sem a pessoa a quem se liga (repete até estabilizar: tio depende de avô, que depende de mãe).
  for (;;) {
    const presentes = new Set(membros.map((m) => m.parentesco));
    const filtrado = membros.filter((m) => {
      const need = parentescoDef(m.parentesco).precisaDeUmDe;
      return need.length === 0 || need.some((n) => presentes.has(n));
    });
    if (filtrado.length === membros.length) break;
    membros = filtrado;
  }

  const g: Genograma = { v: GENOGRAMA_VERSAO, aluno, membros };
  if (o.paisSeparados === true && membros.some((m) => m.parentesco === "mae") && membros.some((m) => m.parentesco === "pai")) {
    g.paisSeparados = true;
  }
  return g;
}

/** Lê o texto guardado no payload. Vazio, inválido ou sem membros → null. */
export function lerGenograma(texto: unknown): Genograma | null {
  if (typeof texto !== "string" || !texto.trim()) return null;
  try {
    const g = normalizarGenograma(JSON.parse(texto));
    return g.membros.length > 0 ? g : null;
  } catch {
    return null;
  }
}

/** Texto para guardar no payload. Genograma sem membros = campo em branco (em branco continua em branco). */
export function serializarGenograma(g: Genograma): string {
  const n = normalizarGenograma(g);
  if (n.membros.length === 0) return "";
  return JSON.stringify(n).slice(0, GENOGRAMA_JSON_MAX);
}

/** Texto do payload → texto limpo (ou ""), para a normalização no servidor. */
export function normalizarGenogramaTexto(bruto: unknown): string {
  const g = lerGenograma(bruto);
  return g ? serializarGenograma(g) : "";
}

/** Como o profissional vê cada figura: "Irmão", "Irmão 2"… quando há repetição. */
export function rotulosNoDesenho(membros: GenogramaMembro[]): Map<string, string> {
  const total = new Map<ParentescoId, number>();
  for (const m of membros) total.set(m.parentesco, (total.get(m.parentesco) ?? 0) + 1);
  const atual = new Map<ParentescoId, number>();
  const out = new Map<string, string>();
  for (const m of membros) {
    const def = parentescoDef(m.parentesco);
    const n = (atual.get(m.parentesco) ?? 0) + 1;
    atual.set(m.parentesco, n);
    out.set(m.id, (total.get(m.parentesco) ?? 0) > 1 ? `${def.curto} ${n}` : def.curto);
  }
  return out;
}

/** Quais parentescos ainda podem ser adicionados e, quando não podem, por quê. */
export function disponibilidade(g: Genograma, id: ParentescoId): { ok: true } | { ok: false; motivo: string } {
  const def = parentescoDef(id);
  if (g.membros.length >= GENOGRAMA_MAX_MEMBROS) return { ok: false, motivo: `Limite de ${GENOGRAMA_MAX_MEMBROS} figuras.` };
  if (def.unico && g.membros.some((m) => m.parentesco === id)) return { ok: false, motivo: "Já está no desenho." };
  if (def.precisaDeUmDe.length > 0 && !def.precisaDeUmDe.some((n) => g.membros.some((m) => m.parentesco === n))) {
    return { ok: false, motivo: def.precisaTexto ?? "Falta adicionar quem liga esta figura." };
  }
  return { ok: true };
}

/** Adiciona um parentesco se for possível. Devolve o genograma novo (o mesmo, se não deu). */
export function adicionarMembro(g: Genograma, id: ParentescoId): Genograma {
  if (!disponibilidade(g, id).ok) return g;
  let n = g.membros.length + 1;
  const usados = new Set(g.membros.map((m) => m.id));
  while (usados.has(`m${n}`)) n += 1;
  return normalizarGenograma({ ...g, membros: [...g.membros, { id: `m${n}`, parentesco: id }] });
}

/** Remove uma figura e, junto, quem dependia só dela (avó → tios, mãe → avós maternos…). */
export function removerMembro(g: Genograma, membroId: string): Genograma {
  return normalizarGenograma({ ...g, membros: g.membros.filter((m) => m.id !== membroId) });
}

export function atualizarMembro(g: Genograma, membroId: string, mudanca: Partial<Pick<GenogramaMembro, "falecido" | "anotacao">>): Genograma {
  return normalizarGenograma({
    ...g,
    membros: g.membros.map((m) => (m.id === membroId ? { ...m, ...mudanca } : m)),
  });
}

// ── Conversão para o documento da biblioteca @famtree ─────────────────────────────

/** Mesma forma do `Genogram` de @famtree/schema (versão 0.1.x), sem depender do pacote. */
export interface DocumentoGenograma {
  version: "1.0.0";
  metadata: { title: string; focusPersonId: string };
  people: {
    id: string;
    name: string;
    sex: Forma;
    deceased?: boolean;
    isProband?: boolean;
    style?: { fillColor: string };
  }[];
  relationships: (
    | { id: string; type: "union"; partnerIds: [string, string]; unionType: "unknown"; status: "current" | "separated" }
    | { id: string; type: "parent-child"; childId: string; parentIds?: string[]; unionId?: string }
  )[];
}

/** Cor de sombreado para figuras com anotação. Contraste: o texto fica fora da figura, em preto. */
export const COR_ANOTACAO = "#FDE68A";

export function genogramaParaDocumento(entrada: Genograma): DocumentoGenograma {
  const g = normalizarGenograma(entrada);
  const rot = rotulosNoDesenho(g.membros);
  const por = new Map<ParentescoId, GenogramaMembro[]>();
  for (const m of g.membros) por.set(m.parentesco, [...(por.get(m.parentesco) ?? []), m]);
  const um = (p: ParentescoId) => por.get(p)?.[0];

  const people: DocumentoGenograma["people"] = [{ id: "aluno", name: "Aluno(a)", sex: g.aluno, isProband: true }];
  for (const m of g.membros) {
    const def = parentescoDef(m.parentesco);
    const pessoa: DocumentoGenograma["people"][number] = { id: m.id, name: rot.get(m.id) ?? def.curto, sex: def.forma };
    if (m.falecido) pessoa.deceased = true;
    if (m.anotacao) pessoa.style = { fillColor: COR_ANOTACAO };
    people.push(pessoa);
  }

  const rels: DocumentoGenograma["relationships"] = [];
  const filhoDe = (childId: string, pais: (GenogramaMembro | undefined)[], uniao?: string) => {
    const ids = pais.filter((p): p is GenogramaMembro => Boolean(p)).map((p) => p.id);
    if (uniao) rels.push({ id: `pc_${childId}`, type: "parent-child", childId, unionId: uniao });
    else if (ids.length > 0) rels.push({ id: `pc_${childId}`, type: "parent-child", childId, parentIds: ids });
  };

  const mae = um("mae");
  const pai = um("pai");
  let uniaoPais: string | undefined;
  if (mae && pai) {
    uniaoPais = "u_pais";
    rels.push({ id: uniaoPais, type: "union", partnerIds: [pai.id, mae.id], unionType: "unknown", status: g.paisSeparados ? "separated" : "current" });
  }
  filhoDe("aluno", [mae, pai], uniaoPais);
  for (const m of g.membros) {
    if (m.parentesco === "irmao" || m.parentesco === "irma") filhoDe(m.id, [mae, pai], uniaoPais);
  }

  const lado = (adulto: GenogramaMembro | undefined, avoF: ParentescoId, avoM: ParentescoId, tios: ParentescoId[], chave: string) => {
    const f = um(avoF);
    const mm = um(avoM);
    let uniao: string | undefined;
    if (f && mm) {
      uniao = `u_avos_${chave}`;
      rels.push({ id: uniao, type: "union", partnerIds: [mm.id, f.id], unionType: "unknown", status: "current" });
    }
    if (adulto) filhoDe(adulto.id, [mm, f], uniao);
    for (const m of g.membros) if (tios.includes(m.parentesco)) filhoDe(m.id, [mm, f], uniao);
  };
  lado(mae, "avo_materna", "avo_materno", ["tio_materno", "tia_materna"], "m");
  lado(pai, "avo_paterna", "avo_paterno", ["tio_paterno", "tia_paterna"], "p");

  return { version: "1.0.0", metadata: { title: "Genograma", focusPersonId: "aluno" }, people, relationships: rels };
}

/** Resumo em texto, para leitura por quem não abre o desenho (ex.: "Mãe, Pai, 2 irmãos, avó materna"). */
export function resumoDoGenograma(g: Genograma): string {
  const rot = rotulosNoDesenho(g.membros);
  const partes = g.membros.map((m) => {
    const base = rot.get(m.id) ?? parentescoDef(m.parentesco).curto;
    const extra = [m.falecido ? "falecido(a)" : "", m.anotacao ?? ""].filter(Boolean).join("; ");
    return extra ? `${base} (${extra})` : base;
  });
  return partes.join(", ");
}
