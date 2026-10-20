import { RE_FORMS, RE_TEXTO_MAX, camposDoForm, type ReCampo, type ReFormId, type ReOpcao } from "@periscopio/shared";
import { BANNED } from "./tea-summary.service";

/**
 * Rascunho do campo "Observações" do RE a partir do que já foi preenchido no formulário.
 * Ordem: (1) monta um resumo SEM identificador (só pergunta e resposta); (2) tenta o assistente (BI_RAG_URL);
 * (3) se ele estiver desligado ou a saída não passar na trava, devolve um texto determinístico montado pelas regras.
 * O texto é só uma sugestão: a profissional revisa e decide se usa. Nada é salvo aqui.
 */

export const OBSERVACOES_AVISO =
  "Sugestão de redação feita a partir do que você já preencheu. Revise antes de usar: ela não é avaliação, não classifica e não indica conduta.";

export interface ItemContexto {
  pergunta: string;
  resposta: string;
}

export interface ContextoObservacoes {
  formulario: string;
  respondidas: number;
  total: number;
  itens: ItemContexto[];
  semResposta: string[];
  textoAtual: string;
}

function celulaComoLista(r: unknown): string[] {
  if (Array.isArray(r)) return r.filter((x): x is string => typeof x === "string" && x !== "");
  return typeof r === "string" && r ? [r] : [];
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function rotulos(opcoes: ReOpcao[], v: unknown): string[] {
  return celulaComoLista(v).map((x) => opcoes.find((o) => o.value === x)?.label ?? "").filter(Boolean);
}

function txt(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Resposta legível de um campo, ou null se está em branco. Nunca inclui professor, data ou identificação. */
function respostaDe(campo: ReCampo, p: Record<string, any>): ItemContexto[] | null {
  switch (campo.tipo) {
    case "professor":
    case "texto":
      return null;
    case "texto_longo": {
      if (campo.key === "observacoes") return null;
      const t = txt(p[campo.key]);
      return t ? [{ pergunta: campo.label, resposta: clip(t, 300) }] : null;
    }
    case "unica": {
      const r = rotulos(campo.opcoes, p[campo.key])[0];
      if (!r) return null;
      const extra = txt(p[`${campo.key}__texto`]);
      const obs = txt(p[`${campo.key}__obs`]);
      return [{ pergunta: campo.label, resposta: [r, extra && `(${clip(extra, 200)})`, obs && `Obs.: ${clip(obs, 200)}`].filter(Boolean).join(" ") }];
    }
    case "multipla": {
      const r = rotulos(campo.opcoes, p[campo.key]);
      const outros = txt(p[`${campo.key}__outros`]);
      if (outros) r.push(`Outros: ${clip(outros, 150)}`);
      if (!r.length) return null;
      const obs = txt(p[`${campo.key}__obs`]);
      return [{ pergunta: campo.label, resposta: [r.join("; "), obs && `Obs.: ${clip(obs, 200)}`].filter(Boolean).join(" ") }];
    }
    case "matriz": {
      const dados = (p[campo.key] ?? {}) as Record<string, any>;
      const out: ItemContexto[] = [];
      for (const l of campo.linhas) {
        const d = dados[l.key];
        if (!d) continue;
        const r = rotulos(campo.opcoes, d.r);
        const n = d.n != null && d.n !== "" ? `${campo.comNumero ?? "Número"}: ${d.n}` : "";
        const obs = txt(d.obs);
        const partes = [r.join("; "), n, obs && `Obs.: ${clip(obs, 150)}`].filter(Boolean);
        if (partes.length) out.push({ pergunta: `${campo.label} — ${l.label}`, resposta: partes.join(" ") });
      }
      return out.length ? out : null;
    }
  }
}

export function montarContexto(formId: ReFormId, payload: Record<string, unknown>): ContextoObservacoes {
  const form = RE_FORMS[formId];
  const itens: ItemContexto[] = [];
  const semResposta: string[] = [];
  let total = 0;
  for (const campo of camposDoForm(form)) {
    if (campo.tipo === "professor" || campo.tipo === "texto" || campo.key === "observacoes") continue;
    total += 1;
    const r = respostaDe(campo, payload);
    if (r) itens.push(...r);
    else semResposta.push(clip(campo.label, 120));
  }
  return {
    formulario: form.titulo,
    respondidas: total - semResposta.length,
    total,
    itens: itens.slice(0, 60),
    semResposta: semResposta.slice(0, 20),
    textoAtual: clip(txt(payload["observacoes"]), 1200),
  };
}

/** Texto montado só pelas regras: descreve o que foi marcado, sem interpretar. */
export function rascunhoPorRegras(ctx: ContextoObservacoes): string {
  const partes: string[] = [];
  if (ctx.textoAtual) partes.push(ctx.textoAtual.replace(/\s+$/, ""));
  if (ctx.itens.length) {
    const lista = ctx.itens.slice(0, 6).map((i) => `${i.pergunta.replace(/[?:.]+$/, "")}: ${i.resposta}`);
    const resto = ctx.itens.length - lista.length;
    partes.push(`Foi registrado neste formulário: ${lista.join("; ")}${resto > 0 ? `; e mais ${resto} resposta(s) registrada(s)` : ""}.`);
  } else if (!ctx.textoAtual) {
    partes.push("Ainda não há respostas registradas neste formulário para resumir.");
  }
  if (ctx.semResposta.length && ctx.itens.length) {
    partes.push(`Ficaram sem registro ${ctx.semResposta.length} pergunta(s).`);
  }
  return clip(partes.join("\n\n"), RE_TEXTO_MAX);
}

const PADRAO_IDENTIFICADOR = /(\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|[\w.+-]+@[\w-]+\.[\w.]+|\(?\d{2}\)?\s?9?\d{4}-?\d{4})/;

/** Trava da saída do modelo: formato, tamanho, termos proibidos, números que não existem no contexto e identificadores. */
export function validarTextoModelo(raw: unknown, ctx: ContextoObservacoes): string | null {
  if (!raw || typeof raw !== "object") return null;
  const t = (raw as Record<string, unknown>).texto;
  if (typeof t !== "string") return null;
  const texto = t.trim();
  if (texto.length < 10 || texto.length > 1500) return null;
  if (BANNED.some((re) => re.test(texto))) return null;
  if (PADRAO_IDENTIFICADOR.test(texto)) return null;
  const fonte = JSON.stringify(ctx);
  for (const m of texto.match(/\d+/g) ?? []) {
    if (!new RegExp(`(^|\\D)${m}(\\D|$)`).test(fonte)) return null;
  }
  return texto;
}

async function chamarAssistente(ctx: ContextoObservacoes): Promise<unknown | null> {
  const base = process.env.BI_RAG_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/draft-observations`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-service-token": process.env.BI_RAG_TOKEN ?? "" },
      body: JSON.stringify({
        payload: {
          formulario: ctx.formulario,
          texto_atual: ctx.textoAtual,
          respostas: ctx.itens,
          sem_resposta: ctx.semResposta,
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { draft?: unknown };
    return data.draft ?? null;
  } catch {
    return null;
  }
}

export async function sugerirObservacoes(
  formId: ReFormId,
  payload: Record<string, unknown>,
): Promise<{ texto: string; source: "ia" | "regras"; aviso: string }> {
  const ctx = montarContexto(formId, payload);
  const regras = rascunhoPorRegras(ctx);
  if (ctx.itens.length === 0 && !ctx.textoAtual) return { texto: regras, source: "regras", aviso: OBSERVACOES_AVISO };
  const raw = await chamarAssistente(ctx);
  const ok = raw ? validarTextoModelo(raw, ctx) : null;
  return ok ? { texto: ok, source: "ia", aviso: OBSERVACOES_AVISO } : { texto: regras, source: "regras", aviso: OBSERVACOES_AVISO };
}
