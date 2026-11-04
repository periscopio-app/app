import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertAuthSecret, DEV_AUTH_SECRET } from "./secret";

const longSecret = "x".repeat(32);

describe("assertAuthSecret", () => {
  it("falha em produção sem segredo", () => {
    assert.throws(() => assertAuthSecret({ NODE_ENV: "production" }), /obrigatória/);
  });

  it("falha quando NODE_ENV não está definido e não há segredo", () => {
    assert.throws(() => assertAuthSecret({}), /obrigatória/);
  });

  it("falha em produção com o valor de desenvolvimento", () => {
    assert.throws(
      () => assertAuthSecret({ NODE_ENV: "production", BETTER_AUTH_SECRET: DEV_AUTH_SECRET }),
      /valor de desenvolvimento/,
    );
  });

  it("falha em produção com segredo curto", () => {
    assert.throws(
      () => assertAuthSecret({ NODE_ENV: "production", BETTER_AUTH_SECRET: "curto" }),
      /ao menos 32/,
    );
  });

  it("aceita segredo longo em produção, inclusive via AUTH_SECRET", () => {
    assert.equal(assertAuthSecret({ NODE_ENV: "production", BETTER_AUTH_SECRET: longSecret }), longSecret);
    assert.equal(assertAuthSecret({ NODE_ENV: "production", AUTH_SECRET: longSecret }), longSecret);
  });

  it("usa o valor de desenvolvimento só em development e test", () => {
    assert.equal(assertAuthSecret({ NODE_ENV: "development" }), DEV_AUTH_SECRET);
    assert.equal(assertAuthSecret({ NODE_ENV: "test" }), DEV_AUTH_SECRET);
  });
});
