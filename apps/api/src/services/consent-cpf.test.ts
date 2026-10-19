import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { consentAcceptSchema, cpfFieldError } from "@periscopio/shared";

describe("TCLE: CPF com máscara e validação", () => {
  test("CPF válido (dígitos ou com máscara) vira 000.000.000-00", () => {
    const r = consentAcceptSchema.safeParse({ signerName: "Maria de Souza", signerRole: "mae", signerDocument: "52998224725" });
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.signerDocument, "529.982.247-25");
    assert.equal(cpfFieldError("529.982.247-25"), null);
  });

  test("CPF com dígito verificador errado, repetido ou incompleto é recusado", () => {
    assert.match(cpfFieldError("529.982.247-24") ?? "", /CPF inválido/);
    assert.match(cpfFieldError("111.111.111-11") ?? "", /CPF inválido/);
    assert.match(cpfFieldError("123.456") ?? "", /CPF inválido/);
  });

  test("CPF em branco é aceito (opcional)", () => {
    assert.equal(cpfFieldError(""), null);
    const r = consentAcceptSchema.safeParse({ signerName: "Maria de Souza", signerRole: "pai" });
    assert.equal(r.success, true);
  });

  test("exige nome completo e parentesco da lista", () => {
    assert.equal(consentAcceptSchema.safeParse({ signerName: "Ana", signerRole: "mae" }).success, false);
    assert.equal(consentAcceptSchema.safeParse({ signerName: "Maria de Souza", signerRole: "tio" }).success, false);
  });
});
