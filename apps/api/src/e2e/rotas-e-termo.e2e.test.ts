/**
 * Jornada dos especialistas COM a trava do termo ligada (como em produção) e varredura de rotas — [REG-009].
 *
 * Por que existe: em 05/nov/2026 o psicólogo e o psicomotricista entraram e o painel não "puxou" o encaminhamento do médico.
 * Causas: (1) a trava do termo devolvia 403 e o site escondia o motivo; (2) a seção de psicologia/neuropsicologia tinha
 * sido atribuída à conta de outra especialidade. Nenhum teste rodava com a trava ligada, então nada pegou.
 *
 * Roda só com TEST_DATABASE_URL (banco local de teste). Dados sintéticos.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente (E2E precisa de Postgres local de teste)" : false;

describe("[REG-009] jornada dos especialistas com a trava do termo ligada", { skip }, () => {
  let app: FastifyInstance;
  let H: any;
  let caseId = "";
  const sec: Record<string, string> = {};
  const MASTER = "master@teste.local";
  const U = {
    re: "re@teste.local",
    md: "medico@teste.local",
    mdOutro: "medico.b@teste.local",
    fono: "fono@teste.local",
    psico: "psico@teste.local",
    psicomot: "psicomot@teste.local",
    neuro: "neuro@teste.local",
    psicoped: "psicoped@teste.local",
  };
  const ids: Record<string, string> = {};

  async function call(method: string, path: string, email?: string, body?: unknown) {
    const headers: Record<string, string> = { origin: "http://localhost:3000" };
    if (email) headers["x-test-email"] = email;
    if (body !== undefined) headers["content-type"] = "application/json";
    const r = await app.inject({ method: method as any, url: path, headers, payload: body === undefined ? undefined : JSON.stringify(body) });
    let parsed: any = null;
    try { parsed = r.json(); } catch { parsed = r.body; }
    return { status: r.statusCode, body: parsed };
  }
  const aceitar = async (email: string) => assert.equal((await call("POST", "/api/me/professional-consent/accept", email, { accepted: true })).status, 200, email);

  before(async () => {
    const { assertSafeTestDatabase, resetTestDatabase } = await import("../testing/test-db");
    assertSafeTestDatabase(url);
    await resetTestDatabase(url!);

    process.env.DATABASE_URL = url!;
    process.env.NODE_ENV = "test";
    process.env.REQUIRE_PROFESSIONAL_TERM = "true";
    process.env.SUPERADMIN_EMAILS = MASTER;
    process.env.BETTER_AUTH_SECRET = "segredo-de-teste-com-mais-de-32-caracteres!!";
    process.env.BETTER_AUTH_URL = "http://localhost:3001";
    process.env.CORS_ORIGINS = "http://localhost:3000";

    const shared = await import("@periscopio/shared");
    const { db } = await import("../db/client");
    const { VIRTUAL_ADMIN_ID } = await import("../security/roles");
    const { buildApp } = await import("../app");
    H = { ...shared, db };

    const [tA] = await db.insert(shared.tenants).values({ name: "Município A (teste)", municipalityCode: "A" }).returning();
    const [tB] = await db.insert(shared.tenants).values({ name: "Município B (teste)", municipalityCode: "B" }).returning();
    await db.insert(shared.tenants).values({ id: VIRTUAL_ADMIN_ID, name: "Plataforma Global (teste)", municipalityCode: "GLOBAL" });
    // /api/bi/* aponta o Master para o município de Tarumã (existe em produção); sem ele a auditoria quebra a FK só no teste.
    await db.insert(shared.tenants).values({ id: "a6232550-b4f2-4a2f-9fbc-6f8eeb482d0b", name: "Município Tarumã (teste)", municipalityCode: "TARUMA" });
    const [sA] = await db.insert(shared.schools).values({ tenantId: tA.id, name: "Escola A1", slug: "escola-a1", status: "active" }).returning();
    const [sB] = await db.insert(shared.schools).values({ tenantId: tB.id, name: "Escola B1", slug: "escola-b1", status: "active" }).returning();

    const pessoas: [string, string, string, string | null, string, string][] = [
      ["re", U.re, "ppi", "psicopedagogia", tA.id, sA.id],
      ["md", U.md, "md1", "medicina", tA.id, sA.id],
      ["mdOutro", U.mdOutro, "md1", "medicina", tB.id, sB.id],
      ["fono", U.fono, "specialist", "fonoaudiologia", tA.id, sA.id],
      ["psico", U.psico, "specialist", "psicologia", tA.id, sA.id],
      ["psicomot", U.psicomot, "specialist", "psicomotricidade", tA.id, sA.id],
      ["neuro", U.neuro, "specialist", "neuropsicologia", tA.id, sA.id],
      ["psicoped", U.psicoped, "specialist", "psicopedagogia", tA.id, sA.id],
    ];
    for (const [k, email, role, specialty, tenantId, schoolId] of pessoas) {
      const [u] = await db.insert(shared.users).values({ tenantId, schoolId, email, name: `Pessoa ${k}`, role, specialty, accessEnabled: true }).returning();
      ids[k] = u.id;
    }

    const [st] = await db.insert(shared.students).values({ tenantId: tA.id, schoolId: sA.id, studentCode: "ROT-0001", birthYear: 2018, birthMonth: 3, ageBracket: "06-09", grade: "3º ano" }).returning();
    const [c] = await db.insert(shared.cases).values({ tenantId: tA.id, studentId: st.id, status: "triagem", journeyState: "delegado" as never }).returning();
    caseId = c.id;
    // Como estava em produção: psicologia e neuropsicologia atribuídas à conta da psicopedagogia.
    const atribuicoes: [string, string][] = [
      ["fonoaudiologia", "fono"],
      ["psicologia", "psicoped"],
      ["neuropsicologia", "psicoped"],
      ["psicomotricidade", "psicomot"],
    ];
    for (const [specialty, quem] of atribuicoes) {
      const [r] = await db.insert(shared.caseSummaries).values({ caseId, tenantId: tA.id, schoolId: sA.id, specialty, assignedProfessionalId: ids[quem], status: "pendente" }).returning();
      sec[specialty] = r.id;
    }

    app = await buildApp({ logger: process.env.TEST_LOG === "1" }); // TEST_LOG=1 mostra os erros das rotas
    await app.ready();
  });

  after(async () => {
    await app?.close();
    const { db } = await import("../db/client");
    await (db as any).$client.end();
  });

  test("[REG-009a] sem aceitar o termo o especialista é barrado com o motivo certo; a janela do termo continua acessível", async () => {
    for (const quem of [U.fono, U.psico, U.psicomot, U.neuro, U.psicoped]) {
      const r = await call("GET", "/api/cases/my-delegated-sections", quem);
      assert.equal(r.status, 403, quem);
      assert.equal(r.body.code, "TERMO_PENDENTE", quem);
      const t = await call("GET", "/api/me/professional-consent", quem);
      assert.equal(t.status, 200, quem);
      assert.equal(t.body.hasAccepted, false);
    }
  });

  test("[REG-009b] depois de aceitar, cada especialista puxa o encaminhamento que o médico fez para ele", async () => {
    for (const quem of [U.fono, U.psico, U.psicomot, U.neuro, U.psicoped, U.md, U.re]) await aceitar(quem);
    const especialidades = async (quem: string) =>
      ((await call("GET", "/api/cases/my-delegated-sections", quem)).body.assignedSections as { specialty: string }[]).map((s) => s.specialty).sort();
    assert.deepEqual(await especialidades(U.fono), ["fonoaudiologia"]);
    assert.deepEqual(await especialidades(U.psicomot), ["psicomotricidade"]);
    assert.deepEqual(await especialidades(U.psicoped), ["neuropsicologia", "psicologia"], "quem recebeu a atribuição vê as seções, qualquer que seja a especialidade dele");
    assert.deepEqual(await especialidades(U.neuro), [], "a neuropsicóloga não vê nada: a seção foi atribuída a outra conta");
    assert.deepEqual(await especialidades(U.psico), []);
    const vista = await call("GET", `/api/cases/${caseId}/specialist-view`, U.fono);
    assert.equal(vista.status, 200, JSON.stringify(vista.body));
  });

  test("[REG-009c] a fono salva, o status deixa de ser 'não iniciado' e a Conduta aparece como item próprio", async () => {
    const base = `/api/cases/sections/${sec.fonoaudiologia}/forms`;
    const lista0 = await call("GET", base, U.fono);
    assert.equal(lista0.status, 200, JSON.stringify(lista0.body));
    const ids0: string[] = lista0.body.forms.map((f: any) => f.id);
    assert.ok(ids0.indexOf("fono_srs2") < ids0.indexOf("fono_conduta") && ids0.indexOf("fono_conduta") < ids0.indexOf("fono_plano_terapeutico"), "Conduta entre o item 3 e o 4");

    const plano = {
      diagnostico: "Texto do profissional",
      data_ultima_avaliacao: "2026-10-01",
      hipotese_fono: "Hipótese do profissional",
      data_prevista_reavaliacao: "2027-02-01",
      sessoes_previstas: "12",
      principais_achados: "Achados",
      objetivo_geral: "Objetivo",
      objetivo_a: "a",
      criterios_alta: "Critérios propostos",
    };
    const salvo = await call("PUT", `${base}/fono_plano_terapeutico`, U.fono, { payload: plano });
    assert.equal(salvo.status, 200, JSON.stringify(salvo.body));
    assert.equal(salvo.body.form.status, "rascunho");
    const lista1 = await call("GET", base, U.fono);
    assert.equal(lista1.body.forms.find((f: any) => f.id === "fono_plano_terapeutico").status, "rascunho", "salvo = rascunho, não 'não iniciado'");

    const conduta = await call("PUT", `${base}/fono_conduta`, U.fono, { payload: { conduta_audicao: ["encaminhar_orl"], conclusao: "Conclusão", conduta: "Conduta" } });
    assert.equal(conduta.status, 200, JSON.stringify(conduta.body));
    assert.equal((await call("POST", `${base}/fono_plano_terapeutico/complete`, U.fono)).status, 200, "concluir funciona");
  });

  test("[REG-009d] o médico troca o profissional de uma seção pendente: a neuropsicóloga passa a ver a dela", async () => {
    const url = `/api/cases/sections/${sec.neuropsicologia}/reassign`;
    assert.equal((await call("POST", url, U.fono, { professionalId: ids.neuro })).status, 403, "só quem pode delegar");
    assert.equal((await call("POST", url, U.mdOutro, { professionalId: ids.neuro })).status, 403, "médico de outro município (sem o termo aceito) é barrado");
    await aceitar(U.mdOutro);
    assert.equal((await call("POST", url, U.mdOutro, { professionalId: ids.neuro })).status, 404, "outro município não enxerga a seção");
    assert.equal((await call("POST", url, U.md, { professionalId: ids.re })).status, 400, "só especialista do município");
    assert.equal((await call("POST", url, U.md, { professionalId: "nao-e-uuid" })).status, 400);

    const ok = await call("POST", url, U.md, { professionalId: ids.neuro });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const ver = async (quem: string) =>
      ((await call("GET", "/api/cases/my-delegated-sections", quem)).body.assignedSections as { specialty: string }[]).map((s) => s.specialty).sort();
    assert.deepEqual(await ver(U.neuro), ["neuropsicologia"]);
    assert.deepEqual(await ver(U.psicoped), ["psicologia"]);

    const trilha = await H.db.select().from(H.caseTimeline);
    assert.ok(trilha.some((t: any) => t.event === "case:delegation_reassigned"), "a troca fica na trilha do caso");
  });

  test("[REG-009e] não troca quando o profissional já começou (nada é perdido) nem quando a seção não está pendente", async () => {
    assert.equal((await call("POST", `/api/cases/sections/${sec.fonoaudiologia}/reassign`, U.md, { professionalId: ids.psicoped })).status, 409, "a fono já salvou formulários");
    await H.db.update(H.caseSummaries).set({ status: "concluido" }).where((await import("drizzle-orm")).eq(H.caseSummaries.id, sec.psicomotricidade));
    assert.equal((await call("POST", `/api/cases/sections/${sec.psicomotricidade}/reassign`, U.md, { professionalId: ids.psicoped })).status, 409, "seção concluída");
  });

  test("[REG-009f] varredura: nenhuma rota GET responde 5xx para médico, RE, especialista nem Admin Master", async () => {
    const rotas = new Set<string>();
    // reconstrói os caminhos completos da árvore do printRoutes (ver contract/web-api-contract.test.ts)
    const pilha: string[] = [];
    for (const linha of app.printRoutes({ method: "GET", commonPrefix: false }).split("\n")) {
      const m = linha.match(/^((?:│   |    )*)[├└]── (.*)$/);
      if (!m) continue;
      const nivel = m[1].length / 4;
      const comMetodo = m[2].match(/^(.*?) \(([A-Z, ]+)\)$/);
      pilha[nivel] = comMetodo ? comMetodo[1] : m[2];
      pilha.length = nivel + 1;
      if (comMetodo) rotas.add(pilha.join("").replace(/^\/\//, "/"));
    }
    assert.ok(rotas.size > 60, `só ${rotas.size} rotas lidas`);

    // Rotas que dependem de serviço externo ou são documentação/infra: não entram na varredura.
    const IGNORAR = [/^\/docs/, /^\/api\/auth\//, /^\/health/, /^\/metrics/, /^\/api\/viacep/, /^\/api\/rnds/, /^\/api\/locations\/cep/];
    const falhas: string[] = [];
    let chamadas = 0;
    for (const bruta of rotas) {
      if (IGNORAR.some((r) => r.test(bruta))) continue;
      const caminho = bruta.replace(/:[A-Za-z_]+/g, "00000000-0000-4000-8000-000000000000").replace(/\*$/, "x");
      for (const quem of [U.md, U.re, U.fono, MASTER]) {
        const r = await call("GET", caminho, quem);
        chamadas += 1;
        if (r.status >= 500) falhas.push(`${r.status} GET ${caminho} (${quem})`);
      }
    }
    assert.ok(chamadas > 200, `varredura curta demais (${chamadas})`);
    assert.deepEqual(falhas, [], `Rotas com erro de servidor:\n${falhas.join("\n")}`);
  });

  test("[REG-010] gravar auditoria como Admin Master (ator virtual) não derruba nada, nem dentro de transação", async () => {
    const { inserirAuditoria } = await import("../services/audit.service");
    const { VIRTUAL_ADMIN_ID } = await import("../security/roles");
    const { eq } = await import("drizzle-orm");
    await inserirAuditoria(H.db, { tenantId: VIRTUAL_ADMIN_ID, actorId: VIRTUAL_ADMIN_ID, action: "teste.direto", entity: "teste" });
    await H.db.transaction(async (tx: any) => {
      await inserirAuditoria(tx, { tenantId: VIRTUAL_ADMIN_ID, actorId: VIRTUAL_ADMIN_ID, action: "teste.transacao", entity: "teste", metadata: { origem: "x" } });
    });
    for (const acao of ["teste.direto", "teste.transacao"]) {
      const [linha] = await H.db.select().from(H.auditLogs).where(eq(H.auditLogs.action, acao));
      assert.ok(linha, acao);
      assert.equal(linha.actorId, null);
      assert.equal((linha.metadata as any).actor, "admin_master_virtual");
    }
    const [t] = await H.db.select().from(H.auditLogs).where(eq(H.auditLogs.action, "teste.transacao"));
    assert.equal((t.metadata as any).origem, "x", "o metadata original é preservado");
  });

  test("[REG-012] o mapa técnico do sistema é só do Admin Master: sem login 401, demais perfis 403, Master 200", async () => {
    assert.equal((await call("GET", "/api/admin/system-map")).status, 401);
    for (const email of [U.md, U.re, U.fono, U.psicomot]) {
      const r = await call("GET", "/api/admin/system-map", email);
      assert.equal(r.status, 403, `${email} não pode ler o mapa`);
      assert.equal(r.body.groups, undefined, "nenhum dado do mapa vaza na recusa");
    }
    const ok = await call("GET", "/api/admin/system-map", MASTER);
    assert.equal(ok.status, 200);
    assert.ok(ok.body.groups.length >= 10 && ok.body.edges.length > 0);
    assert.ok(!/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(JSON.stringify(ok.body)), "o mapa não carrega e-mail de ninguém");
    assert.ok(!/postgres(ql)?:\/\/|eyJ[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}/.test(JSON.stringify(ok.body)), "o mapa não carrega connection string nem chave");
  });
});
