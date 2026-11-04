import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { metricsEnabled, metricsTokenOk } from "./metrics-auth";

const token = "a".repeat(64);

describe("metricsTokenOk", () => {
  it("aceita o token certo, com ou sem o prefixo Bearer", () => {
    assert.equal(metricsTokenOk(`Bearer ${token}`, token), true);
    assert.equal(metricsTokenOk(`bearer ${token}`, token), true);
  });

  it("tolera espaço e quebra de linha no valor guardado e no enviado", () => {
    assert.equal(metricsTokenOk(`Bearer ${token}`, `${token}\n`), true);
    assert.equal(metricsTokenOk(`Bearer  ${token} `, ` ${token}`), true);
    assert.equal(metricsTokenOk(`Bearer Bearer ${token}`, token), true);
  });

  it("recusa token errado, vazio ou ausente", () => {
    assert.equal(metricsTokenOk(`Bearer ${"b".repeat(64)}`, token), false);
    assert.equal(metricsTokenOk(`Bearer ${token.slice(1)}`, token), false);
    assert.equal(metricsTokenOk("", token), false);
    assert.equal(metricsTokenOk(undefined, token), false);
  });

  it("variável vazia ou só com espaços desliga a rota e nunca autoriza", () => {
    assert.equal(metricsEnabled(undefined), false);
    assert.equal(metricsEnabled("  \n"), false);
    assert.equal(metricsEnabled(token), true);
    assert.equal(metricsTokenOk("Bearer ", ""), false);
    assert.equal(metricsTokenOk("", "   "), false);
  });
});
