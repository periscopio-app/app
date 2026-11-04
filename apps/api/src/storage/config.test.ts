import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeNetworkError, isNetworkFailure, networkErrorCode, resolveSupabaseUrl } from "./config";

describe("resolveSupabaseUrl", () => {
  it("devolve null sem configuração", () => {
    assert.equal(resolveSupabaseUrl({}), null);
  });

  it("monta a URL a partir do project ref", () => {
    assert.equal(resolveSupabaseUrl({ SUPABASE_PROJECT_REF: "abc123" }), "https://abc123.supabase.co");
  });

  it("remove barra final e sufixos copiados do painel", () => {
    assert.equal(resolveSupabaseUrl({ SUPABASE_URL: " https://abc.supabase.co/ " }), "https://abc.supabase.co");
    assert.equal(resolveSupabaseUrl({ SUPABASE_URL: "https://abc.supabase.co/rest/v1/" }), "https://abc.supabase.co");
  });

  it("recusa valor que não é endereço http(s)", () => {
    assert.throws(() => resolveSupabaseUrl({ SUPABASE_URL: "abc.supabase.co" }), /não é um endereço válido|https/);
    assert.throws(() => resolveSupabaseUrl({ SUPABASE_URL: "ftp://abc.supabase.co" }), /https/);
  });
});

describe("erros de rede", () => {
  const fetchFailed = Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });

  it("acha o código em cause e em originalError", () => {
    assert.equal(networkErrorCode(fetchFailed), "ENOTFOUND");
    assert.equal(networkErrorCode({ message: "fetch failed", originalError: fetchFailed }), "ENOTFOUND");
  });

  it("trata 'fetch failed' sem código como falha de rede", () => {
    assert.equal(isNetworkFailure(new Error("fetch failed")), true);
    assert.equal(isNetworkFailure(new Error("Invalid JWT")), false);
  });

  it("descreve a causa sem expor endereço nem chave", () => {
    const msg = describeNetworkError(fetchFailed);
    assert.match(msg, /DNS/);
    assert.match(msg, /ENOTFOUND/);
    assert.match(msg, /SUPABASE_URL/);
  });
});
