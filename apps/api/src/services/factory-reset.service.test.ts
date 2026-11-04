import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { wipeInTransaction, type ResetTx } from "./factory-reset.service";

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
