import test from "node:test";
import assert from "node:assert/strict";
import { ACCESS_LINK_TTL_MS, createAccessToken, verifyAccessToken } from "./access-link";

test("token válido devolve e-mail em minúsculas e a impressão digital", () => {
  const token = createAccessToken("  Ana@Escola.TEST ", "abc123");
  assert.deepEqual(verifyAccessToken(token), { email: "ana@escola.test", fingerprint: "abc123" });
});

test("token expirado é recusado", () => {
  const now = Date.now();
  const token = createAccessToken("ana@escola.test", "abc", now);
  assert.ok(verifyAccessToken(token, now + ACCESS_LINK_TTL_MS - 1));
  assert.equal(verifyAccessToken(token, now + ACCESS_LINK_TTL_MS + 1), null);
});

test("token adulterado ou malformado é recusado", () => {
  const token = createAccessToken("ana@escola.test", "abc");
  const [body, sig] = token.split(".");
  const forged = Buffer.from(
    JSON.stringify({ e: "outra@pessoa.test", f: "abc", x: Date.now() + 1000 }),
  ).toString("base64url");
  assert.equal(verifyAccessToken(`${forged}.${sig}`), null);
  assert.equal(verifyAccessToken(`${body}.x${sig}`), null);
  assert.equal(verifyAccessToken("lixo"), null);
  assert.equal(verifyAccessToken(`${token}.extra`), null);
});

test("segredo diferente invalida o token", () => {
  const previous = process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_SECRET = "segredo-a";
  const token = createAccessToken("ana@escola.test", "abc");
  process.env.BETTER_AUTH_SECRET = "segredo-b";
  assert.equal(verifyAccessToken(token), null);
  if (previous === undefined) delete process.env.BETTER_AUTH_SECRET;
  else process.env.BETTER_AUTH_SECRET = previous;
});
