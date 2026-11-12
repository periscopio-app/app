/**
 * REG-015 — migrações 0030 a 0036 (lote "mudancas_demo_sp_presencial").
 * Confere o que o BANCO garante, sem depender de rota: foto no Postgres, etiquetas únicas, devolução somente inserção
 * com justificativa de 100 a 150 caracteres, volumetria agregada, a ATA aceita como etapa opcional e o RE sem itens de gestão.
 * Dados sintéticos. Requer TEST_DATABASE_URL (Postgres local de teste).
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;

describe("Migrações do lote SP (REG-015)", { skip }, () => {
  let db: typeof import("../db/client").db;
  let pool: typeof import("../db/client").pool;
  let shared: typeof import("@periscopio/shared");
  let tenantId = "";
  let schoolId = "";
  let userId = "";
  let caseId = "";

  const motivo = (n: number) => "Os dados do aluno parecem inconsistentes entre os blocos e preciso conversar com o RE antes de seguir.".padEnd(n, "x").slice(0, n);

  const rejeita = async (sql: string, params: unknown[], trecho: RegExp) => {
    await assert.rejects(() => pool.query(sql, params), (e: Error) => trecho.test(e.message), `esperava recusa: ${trecho}`);
  };

  before(async () => {
    const { assertSafeTestDatabase, resetTestDatabase } = await import("../testing/test-db");
    assertSafeTestDatabase(url);
    await resetTestDatabase(url!);
    process.env.DATABASE_URL = url!;
    process.env.NODE_ENV = "test";
    shared = await import("@periscopio/shared");
    ({ db, pool } = await import("../db/client"));

    const [t] = await db.insert(shared.tenants).values({ name: "Município SP", municipalityCode: "SP1" }).returning();
    tenantId = t.id;
    const [s] = await db.insert(shared.schools).values({ tenantId, name: "Escola Lote SP", slug: "lote-sp", status: "active" }).returning();
    schoolId = s.id;
    const [u] = await db
      .insert(shared.users)
      .values({ tenantId, schoolId, email: "re.sp@teste.local", name: "re-sp", role: "ppi", accessEnabled: true })
      .returning();
    userId = u.id;
    const [st] = await db.insert(shared.students).values({ tenantId, schoolId, studentCode: "SP-0001", birthYear: 2018, birthMonth: 3, ageBracket: "06-09", grade: "3º ano" }).returning();
    const [c] = await db.insert(shared.cases).values({ tenantId, studentId: st.id, status: "triagem", journeyState: "enviado_re" as never }).returning();
    caseId = c.id;
  });

  after(async () => {
    await pool.end();
  });

  test("0030: foto fica no Postgres, só JPEG/PNG/WEBP até 3 MB, e some junto com o usuário", async () => {
    await pool.query(
      "INSERT INTO user_avatars (user_id, tenant_id, content, content_type, size_bytes) VALUES ($1,$2,$3,'image/png',3)",
      [userId, tenantId, Buffer.from([1, 2, 3])]
    );
    const lida = await pool.query("SELECT key, size_bytes FROM user_avatars WHERE user_id = $1", [userId]);
    assert.equal(lida.rowCount, 1);
    assert.match(lida.rows[0].key, /^[0-9a-f-]{36}$/, "chave opaca (uuid), sem nome nem e-mail");

    await rejeita("UPDATE user_avatars SET content_type = 'application/pdf' WHERE user_id = $1", [userId], /user_avatars_type_chk/);
    await rejeita("UPDATE user_avatars SET size_bytes = 3145729 WHERE user_id = $1", [userId], /user_avatars_size_chk/);
    await rejeita("UPDATE user_avatars SET size_bytes = 0 WHERE user_id = $1", [userId], /user_avatars_size_chk/);

    const [outro] = await db.insert(shared.users).values({ tenantId, schoolId, email: "apaga@teste.local", name: "apaga", role: "ppi", accessEnabled: true }).returning();
    await pool.query("INSERT INTO user_avatars (user_id, tenant_id, content, content_type, size_bytes) VALUES ($1,$2,$3,'image/jpeg',1)", [outro.id, tenantId, Buffer.from([9])]);
    await pool.query("DELETE FROM users WHERE id = $1", [outro.id]);
    assert.equal((await pool.query("SELECT 1 FROM user_avatars WHERE user_id = $1", [outro.id])).rowCount, 0, "apagar o usuário apaga a foto");
  });

  test("0031: etiqueta repetida (ignorando maiúscula e espaços) é recusada no mesmo grupo, mas vale em outro grupo e outro município", async () => {
    await pool.query("INSERT INTO etiquetas (tenant_id, grupo, rotulo) VALUES ($1,'dificuldades_persistentes','Visão')", [tenantId]);
    await rejeita("INSERT INTO etiquetas (tenant_id, grupo, rotulo) VALUES ($1,'dificuldades_persistentes','  visão ')", [tenantId], /etiquetas_tenant_grupo_rotulo_uq/);
    await pool.query("INSERT INTO etiquetas (tenant_id, grupo, rotulo) VALUES ($1,'outro_grupo','Visão')", [tenantId]);
    const [t2] = await db.insert(shared.tenants).values({ name: "Município SP2", municipalityCode: "SP2" }).returning();
    await pool.query("INSERT INTO etiquetas (tenant_id, grupo, rotulo) VALUES ($1,'dificuldades_persistentes','Visão')", [t2.id]);
    await rejeita("INSERT INTO etiquetas (tenant_id, grupo, rotulo) VALUES ($1,'Grupo Ruim','x1')", [tenantId], /etiquetas_grupo_chk/);
    await rejeita("INSERT INTO etiquetas (tenant_id, grupo, rotulo) VALUES ($1,'ok_grupo','a')", [tenantId], /etiquetas_rotulo_chk/);
    assert.equal((await pool.query("SELECT ativo FROM etiquetas WHERE tenant_id = $1 AND grupo = 'outro_grupo'", [tenantId])).rows[0].ativo, true, "nasce ativa");
  });

  test("0032: devolução exige justificativa de 100 a 150 caracteres, tem UUID e não pode ser alterada nem apagada", async () => {
    await rejeita("INSERT INTO case_returns (tenant_id, case_id, returned_by, returned_by_role, reason) VALUES ($1,$2,$3,'md1',$4)", [tenantId, caseId, userId, motivo(99)], /case_returns_reason_chk/);
    await rejeita("INSERT INTO case_returns (tenant_id, case_id, returned_by, returned_by_role, reason) VALUES ($1,$2,$3,'md1',$4)", [tenantId, caseId, userId, motivo(151)], /case_returns_reason_chk/);

    const ok100 = await pool.query("INSERT INTO case_returns (tenant_id, case_id, returned_by, returned_by_role, reason, idempotency_key) VALUES ($1,$2,$3,'md1',$4,'k-1') RETURNING return_id", [tenantId, caseId, userId, motivo(100)]);
    await pool.query("INSERT INTO case_returns (tenant_id, case_id, returned_by, returned_by_role, reason) VALUES ($1,$2,$3,'md1',$4)", [tenantId, caseId, userId, motivo(150)]);
    const returnId = ok100.rows[0].return_id as string;
    assert.match(returnId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, "return_id é um uuid v4");

    await rejeita("INSERT INTO case_returns (tenant_id, case_id, returned_by, returned_by_role, reason, idempotency_key) VALUES ($1,$2,$3,'md1',$4,'k-1')", [tenantId, caseId, userId, motivo(120)], /case_returns_idem_uq/);
    await rejeita("UPDATE case_returns SET reason = $2 WHERE return_id = $1", [returnId, motivo(110)], /somente inserção/);
    await rejeita("DELETE FROM case_returns WHERE return_id = $1", [returnId], /somente inserção/);
  });

  test("0033: volumetria guarda só contagens por dia, formulário e tipo", async () => {
    const cols = (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'justification_metrics' ORDER BY ordinal_position")).rows.map((r) => r.column_name);
    assert.deepEqual(cols, ["tenant_id", "day", "form", "kind", "n", "chars", "words", "est_tokens", "updated_at"], "nenhuma coluna de texto, aluno ou autor");
    const upsert = `INSERT INTO justification_metrics (tenant_id, day, form, kind, n, chars, words, est_tokens) VALUES ($1,'2026-11-06','fogap','sim_nao',1,120,20,30)
      ON CONFLICT (tenant_id, day, form, kind) DO UPDATE SET n = justification_metrics.n + 1, chars = justification_metrics.chars + 120, words = justification_metrics.words + 20, est_tokens = justification_metrics.est_tokens + 30`;
    await pool.query(upsert, [tenantId]);
    await pool.query(upsert, [tenantId]);
    const r = (await pool.query("SELECT n, chars, est_tokens FROM justification_metrics WHERE tenant_id = $1", [tenantId])).rows[0];
    assert.deepEqual([r.n, r.chars, r.est_tokens], [2, 240, 60]);
  });

  test("0034: exceção que liberava gestão ao RE é removida; exceção de outro perfil ou de bloqueio fica", async () => {
    // A migração já rodou no banco recém-criado; aqui reaplicamos o mesmo DELETE para provar o efeito e a idempotência.
    const sql34 = (await import("node:fs")).readFileSync(new URL("../../drizzle/0034_re_sem_itens_de_gestao.sql", import.meta.url), "utf8");
    const zero = "00000000-0000-0000-0000-000000000000";
    await pool.query(
      `INSERT INTO privilege_role_grants (scope_tenant_id, role, capability, allowed) VALUES
        ($1,'ppi','bi.view',true), ($1,'ppi','population.view',true), ($1,'ppi','pilot.indicators.view',true),
        ($1,'ppi','board.request',true), ($1,'md1','bi.view',true), ($1,'ppi','fogap.fill',true), ($1,'re','bi.view',false)`,
      [zero]
    );
    await pool.query(sql34);
    await pool.query(sql34); // idempotente
    const resta = (await pool.query("SELECT role, capability, allowed FROM privilege_role_grants WHERE scope_tenant_id = $1 ORDER BY role, capability", [zero])).rows.map((r) => `${r.role}:${r.capability}:${r.allowed}`);
    assert.deepEqual(resta, ["md1:bi.view:true", "ppi:board.request:true", "ppi:fogap.fill:true", "re:bi.view:false"]);
  });

  test("0036: gestão (indicadores, BI, mapa) só com o Administrador Master por padrão; exceções de outros perfis saem, as do admin e as de bloqueio ficam", async () => {
    const sql36 = (await import("node:fs")).readFileSync(new URL("../../drizzle/0036_gestao_so_admin_master.sql", import.meta.url), "utf8");
    const zero = "00000000-0000-0000-0000-000000000000";
    await pool.query("DELETE FROM privilege_role_grants WHERE scope_tenant_id = $1", [zero]);
    await pool.query(
      `INSERT INTO privilege_role_grants (scope_tenant_id, role, capability, allowed) VALUES
        ($1,'md1','bi.view',true), ($1,'school_manager','population.view',true), ($1,'board','pilot.indicators.view',true),
        ($1,'admin_platform','bi.view',true), ($1,'md1','board.request',true), ($1,'md1','population.view',false)`,
      [zero]
    );
    await pool.query(sql36);
    await pool.query(sql36); // idempotente
    const resta = (await pool.query("SELECT role, capability, allowed FROM privilege_role_grants WHERE scope_tenant_id = $1 ORDER BY role, capability", [zero])).rows.map((r) => `${r.role}:${r.capability}:${r.allowed}`);
    assert.deepEqual(resta, ["admin_platform:bi.view:true", "md1:board.request:true", "md1:population.view:false"]);
  });

  test("0035: a ATA (passo h) pode ser pulada e retomada; passo desconhecido continua recusado; trilha é somente inserção", async () => {
    const ins = (step: string, action: string) =>
      pool.query("INSERT INTO re_optional_step_usage (tenant_id, school_id, case_id, step, action, user_id, user_role) VALUES ($1,$2,$3,$4,$5,$6,'ppi') RETURNING id", [tenantId, schoolId, caseId, step, action, userId]);
    await ins("g", "pulado");
    const h = await ins("h", "pulado");
    await ins("h", "retomado");
    await rejeita("INSERT INTO re_optional_step_usage (tenant_id, school_id, case_id, step, action, user_id, user_role) VALUES ($1,$2,$3,'a','pulado',$4,'ppi')", [tenantId, schoolId, caseId, userId], /re_optional_step_usage_step_chk/);
    await rejeita("UPDATE re_optional_step_usage SET action = 'retomado' WHERE id = $1", [h.rows[0].id], /somente inserção/);
  });
});
