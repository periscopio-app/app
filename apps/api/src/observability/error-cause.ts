export interface ErrorCause {
  name?: string;
  message: string;
  code?: string;
  detail?: string;
  constraint?: string;
  table?: string;
  routine?: string;
}

const MAX_DEPTH = 3;

/**
 * Erros do Drizzle chegam como "Failed query: <sql>" e escondem o erro real do Postgres em `cause`.
 * Devolve a cadeia de causas só com campos de diagnóstico do Postgres (código, detalhe, restrição,
 * tabela). Nunca inclui parâmetros da consulta nem a stack.
 */
export function errorCauseChain(err: unknown): ErrorCause[] {
  const chain: ErrorCause[] = [];
  let cur = err && typeof err === "object" ? (err as { cause?: unknown }).cause : undefined;
  for (let depth = 0; depth < MAX_DEPTH && cur && typeof cur === "object"; depth++) {
    const e = cur as Record<string, unknown>;
    const str = (k: string) => (typeof e[k] === "string" ? (e[k] as string).slice(0, 300) : undefined);
    chain.push({
      name: str("name"),
      message: str("message") ?? "",
      code: str("code"),
      detail: str("detail"),
      constraint: str("constraint"),
      table: str("table"),
      routine: str("routine"),
    });
    cur = e.cause;
  }
  return chain;
}
