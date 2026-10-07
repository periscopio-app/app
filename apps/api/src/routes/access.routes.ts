import type { FastifyInstance } from "fastify";
import { sql, eq } from "drizzle-orm";
import { db } from "../db/client";
import { users } from "@periscopio/shared";
import { sendEmail } from "../email";
import { accessLinkEmail } from "../email/templates";
import { upsertCredential, credentialFingerprint } from "../auth/credentials";
import { createAccessToken, verifyAccessToken } from "../auth/access-link";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_INTERVAL_MS = 60_000;
const lastRequest = new Map<string, number>();

async function findUser(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  return user;
}

/**
 * Primeiro acesso / esqueci a senha. O cadastro público está fechado: só quem já foi
 * cadastrado (admin ou escola) recebe o link, e ele vai apenas para o e-mail cadastrado.
 * A resposta é sempre a mesma, exista o e-mail ou não, para não revelar quem tem conta.
 */
export async function accessRoutes(app: FastifyInstance) {
  app.post("/api/access/request", async (request, reply) => {
    const raw = (request.body as { email?: string } | undefined)?.email;
    const email = typeof raw === "string" ? raw.toLowerCase().trim() : "";

    if (!EMAIL_RE.test(email) || email.length > 255) {
      reply.status(400);
      return { error: "Informe um e-mail válido." };
    }

    const generic = { success: true };

    const last = lastRequest.get(email) ?? 0;
    if (Date.now() - last < MIN_INTERVAL_MS) return generic;
    lastRequest.set(email, Date.now());
    if (lastRequest.size > 5000) lastRequest.clear();

    try {
      const user = await findUser(email);
      if (!user) return generic;

      const fingerprint = await credentialFingerprint(email);
      const token = createAccessToken(email, fingerprint);
      const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
      const mail = accessLinkEmail(user.name, `${appUrl}/redefinir?token=${encodeURIComponent(token)}`);
      await sendEmail(email, mail.subject, mail.html);
    } catch (err: any) {
      request.log.error({ err: err?.message ?? String(err) }, "falha ao enviar link de acesso");
    }
    return generic;
  });

  app.get("/api/access/validate", async (request, reply) => {
    const { token } = request.query as { token?: string };
    const parsed = token ? verifyAccessToken(token) : null;
    if (!parsed) {
      reply.status(400);
      return { valid: false, error: "Link inválido ou expirado. Peça um novo na tela de entrada." };
    }
    const user = await findUser(parsed.email);
    const fingerprint = user ? await credentialFingerprint(parsed.email) : null;
    if (!user || fingerprint !== parsed.fingerprint) {
      reply.status(400);
      return { valid: false, error: "Este link já foi utilizado ou não vale mais. Peça um novo." };
    }
    return { valid: true, email: parsed.email, name: user.name };
  });

  app.post("/api/access/set-password", async (request, reply) => {
    const { token, password } = (request.body ?? {}) as { token?: string; password?: string };

    if (!token || !password) {
      reply.status(400);
      return { error: "Informe o link e a nova senha." };
    }
    if (password.length < 8 || password.length > 128) {
      reply.status(400);
      return { error: "A senha deve ter entre 8 e 128 caracteres." };
    }

    const parsed = verifyAccessToken(token);
    if (!parsed) {
      reply.status(400);
      return { error: "Link inválido ou expirado. Peça um novo na tela de entrada." };
    }
    const user = await findUser(parsed.email);
    if (!user || (await credentialFingerprint(parsed.email)) !== parsed.fingerprint) {
      reply.status(400);
      return { error: "Este link já foi utilizado ou não vale mais. Peça um novo." };
    }

    await upsertCredential({
      email: parsed.email,
      name: user.name,
      password,
      isAdmin: user.role === "admin_platform",
    });
    // Provar a posse do e-mail equivale a confirmar o convite.
    await db.update(users).set({ accessEnabled: true }).where(eq(users.id, user.id));

    return { success: true };
  });
}
