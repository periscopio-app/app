import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { errorCauseChain } from "./error-cause";

describe("errorCauseChain", () => {
  it("expõe o erro do Postgres escondido em cause, sem parâmetros nem stack", () => {
    const pg = Object.assign(new Error("current transaction is aborted, commands ignored until end of transaction block"), {
      code: "25P02",
      routine: "exec_simple_query",
      params: ["segredo"],
      stack: "pilha",
    });
    const err = Object.assign(new Error("Failed query: ALTER TABLE case_timeline ENABLE TRIGGER USER\nparams: "), { cause: pg });
    const chain = errorCauseChain(err);
    assert.equal(chain.length, 1);
    assert.equal(chain[0].code, "25P02");
    assert.match(chain[0].message, /aborted/);
    assert.ok(!JSON.stringify(chain).includes("segredo"));
    assert.ok(!JSON.stringify(chain).includes("pilha"));
  });

  it("segue a cadeia até 3 níveis e ignora erro sem cause", () => {
    const c3 = { message: "c3" };
    const c2 = { message: "c2", cause: c3 };
    const c1 = { message: "c1", cause: c2 };
    assert.deepEqual(errorCauseChain({ cause: c1 }).map((c) => c.message), ["c1", "c2", "c3"]);
    assert.deepEqual(errorCauseChain(new Error("sem causa")), []);
    assert.deepEqual(errorCauseChain(null), []);
  });
});
