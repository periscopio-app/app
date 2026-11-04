import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { cases, consentAcceptances, students } from "@periscopio/shared";
import { wipeCondition, wipeInTransaction, type ResetTx } from "./factory-reset.service";

const dialect = new PgDialect();

/** Transação falsa: registra os comandos DDL e pode falhar no n-ésimo DELETE. */
function fakeTx(failOnDelete?: number) {
  const ddl: string[] = [];
  let deletes = 0;
  const tx = {
    execute: async (q: SQL) => {
      ddl.push(dialect.sqlToQuery(q).sql);
      return { rowCount: 0 };
    },
    delete: () => ({
      where: async () => {
        deletes += 1;
        if (failOnDelete !== undefined && deletes === failOnDelete) {
          throw new Error("falha original do DELETE");
        }
        return { rowCount: 1 };
      },
    }),
  };
  return { tx: tx as unknown as ResetTx, ddl };
}

describe("wipeInTransaction", () => {
  it("desliga e religa os gatilhos append-only no caminho de sucesso", async () => {
    const { tx, ddl } = fakeTx();
    const out = await wipeInTransaction(tx, ["tenant-demo"]);
    assert.ok(out.total > 0);
    const disables = ddl.filter((s) => s.includes("DISABLE TRIGGER USER"));
    const enables = ddl.filter((s) => s.includes("ENABLE TRIGGER USER") && !s.includes("DISABLE"));
    assert.equal(disables.length, 5);
    assert.equal(enables.length, 5);
    assert.ok(ddl.lastIndexOf(enables[0]) > ddl.indexOf(disables[0]));
  });

  it("propaga o erro original e não emite ENABLE quando um DELETE falha", async () => {
    const { tx, ddl } = fakeTx(2);
    await assert.rejects(() => wipeInTransaction(tx, ["tenant-demo"]), /falha original do DELETE/);
    assert.equal(ddl.filter((s) => s.includes("ENABLE TRIGGER USER") && !s.includes("DISABLE")).length, 0);
  });
});

describe("wipeCondition", () => {
  const render = (t: Parameters<typeof wipeCondition>[0]) => dialect.sqlToQuery(wipeCondition(t, ["tenant-demo"]));

  it("inclui linhas de outro tenant que apontam para casos e alunos do demo, sem tocar Tarumã", () => {
    const { sql } = render(consentAcceptances);
    assert.match(sql, /"tenant_id" in/);
    assert.match(sql, /"case_id" in \(select/);
    assert.match(sql, /"student_id" in \(select/);
    assert.match(sql, /"tenant_id" <> \$\d+::uuid/);
    assert.ok(render(consentAcceptances).params.includes("a6232550-b4f2-4a2f-9fbc-6f8eeb482d0b"));
  });

  it("cases e students são apagados só por tenant", () => {
    for (const t of [cases, students]) {
      const { sql } = render(t);
      assert.doesNotMatch(sql, /select/);
      assert.doesNotMatch(sql, /<>/);
    }
  });
});
