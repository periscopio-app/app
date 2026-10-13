import type { FastifyReply, FastifyRequest } from "fastify";
import { incr } from "../observability/metrics";

/** Limite por chave em janela deslizante, em memória (por instância). Protege rotas públicas de abuso simples. */
const hits = new Map<string, number[]>();
const MAX_KEYS = 10_000;

export function resetRateLimits(): void {
  hits.clear();
}

export function isLimited(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > MAX_KEYS) hits.clear();
  return false;
}

/** Responde 429 e devolve true quando o IP passou do limite desta rota. */
export function rejectIfLimited(
  request: FastifyRequest,
  reply: FastifyReply,
  name: string,
  limit: number,
  windowMs: number,
): boolean {
  if (!isLimited(`${name}|${request.ip}`, limit, windowMs)) return false;
  incr(`rate_limited_${name}`);
  reply.header("retry-after", String(Math.ceil(windowMs / 1000)));
  reply.status(429).send({ error: "Muitas tentativas. Aguarde um pouco e tente de novo." });
  return true;
}
