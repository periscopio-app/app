/**
 * Resumo visual de um formulário preenchido (RE, médico e especialistas).
 *
 * A Dra. informou que os formulários NÃO têm peso determinado. Por isso este resumo só ORGANIZA o que o
 * profissional marcou, para leitura rápida:
 *  - agrupa as linhas de cada tabela pela resposta escolhida ("Sim: a, b, c" / "Não: d, e");
 *  - mostra quantos campos de cada seção foram respondidos (andamento, não pontuação);
 *  - deixa em branco o que está em branco (nunca vira "não").
 *
 * O que NÃO faz, de propósito: somar, ponderar, converter em classe/percentil, ordenar por gravidade, dar cor
 * por resposta ou apontar "alto/baixo". A interface usa a mesma cor neutra para qualquer resposta.
 */
import { progressoDef, type FormDef, type ReCampo, type ReOpcao } from "./re-journey-catalog";

export interface ResumoLinha {
  rotulo: string;
  /** Número digitado pelo profissional (ex.: pontos do protocolo), exatamente como veio. */
  numero?: string;
  obs?: string;
}

export interface ResumoGrupo {
  /** Texto da resposta escolhida (ex.: "Sim"). */
  resposta: string;
  linhas: ResumoLinha[];
}

export interface ResumoCampo {
  key: string;
  label: string;
  tipo: "texto" | "escolha" | "tabela" | "desenho";
  /** texto livre */
  texto?: string;
  /** escolha única ou múltipla */
  escolhas?: string[];
  /** tabela: linhas agrupadas pela resposta */
  grupos?: ResumoGrupo[];
  /** tabela: rótulos das linhas sem resposta (aparecem só como "em branco") */
  emBranco?: string[];
  obs?: string;
}

export interface ResumoSecao {
  id: string;
  titulo: string;
  respondidos: number;
  total: number;
  campos: ResumoCampo[];
}

export interface ResumoVisual {
  respondidos: number;
  total: number;
  secoes: ResumoSecao[];
}

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function rotulos(opcoes: ReOpcao[], valores: unknown): string[] {
  const lista = Array.isArray(valores) ? valores : valores === undefined || valores === null || valores === "" ? [] : [valores];
  return lista
    .map((v) => opcoes.find((o) => o.value === v)?.label)
    .filter((x): x is string => typeof x === "string" && x.length > 0);
}

function campoResumo(c: ReCampo, p: Record<string, any>): ResumoCampo | null {
  const obs = texto(p[`${c.key}__obs`]);
  switch (c.tipo) {
    case "texto":
    case "texto_longo": {
      const t = texto(p[c.key]);
      return t ? { key: c.key, label: c.label, tipo: "texto", texto: t } : null;
    }
    case "unica":
    case "multipla": {
      const escolhas = rotulos(c.opcoes, p[c.key]);
      const complemento = [texto(p[`${c.key}__texto`]), texto(p[`${c.key}__outros`])].filter(Boolean);
      const todas = [...escolhas, ...complemento.map((x) => `Outro: ${x}`)];
      if (todas.length === 0 && !obs) return null;
      return { key: c.key, label: c.label, tipo: "escolha", escolhas: todas, obs: obs || undefined };
    }
    case "matriz": {
      const dados = (p[c.key] && typeof p[c.key] === "object" ? p[c.key] : {}) as Record<string, any>;
      const grupos = new Map<string, ResumoLinha[]>();
      const emBranco: string[] = [];
      for (const l of c.linhas) {
        const cel = (dados[l.key] && typeof dados[l.key] === "object" ? dados[l.key] : {}) as Record<string, any>;
        const resp = rotulos(c.opcoes, cel.r);
        const numero = typeof cel.n === "number" && Number.isFinite(cel.n) ? String(cel.n) : undefined;
        const linha: ResumoLinha = { rotulo: l.label, numero, obs: texto(cel.obs) || undefined };
        if (resp.length === 0) {
          if (numero !== undefined || linha.obs) {
            const g = grupos.get("Valor informado") ?? [];
            g.push(linha);
            grupos.set("Valor informado", g);
          } else emBranco.push(l.label);
          continue;
        }
        for (const r of resp) {
          const g = grupos.get(r) ?? [];
          g.push(linha);
          grupos.set(r, g);
        }
      }
      // Ordem das opções no formulário (nunca por gravidade); "Valor informado" por último.
      const ordem = c.opcoes.map((o) => o.label);
      const lista = [...grupos.entries()]
        .sort((a, b) => {
          const ia = ordem.indexOf(a[0]);
          const ib = ordem.indexOf(b[0]);
          return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
        })
        .map(([resposta, linhas]) => ({ resposta, linhas }));
      if (lista.length === 0) return null;
      return { key: c.key, label: c.label, tipo: "tabela", grupos: lista, emBranco: emBranco.length ? emBranco : undefined };
    }
    case "genograma":
      return texto(p[c.key]) ? { key: c.key, label: c.label, tipo: "desenho" } : null;
    default:
      return null;
  }
}

/** Resumo neutro do que foi marcado. Campos em branco não aparecem; o andamento vem de `progressoDef`. */
export function resumoVisualDef(form: FormDef, payload: unknown): ResumoVisual {
  const p = (payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {}) as Record<string, any>;
  const geral = progressoDef(form, p);
  const secoes: ResumoSecao[] = form.secoes.map((s) => {
    const parcial: FormDef = { ...form, secoes: [s] };
    const prog = progressoDef(parcial, p);
    const campos = s.campos.map((c) => campoResumo(c, p)).filter((x): x is ResumoCampo => x !== null);
    return { id: s.id, titulo: s.titulo, respondidos: prog.respondidos, total: prog.total, campos };
  });
  return { respondidos: geral.respondidos, total: geral.total, secoes };
}
