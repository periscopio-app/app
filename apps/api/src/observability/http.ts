import { randomUUID } from "node:crypto";
import { STATUS_CODES } from "node:http";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { incr, observeRequest, recordError } from "./metrics";

const SLOW_MS = 2000;
const REQ_ID_RE = /^[A-Za-z0-9._-]{8,64}$/;

/** Remove a query string: ela pode carregar token de acesso e outros segredos. */
export function stripQuery(url: string | undefined): string {
  return (url ?? "").split("?")[0];
}

export function genRequestId(req: { headers: Record<string, string | string[] | undefined> }): string {
  const given = req.headers["x-request-id"];
  const v = Array.isArray(given) ? given[0] : given;
  return v && REQ_ID_RE.test(v) ? v : randomUUID();
}

/** Opções do logger do Fastify: sem query string, sem cabeçalhos sensíveis. */
export function loggerOptions() {
  return {
    level: process.env.LOG_LEVEL ?? "info",
    redact: {
      paths: ["req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]'],
      censor: "[redigido]",
    },
    serializers: {
      req(req: FastifyRequest) {
        return {
          method: req.method,
          url: stripQuery(req.url),
          host: req.host,
          remoteAddress: req.ip,
        };
      },
    },
  };
}

interface ObsError { cls: string; msg: string }

/** Liga request id, métricas, registro de erros 5xx e tratador de erros central. */
export function registerObservability(app: FastifyInstance): void {
  const isProd = process.env.NODE_ENV === "production";

  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("x-request-id", request.id);
    return payload;
  });

  app.addHook("onResponse", async (request, reply) => {
    const route = request.routeOptions?.url ?? "(sem rota)";
    const ms = reply.elapsedTime;
    observeRequest(request.method, route, reply.statusCode, ms);
    if (reply.statusCode === 429) incr("http_429_total");
    if (reply.statusCode >= 500) {
      const e = (request as unknown as { obsErr?: ObsError }).obsErr;
      recordError({
        at: new Date().toISOString(),
        requestId: String(request.id),
        method: request.method,
        route,
        status: reply.statusCode,
        errorClass: e?.cls ?? null,
        message: e?.msg ?? null,
      });
    } else if (ms > SLOW_MS) {
      incr("http_slow_total");
      request.log.warn({ route, ms: Math.round(ms) }, "requisição lenta");
    }
  });

  app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, request, reply) => {
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
    if (status >= 500) {
      (request as unknown as { obsErr?: ObsError }).obsErr = { cls: err.name || "Error", msg: String(err.message) };
      request.log.error({ err: { name: err.name, message: err.message, stack: err.stack } }, "erro não tratado");
      return reply.status(status).send({
        statusCode: status,
        error: STATUS_CODES[status] ?? "Internal Server Error",
        message: isProd ? "Erro interno do servidor." : err.message,
        requestId: request.id,
      });
    }
    request.log.warn({ status, code: err.code }, err.message);
    return reply.status(status).send({
      statusCode: status,
      ...(err.code ? { code: err.code } : {}),
      error: STATUS_CODES[status] ?? "Error",
      message: err.message,
    });
  });
}
