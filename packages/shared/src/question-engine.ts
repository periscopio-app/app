/**
 * Motor de visibilidade de perguntas.
 * Só avalia condições declaradas na definição do formulário.
 * Não contém regra clínica: cada regra vem da definição e deve citar a fonte.
 * Fonte: Protocolos do contrato — motor de perguntas e notificações v0.2.0-rascunho
 */

export type Valor = string | number | boolean | null;
export type Respostas = Record<string, Valor>;

export type Cond =
  | { campo: string; op: "eq" | "neq" | "gte" | "lt"; valor: Valor }
  | { campo: string; op: "in"; valor: Valor[] }
  | { campo: string; op: "respondido" }
  | { contar: string[]; em: Valor[]; op: "gte" | "lt"; valor: number }
  | { todas: Cond[] }
  | { alguma: Cond[] };

export interface PerguntaBase {
  id: string;
  visivel_se?: Cond;
}

export function avaliar(c: Cond, r: Respostas): boolean {
  if ("todas" in c) return c.todas.every((x) => avaliar(x, r));
  if ("alguma" in c) return c.alguma.some((x) => avaliar(x, r));
  if ("contar" in c) {
    const n = c.contar.filter((id) => c.em.includes(r[id] ?? null)).length;
    return c.op === "gte" ? n >= c.valor : n < c.valor;
  }
  const v = r[c.campo] ?? null;
  switch (c.op) {
    case "respondido":
      return v !== null;
    case "eq":
      return v === c.valor;
    case "neq":
      return v !== null && v !== c.valor; // sem resposta nunca satisfaz "diferente de"
    case "in":
      return v !== null && c.valor.includes(v);
    case "gte":
      return typeof v === "number" && typeof c.valor === "number" && v >= c.valor;
    case "lt":
      return typeof v === "number" && typeof c.valor === "number" && v < c.valor;
  }
}

export function visiveis<P extends PerguntaBase>(ps: P[], r: Respostas): P[] {
  return ps.filter((p) => !p.visivel_se || avaliar(p.visivel_se, r));
}

/** Primeira pergunta visível ainda sem resposta (null/ausente). Nunca assume valor. */
export function proximaPendente<P extends PerguntaBase>(ps: P[], r: Respostas): P | null {
  return visiveis(ps, r).find((p) => (r[p.id] ?? null) === null) ?? null;
}

export function progresso<P extends PerguntaBase>(ps: P[], r: Respostas) {
  const v = visiveis(ps, r);
  return { respondidas: v.filter((p) => (r[p.id] ?? null) !== null).length, total: v.length };
}

/** IDs de perguntas que ficaram ocultas mas têm resposta: mantidas no rascunho, fora da contagem e do envio. */
export function ocultasComResposta<P extends PerguntaBase>(ps: P[], r: Respostas): string[] {
  const vis = new Set(visiveis(ps, r).map((p) => p.id));
  return ps.filter((p) => !vis.has(p.id) && (r[p.id] ?? null) !== null).map((p) => p.id);
}
