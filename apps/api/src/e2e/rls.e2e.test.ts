/**
 * Verifica o RLS do Postgres (migração 0018) usando o papel `periscopio_app`, que NÃO tem BYPASSRLS.
 * Requer TEST_DATABASE_URL (Postgres local de teste, com permissão de SET ROLE).
 *
 * Também serve de trava: toda tabela nova em public precisa nascer com RLS ligado e com política
 * para o papel da aplicação, ou este teste falha no CI.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;

describe("RLS por tenant (papel periscopio_app)", { skip }, () => {
  let admin: pg.Client;
  let tA = "";
  let tB = "";

  /** Executa `fn` como periscopio_app, com o contexto de sessão informado, dentro de uma transação revertida. */
  async function asApp<T>(
    ctx: { tenant?: string; cross?: boolean },
    fn: (c: pg.Client) => Promise<T>
  ): Promise<T> {
    const c = new pg.Client({ connectionString: url });
    await c.connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL ROLE periscopio_app");
      if (ctx.tenant) await c.query("SELECT set_config('app.tenant_id', $1, true)", [ctx.tenant]);
      if (ctx.cross) await c.query("SELECT set_config('app.cross_tenant', 'on', true)");
      return await fn(c);
    } finally {
      await c.query("ROLLBACK").catch(() => {});
      await c.end();
    }
  }

  /** Afirma que a instrução é recusada e desfaz só ela (a transação continua utilizável). */
  async function denied(c: pg.Client, sql: string, re: RegExp, params: unknown[] = []) {
    await c.query("SAVEPOINT s");
    await assert.rejects(c.query(sql, params), re);
    await c.query("ROLLBACK TO SAVEPOINT s");
  }

  before(async () => {
    const { assertSafeTestDatabase, resetTestDatabase } = await import("../testing/test-db");
    assertSafeTestDatabase(url);
    await resetTestDatabase(url!);
    admin = new pg.Client({ connectionString: url });
    await admin.connect();
    const a = await admin.query("INSERT INTO tenants (name, municipality_code) VALUES ('Tenant A','0000001') RETURNING id");
    const b = await admin.query("INSERT INTO tenants (name, municipality_code) VALUES ('Tenant B','0000002') RETURNING id");
    tA = a.rows[0].id;
    tB = b.rows[0].id;
    await admin.query("INSERT INTO schools (tenant_id, name, slug) VALUES ($1,'Escola A','esc-a'),($2,'Escola B','esc-b')", [tA, tB]);
    await admin.query("INSERT INTO audit_logs (tenant_id, action, entity) VALUES ($1,'x','schools'),($2,'x','schools')", [tA, tB]);
    await admin.query("INSERT INTO courses (title) VALUES ('Curso comum')");
  });

  after(async () => {
    await admin?.end();
  });

  test("trava: toda tabela de public tem RLS ligado e política para periscopio_app", async () => {
    const { rows } = await admin.query(`
      SELECT c.relname, c.relrowsecurity AS rls,
             (SELECT count(*) FROM pg_policies p
               WHERE p.schemaname = 'public' AND p.tablename = c.relname
                 AND ('periscopio_app' = ANY (p.roles) OR 'public' = ANY (p.roles))) AS policies
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r','p')`);
    assert.ok(rows.length >= 30, "esperava ao menos 30 tabelas");
    const sem = rows.filter((r) => !r.rls || Number(r.policies) === 0).map((r) => r.relname);
    assert.deepEqual(sem, [], `tabelas sem RLS/política: ${sem.join(", ")}`);
  });

  test("o papel da aplicação não é superuser nem ignora RLS", async () => {
    const { rows } = await admin.query("SELECT rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname = 'periscopio_app'");
    assert.deepEqual(rows[0], { rolsuper: false, rolbypassrls: false, rolcanlogin: false });
  });

  test("com tenant A, enxerga só linhas do A", async () => {
    await asApp({ tenant: tA }, async (c) => {
      const s = await c.query("SELECT tenant_id FROM schools");
      assert.equal(s.rowCount, 1);
      assert.equal(s.rows[0].tenant_id, tA);
      const t = await c.query("SELECT id FROM tenants");
      assert.deepEqual(t.rows.map((r) => r.id), [tA]);
    });
  });

  test("sem contexto, não enxerga nada e não consegue gravar (falha fechada)", async () => {
    await asApp({}, async (c) => {
      assert.equal((await c.query("SELECT 1 FROM schools")).rowCount, 0);
      assert.equal((await c.query("SELECT 1 FROM tenants")).rowCount, 0);
      await denied(c, "INSERT INTO schools (tenant_id, name) VALUES ($1,'x')", /row-level security/, [tA]);
    });
  });

  test("tenant A não grava, altera nem apaga linhas do tenant B", async () => {
    await asApp({ tenant: tA }, async (c) => {
      await denied(c, "INSERT INTO schools (tenant_id, name) VALUES ($1,'invasora')", /row-level security/, [tB]);
      assert.equal((await c.query("UPDATE schools SET name = 'hack' WHERE tenant_id = $1", [tB])).rowCount, 0);
      assert.equal((await c.query("DELETE FROM schools WHERE tenant_id = $1", [tB])).rowCount, 0);
      const ok = await c.query("INSERT INTO schools (tenant_id, name) VALUES ($1,'minha') RETURNING id", [tA]);
      assert.equal(ok.rowCount, 1);
    });
  });

  test("contexto cross_tenant (admin_platform / fluxo de sistema) enxerga todos", async () => {
    await asApp({ cross: true }, async (c) => {
      assert.equal((await c.query("SELECT 1 FROM schools")).rowCount, 2);
      assert.equal((await c.query("SELECT 1 FROM tenants")).rowCount, 2);
    });
  });

  test("trilhas append-only: lê e insere no próprio tenant, mas não altera nem apaga", async () => {
    await asApp({ tenant: tA }, async (c) => {
      assert.equal((await c.query("SELECT 1 FROM audit_logs")).rowCount, 1);
      await c.query("INSERT INTO audit_logs (tenant_id, action, entity) VALUES ($1,'y','schools')", [tA]);
      await denied(c, "INSERT INTO audit_logs (tenant_id, action, entity) VALUES ($1,'y','schools')", /row-level security/, [tB]);
      await denied(c, "UPDATE audit_logs SET action = 'z'", /permission denied/);
      await denied(c, "DELETE FROM audit_logs", /permission denied/);
    });
  });

  test("tenants: só contexto cross_tenant cria tenant", async () => {
    await asApp({ tenant: tA }, async (c) => {
      await denied(c, "INSERT INTO tenants (name, municipality_code) VALUES ('X','9')", /row-level security/);
    });
    await asApp({ cross: true }, async (c) => {
      assert.equal((await c.query("INSERT INTO tenants (name, municipality_code) VALUES ('X','9') RETURNING id")).rowCount, 1);
    });
  });

  test("privilégios: tenant lê a regra global e a sua, nunca a de outro tenant, e só grava na sua", async () => {
    const zero = "00000000-0000-0000-0000-000000000000";
    await admin.query(
      "INSERT INTO privilege_role_grants (scope_tenant_id, role, capability, allowed) VALUES ($1,'medico','x.global',true),($2,'medico','x.a',true),($3,'medico','x.b',true)",
      [zero, tA, tB]
    );
    await asApp({ tenant: tA }, async (c) => {
      const r = await c.query("SELECT capability FROM privilege_role_grants WHERE capability LIKE 'x.%' ORDER BY capability");
      assert.deepEqual(r.rows.map((x) => x.capability), ["x.a", "x.global"]);
      await denied(c, "INSERT INTO privilege_role_grants (scope_tenant_id, role, capability, allowed) VALUES ($1,'medico','x.b2',true)", /row-level security/, [tB]);
      await denied(c, "INSERT INTO privilege_role_grants (scope_tenant_id, role, capability, allowed) VALUES ($1,'medico','x.g2',true)", /row-level security/, [zero]);
    });
    await asApp({ cross: true }, async (c) => {
      const r = await c.query("SELECT count(*)::int AS n FROM privilege_role_grants WHERE capability LIKE 'x.%'");
      assert.equal(r.rows[0].n, 3);
    });
  });

  test("leads: o site público só insere; ler exige cross_tenant", async () => {
    await asApp({}, async (c) => {
      await c.query("INSERT INTO leads (nome, email, escola, cargo) VALUES ('N','n@x.br','E','Diretor')");
      assert.equal((await c.query("SELECT 1 FROM leads")).rowCount, 0);
    });
    await asApp({ cross: true }, async (c) => {
      await c.query("INSERT INTO leads (nome, email, escola, cargo) VALUES ('N','n@x.br','E','Diretor')");
      assert.equal((await c.query("SELECT 1 FROM leads")).rowCount, 1);
    });
  });

  test("catálogo do LMS: leitura para todos, escrita só cross_tenant", async () => {
    await asApp({ tenant: tA }, async (c) => {
      assert.equal((await c.query("SELECT 1 FROM courses")).rowCount, 1);
      await denied(c, "INSERT INTO courses (title) VALUES ('novo')", /row-level security/);
    });
  });

  test("o papel da aplicação não lê as views de autenticação (hash de senha e sessões)", async () => {
    await asApp({ cross: true }, async (c) => {
      await denied(c, 'SELECT 1 FROM public."user"', /permission denied/);
      await denied(c, "SELECT 1 FROM public.account", /permission denied/);
      await denied(c, "SELECT 1 FROM public.session", /permission denied/);
    });
  });
});
