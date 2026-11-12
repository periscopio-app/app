/**
 * Cadastro por link unitário + envio de acesso pelo administrador — [REG-029] e [REG-030].
 *
 * Bug de 12/nov/2026: especialistas do piloto cadastrados pelo administrador nunca recebiam e-mail (a criação não
 * enviava nada, o convite exigia escola, e o remetente padrão era de um domínio não verificado no Resend), e a tela
 * não dizia se o e-mail tinha saído. Agora: link de cadastro que o administrador envia e a pessoa usa para se cadastrar;
 * criação sem senha dispara o acesso e devolve o resultado; botão "Enviar acesso" reenvia; tenant é obrigatório.
 * Roda só com TEST_DATABASE_URL (banco local de teste). Dados sintéticos; o Resend é simulado (nenhuma rede).
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente (E2E precisa de Postgres local de teste)" : false;

describe("[REG-029/030] cadastro por link e envio de acesso (E2E)", { skip }, () => {
  let app: FastifyInstance;
  let H: any;
  let eq: any;
  let tA: any;
  let tB: any;
  let sB: any;
  const MASTER = "master@teste.local";
  const enviados: { from: string; to: string; subject: string; html: string }[] = [];
  const fetchOriginal = globalThis.fetch;
  let resendResponde: { status: number; body: unknown } = { status: 200, body: { id: "email-teste" } };

  async function call(method: string, path: string, email?: string, body?: unknown) {
    const headers: Record<string, string> = { origin: "http://localhost:3000", "user-agent": "teste-e2e/1.0" };
    if (email) headers["x-test-email"] = email;
    if (body !== undefined) headers["content-type"] = "application/json";
    const r = await app.inject({ method: method as any, url: path, headers, payload: body === undefined ? undefined : JSON.stringify(body) });
    let parsed: any = null;
    try { parsed = r.json(); } catch { parsed = r.body; }
    return { status: r.statusCode, body: parsed };
  }

  const tokenDoLink = (link: string) => new URL(link).searchParams.get("token")!;
  const novoLink = async (extra: Record<string, unknown> = {}) => {
    const r = await call("POST", "/api/admin/registration-links", MASTER, { tenantId: tA.id, role: "specialist", specialty: "fonoaudiologia", ...extra });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return { ...r.body, token: tokenDoLink(r.body.url) };
  };
  const cadastro = (token: string, extra: Record<string, unknown> = {}) =>
    call("POST", "/api/onboarding/register", undefined, {
      token, name: "Fono Teste", email: "fono@gmail.test", password: "senha-segura-1", classCode: "CRFa 1234", acceptedTerms: true, ...extra,
    });

  before(async () => {
    const { assertSafeTestDatabase, resetTestDatabase } = await import("../testing/test-db");
    assertSafeTestDatabase(url);
    await resetTestDatabase(url!);

    process.env.DATABASE_URL = url!;
    process.env.NODE_ENV = "test";
    process.env.SUPERADMIN_EMAILS = MASTER;
    process.env.BETTER_AUTH_SECRET = "segredo-de-teste-com-mais-de-32-caracteres!!";
    process.env.BETTER_AUTH_URL = "http://localhost:3001";
    process.env.CORS_ORIGINS = "http://localhost:3000";
    process.env.APP_URL = "https://app.teste.local";
    process.env.RESEND_API_KEY = "re_chave_de_teste";
    delete process.env.RESEND_FROM_EMAIL;

    // Resend simulado: o SDK usa fetch; nada sai da máquina.
    globalThis.fetch = (async (input: any, init?: any) => {
      const alvo = String(typeof input === "string" ? input : input?.url ?? input);
      if (!alvo.includes("api.resend.com")) return fetchOriginal(input, init);
      const payload = JSON.parse(String(init?.body ?? "{}"));
      if (resendResponde.status === 200) enviados.push({ from: payload.from, to: [payload.to].flat()[0], subject: payload.subject, html: payload.html });
      return new Response(JSON.stringify(resendResponde.body), { status: resendResponde.status, headers: { "content-type": "application/json" } });
    }) as typeof fetch;

    const shared = await import("@periscopio/shared");
    ({ eq } = await import("drizzle-orm"));
    const { db } = await import("../db/client");
    const { buildApp } = await import("../app");
    H = { ...shared, db };

    [tA] = await db.insert(shared.tenants).values({ name: "Município A (teste)", municipalityCode: "A" }).returning();
    [tB] = await db.insert(shared.tenants).values({ name: "Município B (teste)", municipalityCode: "B" }).returning();
    [sB] = await db.insert(shared.schools).values({ tenantId: tB.id, name: "Escola B1", slug: "escola-b1", status: "active" }).returning();
    await db.insert(shared.users).values({ tenantId: tA.id, email: "medico@teste.local", name: "Médico Teste", role: "md1", accessEnabled: true });
    app = await buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    globalThis.fetch = fetchOriginal;
    await app?.close();
    const { db } = await import("../db/client");
    await (db as any).$client.end();
  });

  const usuario = async (email: string) => (await H.db.select().from(H.users).where(eq(H.users.email, email)))[0];
  const hashDaSenha = async (email: string) => {
    const client = await (H.db as any).$client;
    const r = await client.query(`SELECT a.password FROM neon_auth."user" u JOIN neon_auth.account a ON a."userId" = u.id WHERE lower(u.email) = $1`, [email]);
    return r.rows[0]?.password as string | undefined;
  };

  // ───────────── link de cadastro ─────────────

  test("[REG-029a] só quem gerencia usuários gera o link; perfil, instância e especialidade são validados", async () => {
    const semPermissao = await call("POST", "/api/admin/registration-links", "medico@teste.local", { tenantId: tA.id, role: "specialist", specialty: "fonoaudiologia" });
    assert.equal(semPermissao.status, 403);

    const ruins: Record<string, unknown>[] = [
      { tenantId: tA.id, role: "admin_platform" }, // perfil de plataforma nunca por link
      { tenantId: tA.id, role: "school_manager", specialty: "psicologia" },
      { tenantId: tA.id, role: "specialist" }, // sem especialidade
      { tenantId: tA.id, role: "specialist", specialty: "medicina" }, // médico tem perfil próprio
      { tenantId: tA.id, role: "specialist", specialty: "astrologia" },
      { role: "specialist", specialty: "psicologia" }, // sem instância
      { tenantId: "00000000-0000-0000-0000-0000000000aa", role: "specialist", specialty: "psicologia" },
      { tenantId: tA.id, role: "ppi" }, // RE precisa de escola
      { tenantId: tA.id, role: "specialist", specialty: "psicologia", schoolId: sB.id }, // escola de outra instância
      { tenantId: tA.id, role: "specialist", specialty: "psicologia", expiresInDays: 365 },
    ];
    for (const corpo of ruins) {
      const r = await call("POST", "/api/admin/registration-links", MASTER, corpo);
      assert.equal(r.status, 400, JSON.stringify(corpo));
    }
  });

  test("[REG-029b] o link leva ao /cadastro, aparece como pendente com o endereço e a tela pública mostra instância e especialidade", async () => {
    const link = await novoLink({ label: "Fono do piloto" });
    assert.match(link.url, /^https:\/\/app\.teste\.local\/cadastro\?token=[0-9a-f]{64}$/);

    const lista = await call("GET", "/api/admin/registration-links", MASTER);
    const item = lista.body.links.find((l: any) => l.id === link.id);
    assert.equal(item.status, "pending");
    assert.equal(item.url, link.url);
    assert.equal(item.label, "Fono do piloto");
    assert.equal((await call("GET", "/api/admin/registration-links", "medico@teste.local")).status, 403);

    const publico = await call("GET", `/api/onboarding/registration-link?token=${link.token}`);
    assert.equal(publico.status, 200);
    assert.deepEqual({ role: publico.body.role, specialty: publico.body.specialty, tenantName: publico.body.tenantName, schoolName: publico.body.schoolName }, { role: "specialist", specialty: "fonoaudiologia", tenantName: "Município A (teste)", schoolName: null });
    assert.equal(publico.body.label, undefined, "o rótulo é controle interno do administrador");

    assert.equal((await call("GET", "/api/onboarding/registration-link?token=nao-existe-nao-existe-nao")).status, 404);
  });

  test("[REG-029c] a pessoa se cadastra com e-mail de qualquer domínio, cai na instância do link e já entra; o link vale uma vez", async () => {
    const link = await novoLink();
    const r = await cadastro(link.token, { email: "Fono@Gmail.test" });
    assert.equal(r.status, 200, JSON.stringify(r.body));

    const u = await usuario("fono@gmail.test");
    assert.equal(u.tenantId, tA.id);
    assert.equal(u.role, "specialist");
    assert.equal(u.specialty, "fonoaudiologia");
    assert.equal(u.accessEnabled, true);
    assert.equal(u.schoolId, null, "especialista do núcleo não precisa de escola");
    assert.ok(await hashDaSenha("fono@gmail.test"), "senha criada no Better Auth");

    assert.equal((await call("GET", "/api/me/professional-consent", "fono@gmail.test")).status, 200, "a conta nova já passa pelo gate de acesso");

    const denovo = await cadastro(link.token, { email: "outra@gmail.test" });
    assert.equal(denovo.status, 400);
    assert.match(denovo.body.error, /já foi utilizado/);
    assert.equal(await usuario("outra@gmail.test"), undefined);
    assert.equal((await call("GET", "/api/admin/registration-links", MASTER)).body.links.find((l: any) => l.id === link.id).status, "used");

    const auditoria = await H.db.select().from(H.auditLogs).where(eq(H.auditLogs.userEmail, "fono@gmail.test"));
    assert.ok(auditoria.some((a: any) => a.action === "registration_link:used"));
  });

  test("[REG-029d] o link nunca redefine a senha de quem já tem conta", async () => {
    const link = await novoLink();
    const antes = await hashDaSenha("fono@gmail.test");
    const r = await cadastro(link.token, { password: "senha-do-invasor-9" });
    assert.equal(r.status, 409);
    assert.equal(await hashDaSenha("fono@gmail.test"), antes);

    // O mesmo vale para e-mails de usuários do banco que ainda não têm senha (médico semeado).
    assert.equal((await cadastro(link.token, { email: "medico@teste.local" })).status, 409);
    // E o link continua livre para a pessoa certa.
    assert.equal((await cadastro(link.token, { email: "outro.fono@gmail.test" })).status, 200);
  });

  test("[REG-029e] e-mail fixado no link, conselho de classe, senha curta e termos são exigidos; falha não queima o link", async () => {
    const fixo = await novoLink({ email: "indicada@gmail.test" });
    assert.equal((await call("GET", `/api/onboarding/registration-link?token=${fixo.token}`)).body.email, "indicada@gmail.test");
    assert.equal((await cadastro(fixo.token, { email: "outra@gmail.test" })).status, 400);

    const link = await novoLink();
    for (const [extra, motivo] of [
      [{ classCode: "" }, "sem conselho de classe"],
      [{ password: "curta" }, "senha curta"],
      [{ acceptedTerms: false }, "sem aceitar os termos"],
      [{ email: "isso-nao-e-email" }, "e-mail inválido"],
      [{ name: "A" }, "nome curto"],
    ] as const) {
      assert.equal((await cadastro(link.token, { ...extra })).status, 400, motivo);
    }
    assert.equal((await cadastro(link.token, { email: "valida@gmail.test" })).status, 200, "depois dos erros o link ainda serve");
    assert.equal((await cadastro(fixo.token, { email: "indicada@gmail.test" })).status, 200);
  });

  test("[REG-029f] link revogado ou vencido não cadastra; duas pessoas no mesmo link, só uma passa", async () => {
    const revogado = await novoLink();
    assert.equal((await call("POST", `/api/admin/registration-links/${revogado.id}/revoke`, MASTER)).status, 200);
    const r = await cadastro(revogado.token, { email: "revogado@gmail.test" });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /expirou/);
    assert.equal((await call("POST", `/api/admin/registration-links/${revogado.id}/revoke`, MASTER)).status, 404, "revogar duas vezes");

    const vencido = await novoLink();
    await H.db.update(H.onboardingInvites).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(H.onboardingInvites.id, vencido.id));
    assert.equal((await cadastro(vencido.token, { email: "vencido@gmail.test" })).status, 400);

    const corrida = await novoLink();
    const [a, b] = await Promise.all([cadastro(corrida.token, { email: "corrida1@gmail.test" }), cadastro(corrida.token, { email: "corrida2@gmail.test" })]);
    assert.deepEqual([a.status, b.status].sort(), [200, 400]);
  });

  test("[REG-029g] o link do cadastro unitário não serve nas rotas de convite de escola nem de profissional por e-mail", async () => {
    const link = await novoLink();
    const escola = await call("POST", "/api/onboarding/complete-school", undefined, { token: link.token, professionals: [{ name: "Fulano de Tal", email: "x@gmail.test", phone: "11999999999", cpf: "52998224725", classCode: "CRP 1", specialty: "psicologia" }] });
    assert.equal(escola.status, 400);
    assert.equal(await usuario("x@gmail.test"), undefined);
    const aceite = await call("POST", "/api/onboarding/accept-invite", undefined, { token: link.token, password: "senha-segura-1" });
    assert.equal(aceite.status, 404);
  });

  test("[REG-029h] médico e RE ganham perfil e especialidade certos; RE exige escola da instância", async () => {
    const medico = await novoLink({ role: "md1", specialty: undefined });
    assert.equal((await cadastro(medico.token, { email: "dr@gmail.test", classCode: "CRM-SP 1" })).status, 200);
    const dr = await usuario("dr@gmail.test");
    assert.deepEqual([dr.role, dr.specialty], ["md1", "medicina"]);

    const re = await call("POST", "/api/admin/registration-links", MASTER, { tenantId: tB.id, role: "ppi", schoolId: sB.id });
    assert.equal(re.status, 200, JSON.stringify(re.body));
    assert.equal((await cadastro(tokenDoLink(re.body.url), { email: "re@gmail.test", classCode: "" })).status, 200, "RE não precisa de conselho de classe");
    const reUser = await usuario("re@gmail.test");
    assert.deepEqual([reUser.role, reUser.tenantId, reUser.schoolId], ["ppi", tB.id, sB.id]);
  });

  // ───────────── acesso por e-mail ─────────────

  test("[REG-030a] criar usuário sem senha envia o link de acesso (7 dias) pelo remetente verificado e informa o resultado", async () => {
    enviados.length = 0;
    const r = await call("POST", "/api/admin/users", MASTER, { name: "Psico Piloto", email: "psico@outlook.test", role: "specialist", specialty: "psicologia", tenantId: tA.id });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.emailStatus, "sent");
    assert.match(r.body.message, /7 dias/);

    assert.equal(enviados.length, 1);
    assert.equal(enviados[0].to, "psico@outlook.test");
    assert.match(enviados[0].from, /@projetoperiscopio\.com\.br>?$/, "domínio verificado no Resend");
    const link = /https:\/\/app\.teste\.local\/redefinir\?token=([^"&\s]+)/.exec(enviados[0].html);
    assert.ok(link, "o e-mail traz o link de criar a senha");

    const { verifyAccessToken } = await import("../auth/access-link");
    const token = decodeURIComponent(link![1]);
    const dia = 24 * 60 * 60 * 1000;
    assert.ok(verifyAccessToken(token, Date.now() + 6 * dia), "vale 6 dias depois");
    assert.equal(verifyAccessToken(token, Date.now() + 8 * dia), null, "vence em 7 dias");

    // E o link realmente cria a senha e é de uso único.
    const set = await call("POST", "/api/access/set-password", undefined, { token, password: "nova-senha-123" });
    assert.equal(set.status, 200, JSON.stringify(set.body));
    assert.equal((await call("POST", "/api/access/set-password", undefined, { token, password: "outra-senha-123" })).status, 400);
  });

  test("[REG-030b] se o e-mail não sai, a resposta diz o motivo, o usuário fica criado e o reenvio funciona", async () => {
    resendResponde = { status: 403, body: { name: "validation_error", message: "The periscopiosaude.com.br domain is not verified." } };
    const falha = await call("POST", "/api/admin/users", MASTER, { name: "Fono Dois", email: "fono2@outlook.test", role: "specialist", specialty: "fonoaudiologia", tenantId: tA.id });
    assert.equal(falha.status, 200);
    assert.equal(falha.body.emailStatus, "failed");
    assert.match(falha.body.emailError, /not verified|recusou/i);
    assert.match(falha.body.message, /NÃO saiu/);
    assert.ok(await usuario("fono2@outlook.test"));

    const reenvioFalha = await call("POST", `/api/admin/users/${(await usuario("fono2@outlook.test")).id}/send-access`, MASTER);
    assert.equal(reenvioFalha.status, 502);
    assert.equal(reenvioFalha.body.emailStatus, "failed");

    resendResponde = { status: 200, body: { id: "email-teste" } };
    enviados.length = 0;
    const reenvio = await call("POST", `/api/admin/users/${(await usuario("fono2@outlook.test")).id}/send-access`, MASTER);
    assert.equal(reenvio.status, 200, JSON.stringify(reenvio.body));
    assert.equal(enviados[0]?.to, "fono2@outlook.test");

    const auditoria = await H.db.select().from(H.auditLogs);
    assert.ok(auditoria.some((a: any) => a.action === "access:link_failed"));
    assert.ok(auditoria.some((a: any) => a.action === "access:link_sent"));
  });

  test("[REG-030c] sem RESEND_API_KEY o motivo aparece; com senha definida pelo administrador nenhum e-mail é disparado", async () => {
    const chave = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    const semChave = await call("POST", "/api/admin/users", MASTER, { name: "Sem Chave", email: "semchave@outlook.test", role: "specialist", specialty: "psicologia", tenantId: tA.id });
    process.env.RESEND_API_KEY = chave;
    assert.equal(semChave.body.emailStatus, "failed");
    assert.match(semChave.body.emailError, /RESEND_API_KEY/);

    enviados.length = 0;
    const comSenha = await call("POST", "/api/admin/users", MASTER, { name: "Com Senha", email: "comsenha@outlook.test", role: "specialist", specialty: "psicologia", tenantId: tA.id, password: "senha-definida-1" });
    assert.equal(comSenha.body.emailStatus, "skipped");
    assert.equal(enviados.length, 0);
  });

  test("[REG-030d] a instância é obrigatória e validada para quem não é da plataforma; escola de outra instância é recusada", async () => {
    const base = { name: "Fulano Teste", role: "specialist", specialty: "psicologia" };
    const semTenant = await call("POST", "/api/admin/users", MASTER, { ...base, email: "t1@outlook.test" });
    assert.equal(semTenant.status, 400);
    assert.match(semTenant.body.error, /tenantId/);
    assert.equal((await call("POST", "/api/admin/users", MASTER, { ...base, email: "t2@outlook.test", tenantId: "00000000-0000-0000-0000-0000000000aa" })).status, 400);
    assert.equal((await call("POST", "/api/admin/users", MASTER, { ...base, email: "t3@outlook.test", tenantId: "nao-e-uuid" })).status, 400);
    assert.equal((await call("POST", "/api/admin/users", MASTER, { ...base, email: "t4@outlook.test", tenantId: tA.id, schoolId: sB.id })).status, 400);
    for (const e of ["t1", "t2", "t3", "t4"]) assert.equal(await usuario(`${e}@outlook.test`), undefined);

    const lista = await call("GET", "/api/admin/tenants", MASTER);
    assert.deepEqual(lista.body.tenants.map((t: any) => t.name).sort(), ["Município A (teste)", "Município B (teste)"]);
    assert.equal((await call("GET", "/api/admin/tenants", "medico@teste.local")).status, 403);
  });

  test("[REG-030e] reenviar acesso exige permissão e usuário existente", async () => {
    const u = await usuario("psico@outlook.test");
    assert.equal((await call("POST", `/api/admin/users/${u.id}/send-access`, "medico@teste.local")).status, 403);
    assert.equal((await call("POST", "/api/admin/users/00000000-0000-0000-0000-0000000000aa/send-access", MASTER)).status, 404);
  });
});
