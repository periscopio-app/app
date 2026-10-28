/**
 * Auditoria SOMENTE LEITURA para PostgreSQL (Neon, RDS ou Supabase Postgres).
 *
 * Não consulta linhas de negócio, não imprime DATABASE_URL e não executa DDL/DML.
 * Ela comprova configuração visível do banco; a prova comportamental de isolamento
 * entre dois tenants continua sendo responsabilidade da suíte E2E sintética.
 *
 * Uso:
 *   DATABASE_URL=... pnpm --filter @periscopio/api db:security-audit -- --label neon-homolog
 */
import "dotenv/config";
import { Client } from "pg";

type QueryRow = Record<string, unknown>;

function bool(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1;
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : value == null ? null : String(value);
}

function label(): string {
  const arg = process.argv.find((value) => value.startsWith("--label="));
  return arg?.slice("--label=".length).replace(/[^a-zA-Z0-9_.-]/g, "_") || "unlabeled";
}

async function query(client: Client, sql: string, values: unknown[] = []): Promise<QueryRow[]> {
  const result = await client.query<QueryRow>(sql, values);
  return result.rows;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL ausente. Informe-a apenas no ambiente de execução.");

  const client = new Client({
    connectionString,
    ssl: connectionString.includes("sslmode=require") || connectionString.includes("neon.tech") || process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();
  try {
    const [identity] = await query(
      client,
      `select
        current_user as current_user,
        session_user as session_user,
        current_setting('row_security', true) as row_security_setting,
        nullif(current_setting('app.tenant_id', true), '') is not null as has_app_tenant_id,
        nullif(current_setting('app.current_tenant_id', true), '') is not null as has_app_current_tenant_id,
        nullif(current_setting('app.cross_tenant', true), '') is not null as has_app_cross_tenant`
    );

    const tables = await query(
      client,
      `select n.nspname as schema, c.relname as table, pg_get_userbyid(c.relowner) as owner,
              c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where c.relkind in ('r', 'p')
          and n.nspname in ('public', 'storage')
        order by n.nspname, c.relname`
    );

    const policies = await query(
      client,
      `select schemaname as schema, tablename as table, policyname, permissive, roles, cmd,
              qual is not null as has_using, with_check is not null as has_with_check
         from pg_policies
        where schemaname in ('public', 'storage')
        order by schemaname, tablename, policyname`
    );

    const columns = await query(
      client,
      `select table_schema as schema, table_name as table, column_name, grantee, privilege_type
         from information_schema.column_privileges
        where table_schema in ('public', 'storage')
        order by table_schema, table_name, column_name, grantee, privilege_type`
    );

    const owners = [...new Set(tables.map((row) => text(row.owner)).filter((value): value is string => !!value))];
    const roles = owners.length
      ? await query(
          client,
          `select rolname, rolcanlogin, rolsuper, rolbypassrls
             from pg_roles
            where rolname = any($1::text[])
               or rolname = current_user
            order by rolname`,
          [owners]
        )
      : [];

    const extensions = await query(
      client,
      `select extname, extversion
         from pg_extension
        where extname in ('vector', 'pgcrypto', 'pgaudit')
        order by extname`
    );

    const rlsOff = tables.filter((row) => !bool(row.rls_enabled));
    const bypassingOwners = roles.filter((row) => bool(row.rolsuper) || bool(row.rolbypassrls));
    const storageObjects = tables.find((row) => row.schema === "storage" && row.table === "objects");

    const report = {
      audit: "postgres-security-configuration",
      label: label(),
      generatedAt: new Date().toISOString(),
      scope: "catalog metadata only; no business rows or secrets were read",
      connection: {
        currentUser: text(identity?.current_user),
        sessionUser: text(identity?.session_user),
        rowSecuritySetting: text(identity?.row_security_setting),
        tenantContextConfigured: bool(identity?.has_app_tenant_id) || bool(identity?.has_app_current_tenant_id),
        crossTenantContextConfigured: bool(identity?.has_app_cross_tenant),
      },
      tables,
      policies,
      columnPrivileges: columns,
      roles,
      extensions,
      findings: {
        tablesWithoutRls: rlsOff.map((row) => `${row.schema}.${row.table}`),
        ownersWithBypassRlsOrSuperuser: bypassingOwners.map((row) => text(row.rolname)),
        vectorExtensionAvailable: extensions.some((row) => row.extname === "vector"),
        storageObjectsPresent: Boolean(storageObjects),
        storageObjectsRlsEnabled: storageObjects ? bool(storageObjects.rls_enabled) : null,
        behavioralProofStillRequired: [
          "Executar E2E sintético com tenant A e tenant B usando o mesmo papel efetivo da aplicação.",
          "Confirmar que SELECT/INSERT/UPDATE cross-tenant são negados e que auditoria append-only rejeita UPDATE/DELETE.",
          "Para Supabase Storage, executar teste separado contra storage.objects e objeto sintético em bucket privado.",
        ],
      },
    };

    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "falha desconhecida";
  process.stderr.write(`Auditoria não executada: ${message}\n`);
  process.exitCode = 1;
});
