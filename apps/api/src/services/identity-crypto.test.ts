import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertIdentityVaultKeyConfigured,
  decryptText,
  encryptText,
  IdentityVaultDecryptionError,
} from "./identity-crypto.service";

const KEY_A = "synthetic-test-key-a-with-at-least-32-bytes";
const KEY_B = "synthetic-test-key-b-with-at-least-32-bytes";

function withKey<T>(value: string | undefined, run: () => T): T {
  const previous = process.env.IDENTITY_VAULT_KEY;
  if (value === undefined) delete process.env.IDENTITY_VAULT_KEY;
  else process.env.IDENTITY_VAULT_KEY = value;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.IDENTITY_VAULT_KEY;
    else process.env.IDENTITY_VAULT_KEY = previous;
  }
}

test("chave ausente ou curta falha fechada sem chave padrão", () => {
  withKey(undefined, () => {
    assert.throws(() => encryptText("aluno sintético"), /IDENTITY_VAULT_KEY/);
    assert.throws(() => assertIdentityVaultKeyConfigured(), /IDENTITY_VAULT_KEY/);
  });
  withKey("curta", () => assert.throws(() => encryptText("aluno sintético"), /32 bytes/));
});

test("cifra e decifra apenas com a chave configurada", () => {
  const encrypted = withKey(KEY_A, () => encryptText("Criança Sintética"));
  assert.notEqual(encrypted, "Criança Sintética");
  assert.equal(withKey(KEY_A, () => decryptText(encrypted)), "Criança Sintética");
  withKey(KEY_B, () => assert.throws(() => decryptText(encrypted), IdentityVaultDecryptionError));
  withKey(KEY_A, () => assert.throws(() => decryptText("texto legado inválido"), IdentityVaultDecryptionError));
});
