import type { FastifyInstance, FastifyReply } from "fastify";
import { requireCapability } from "../security/actor";
import { VIRTUAL_ADMIN_ID } from "../security/roles";
import {
  GoogleApiError,
  buildAuthUrl,
  deleteConnection,
  exchangeCode,
  getConnection,
  googleConfig,
  revokeToken,
  safeReturnTo,
  saveConnection,
  signState,
  verifyState,
} from "../services/google-calendar.service";

type GoogleResult = "connected" | "denied" | "error" | "invalid";

/** Volta para a tela (caminho relativo do próprio site) com o resultado em `?google=`. */
function backToApp(reply: FastifyReply, path: string, result: GoogleResult) {
  const target = safeReturnTo(path);
  return reply.redirect(`${target}${target.includes("?") ? "&" : "?"}google=${result}`);
}

/**
 * Conexão do Google Agenda/Meet da coordenação do Board.
 * A API devolve a URL do Google em JSON (a tela navega até ela) e recebe o retorno em /callback pelo MESMO site
 * da tela (Vercel repassa /api/*), então o cookie de sessão continua first-party.
 */
export async function googleIntegrationRoutes(app: FastifyInstance) {
  app.get("/api/integrations/google/status", async (request, reply) => {
    const actor = await requireCapability(request, reply, "board.manage");
    if (!actor) return;
    const cfg = googleConfig();
    const connection = cfg ? await getConnection(actor.tenantId) : null;
    return {
      configured: !!cfg,
      connected: !!connection,
      connectedAt: connection?.updatedAt ?? null,
      redirectUri: cfg?.redirectUri ?? null,
    };
  });

  app.get("/api/integrations/google/connect", async (request, reply) => {
    const actor = await requireCapability(request, reply, "board.manage");
    if (!actor) return;
    const cfg = googleConfig();
    if (!cfg) return reply.status(409).send({ error: "A integração com o Google não está configurada neste ambiente." });
    const { returnTo } = request.query as { returnTo?: string };
    const state = signState({ tenantId: actor.tenantId, userId: actor.id, returnTo: safeReturnTo(returnTo) });
    return { url: buildAuthUrl(cfg, state) };
  });

  app.get("/api/integrations/google/callback", async (request, reply) => {
    const actor = await requireCapability(request, reply, "board.manage");
    if (!actor) return;
    const query = request.query as { code?: string; state?: string; error?: string };

    // O state foi assinado por nós para ESTE usuário e ESTE tenant; qualquer outra combinação é tratada como inválida.
    const state = verifyState(query.state);
    if (!state || state.userId !== actor.id || state.tenantId !== actor.tenantId) return backToApp(reply, "/", "invalid");
    if (query.error || !query.code) return backToApp(reply, state.returnTo, query.error === "access_denied" ? "denied" : "error");

    const cfg = googleConfig();
    if (!cfg) return backToApp(reply, state.returnTo, "error");
    try {
      const tokens = await exchangeCode(cfg, query.code);
      await saveConnection(actor.tenantId, actor.id === VIRTUAL_ADMIN_ID ? null : actor.id, tokens.refreshToken, tokens.scope);
      return backToApp(reply, state.returnTo, "connected");
    } catch (err) {
      // Só o código: a mensagem do Google pode carregar detalhes que não devem ir para o log.
      request.log.warn({ code: err instanceof GoogleApiError ? err.code : "unknown" }, "conexão com o Google não concluída");
      return backToApp(reply, state.returnTo, "error");
    }
  });

  app.delete("/api/integrations/google", async (request, reply) => {
    const actor = await requireCapability(request, reply, "board.manage");
    if (!actor) return;
    const refreshToken = await deleteConnection(actor.tenantId);
    if (refreshToken) await revokeToken(refreshToken);
    return { connected: false };
  });
}
