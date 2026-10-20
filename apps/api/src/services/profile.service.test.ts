import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mascararCpf, normalizarTelefone, perfilPatchSchema, textoOuNulo } from "./profile.service";

describe("Meu painel: dados editáveis", () => {
  test("só nome, telefone e apresentação são aceitos; qualquer outro campo é recusado", () => {
    assert.equal(perfilPatchSchema.safeParse({ name: "Ana Souza", phone: "(11) 91234-5678", bio: "Psicopedagoga" }).success, true);
    for (const campo of ["email", "role", "cpf", "classCode", "specialty", "schoolId", "tenantId", "accessEnabled", "avatarKey"]) {
      assert.equal(perfilPatchSchema.safeParse({ [campo]: "x" }).success, false, `${campo} não deveria ser editável`);
    }
  });

  test("limites de tamanho", () => {
    assert.equal(perfilPatchSchema.safeParse({ name: "A" }).success, false);
    assert.equal(perfilPatchSchema.safeParse({ name: "x".repeat(121) }).success, false);
    assert.equal(perfilPatchSchema.safeParse({ bio: "x".repeat(281) }).success, false);
    assert.equal(perfilPatchSchema.safeParse({ bio: "x".repeat(280) }).success, true);
  });

  test("telefone: normaliza, aceita +55, recusa inválido e apaga com vazio", () => {
    assert.deepEqual(normalizarTelefone("(11) 91234-5678"), { ok: true, value: "11912345678" });
    assert.deepEqual(normalizarTelefone("+55 11 3123-4567"), { ok: true, value: "1131234567" });
    assert.deepEqual(normalizarTelefone(""), { ok: true, value: null });
    assert.deepEqual(normalizarTelefone(null), { ok: true, value: null });
    assert.equal(normalizarTelefone("12345").ok, false);
    assert.equal(normalizarTelefone("11111111111").ok, false);
  });

  test("CPF aparece mascarado com só os 2 últimos dígitos", () => {
    assert.equal(mascararCpf("123.456.789-09"), "***.***.***-09");
    assert.equal(mascararCpf("12345678909"), "***.***.***-09");
    assert.equal(mascararCpf(null), null);
  });

  test("texto vazio vira null", () => {
    assert.equal(textoOuNulo("   "), null);
    assert.equal(textoOuNulo(" oi "), "oi");
    assert.equal(textoOuNulo(undefined), null);
  });
});
