import { networkErrorCode } from "../storage/config";

/**
 * Painel de dados (Databricks), só para o Administrador Master.
 *
 * Camada analítica com dados AGREGADOS e SINTÉTICOS: a API consulta o SQL Warehouse do Databricks e o navegador
 * nunca vê endereço, token nem SQL. As consultas são uma LISTA FECHADA sobre views `gold` (nada de SQL livre),
 * sem aluno, sem nome e sem dado clínico por pessoa. Desligado por padrão: sem as variáveis, responde "não configurado".
 * Plano: ver a página "Plano de Dados Periscópio" e infra/databricks/README.md.
 */

export const DATABRICKS_PAINEIS = {
  casos_por_estado: {
    titulo: "Casos por estado da jornada",
    view: "casos_por_estado",
    colunas: ["estado", "total"],
    ordem: "total DESC",
  },
  casos_por_mes: {
    titulo: "Casos abertos por mês",
    view: "casos_por_mes",
    colunas: ["mes", "total"],
    ordem: "mes",
  },
  casos_por_escola: {
    titulo: "Casos por escola (código da escola)",
    view: "casos_por_escola",
    colunas: ["escola", "total"],
    ordem: "total DESC",
  },
  delegacoes_por_especialidade: {
    titulo: "Delegações por especialidade",
    view: "delegacoes_por_especialidade",
    colunas: ["especialidade", "total"],
    ordem: "total DESC",
  },
} as const;

export type PainelId = keyof typeof DATABRICKS_PAINEIS;
export const PAINEL_IDS = Object.keys(DATABRICKS_PAINEIS) as [PainelId, ...PainelId[]];

export type Celula = string | number | null;

export type DatabricksResultado =
  | { configured: false; reason: string }
  | { configured: true; ok: true; id: PainelId; titulo: string; colunas: string[]; linhas: Celula[][]; suprimidas: number; minimoPorCelula: number; atualizadoEm: number }
  | { configured: true; ok: false; id: PainelId; error: string };

type FetchLike = (
  url: string,
  init: { method: "POST"; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<{ status: number; json(): Promise<unknown> }>;

export interface DatabricksDeps {
  env: Record<string, string | undefined>;
  fetch: FetchLike;
  now: () => number;
}

const defaults: DatabricksDeps = {
  env: process.env,
  fetch: (url, init) => fetch(url, init) as never,
  now: () => Date.now(),
};

const CACHE_TTL_MS = 5 * 60_000;
const TIMEOUT_MS = 30_000;
const cache = new Map<string, { at: number; value: DatabricksResultado }>();
export function clearDatabricksCache() {
  cache.clear();
}

/** Valor mínimo por célula. Células menores viram "suprimidas". Proposta de privacidade: validar com o encarregado (DPO). */
export function minimoPorCelula(env: DatabricksDeps["env"]): number {
  const n = Number(env.DATABRICKS_MIN_CELL);
  return Number.isInteger(n) && n >= 1 ? n : 5;
}

/** Só o NOME das variáveis que faltam ou estão inválidas; nunca o valor. */
export function motivoNaoConfigurado(env: DatabricksDeps["env"]): string {
  const faltam = (["DATABRICKS_HOST", "DATABRICKS_WAREHOUSE_ID", "DATABRICKS_TOKEN"] as const).filter((k) => !env[k]?.trim());
  if (faltam.length) return `O painel de dados está desligado. No servidor (Render, serviço periscopio-api) falta: ${faltam.join(", ")}.`;
  try {
    if (new URL(env.DATABRICKS_HOST!.trim()).protocol !== "https:") return "DATABRICKS_HOST precisa começar com https://.";
  } catch {
    return "DATABRICKS_HOST não é um endereço válido (use o endereço completo do workspace, começando com https://).";
  }
  if (!/^[A-Za-z0-9_]+$/.test(env.DATABRICKS_CATALOG?.trim() || "periscopio")) return "DATABRICKS_CATALOG tem caracteres inválidos.";
  return "A configuração do Databricks está incompleta.";
}

function resolveConfig(env: DatabricksDeps["env"]): { base: string; auth: string; warehouse: string; catalog: string } | null {
  const host = env.DATABRICKS_HOST?.trim();
  const warehouse = env.DATABRICKS_WAREHOUSE_ID?.trim();
  const token = env.DATABRICKS_TOKEN?.trim();
  const catalog = env.DATABRICKS_CATALOG?.trim() || "periscopio";
  if (!host || !warehouse || !token) return null;
  if (!/^[A-Za-z0-9_]+$/.test(catalog) || !/^[A-Za-z0-9]+$/.test(warehouse)) return null;
  let u: URL;
  try {
    u = new URL(host);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  return { base: u.origin, auth: `Bearer ${token}`, warehouse, catalog };
}

/** Mensagem curta, sem token, SQL nem corpo da resposta. */
export function describeDatabricksError(err: unknown): string {
  const code = networkErrorCode(err);
  if (code === "ABORT_ERR") return "O Databricks não respondeu a tempo. O warehouse pode estar iniciando; tente de novo em um minuto.";
  if (err instanceof SyntaxError) return "O endereço configurado não devolveu uma resposta do Databricks. Confira DATABRICKS_HOST.";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "O endereço de DATABRICKS_HOST não existe (DNS).";
  if (code) return `Não foi possível falar com o Databricks (${code}).`;
  return "Não foi possível falar com o Databricks (rede).";
}

type Statement = {
  status?: { state?: string };
  manifest?: { schema?: { columns?: { name?: string }[] } };
  result?: { data_array?: unknown[][] };
};

function paraCelula(v: unknown): Celula {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return v.trim() !== "" && Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(v.trim()) ? n : v;
  }
  return String(v);
}

export async function consultarPainel(id: PainelId, overrides: Partial<DatabricksDeps> = {}): Promise<DatabricksResultado> {
  const d = { ...defaults, ...overrides };
  const cfg = resolveConfig(d.env);
  if (!cfg) return { configured: false, reason: motivoNaoConfigurado(d.env) };

  const hit = cache.get(id);
  if (hit && d.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const def = DATABRICKS_PAINEIS[id];
  // Nomes vêm da lista fechada acima e do catálogo validado; nada do cliente entra no SQL.
  const statement = `SELECT ${def.colunas.join(", ")} FROM ${cfg.catalog}.gold.${def.view} ORDER BY ${def.ordem} LIMIT 500`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  let value: DatabricksResultado;
  try {
    const res = await d.fetch(`${cfg.base}/api/2.0/sql/statements`, {
      method: "POST",
      headers: { Authorization: cfg.auth, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ warehouse_id: cfg.warehouse, statement, wait_timeout: "30s", on_wait_timeout: "CANCEL", format: "JSON_ARRAY", disposition: "INLINE", row_limit: 500 }),
      signal: ctl.signal,
    });
    if (res.status === 401 || res.status === 403) {
      value = { configured: true, ok: false, id, error: "O Databricks recusou a credencial (confira DATABRICKS_TOKEN e as permissões da conta de serviço)." };
    } else if (res.status !== 200) {
      value = { configured: true, ok: false, id, error: `O Databricks respondeu HTTP ${res.status}.` };
    } else {
      const body = (await res.json()) as Statement;
      if (body.status?.state !== "SUCCEEDED") {
        value = { configured: true, ok: false, id, error: "A consulta não terminou no Databricks (warehouse parado ou view ainda não criada)." };
      } else {
        const colunas = (body.manifest?.schema?.columns ?? []).map((c) => String(c.name ?? ""));
        const minimo = minimoPorCelula(d.env);
        let suprimidas = 0;
        const linhas = (body.result?.data_array ?? []).map((l) => {
          const cel = l.map(paraCelula);
          const iTotal = colunas.indexOf("total");
          if (iTotal >= 0 && typeof cel[iTotal] === "number" && (cel[iTotal] as number) < minimo) {
            suprimidas++;
            return cel.map((c, i) => (i === iTotal ? null : c));
          }
          return cel;
        });
        value = { configured: true, ok: true, id, titulo: def.titulo, colunas, linhas, suprimidas, minimoPorCelula: minimo, atualizadoEm: d.now() };
      }
    }
  } catch (err) {
    value = { configured: true, ok: false, id, error: describeDatabricksError(err) };
  } finally {
    clearTimeout(timer);
  }
  if (value.configured && value.ok) cache.set(id, { at: d.now(), value });
  return value;
}

export function statusDoPainel(env: DatabricksDeps["env"] = process.env): { configured: boolean; reason?: string; paineis: { id: PainelId; titulo: string }[] } {
  const paineis = PAINEL_IDS.map((id) => ({ id, titulo: DATABRICKS_PAINEIS[id].titulo }));
  if (!resolveConfig(env)) return { configured: false, reason: motivoNaoConfigurado(env), paineis };
  return { configured: true, paineis };
}
