import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { networkErrorCode } from "./network-error";

describe("networkErrorCode", () => {
  const fetchFailed = Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });

  it("acha o código em cause e em originalError", () => {
    assert.equal(networkErrorCode(fetchFailed), "ENOTFOUND");
    assert.equal(networkErrorCode({ message: "fetch failed", originalError: fetchFailed }), "ENOTFOUND");
  });

  it("reconhece AbortError como tempo esgotado", () => {
    assert.equal(networkErrorCode(Object.assign(new Error("x"), { name: "AbortError" })), "ABORT_ERR");
  });

  it("devolve null para erro que não é de rede", () => {
    assert.equal(networkErrorCode(new Error("Invalid JWT")), null);
    assert.equal(networkErrorCode(null), null);
  });
});
