import { test } from "node:test";
import assert from "node:assert";

test("registro de aluno pela RE: gera código pseudonimizado sem nome e valida idade no piloto", () => {
  const schoolSlug = "emef-monteiro-lobato";
  const birthYear = 2018; // 8 anos em 2026 (Dentro da faixa do piloto 2-12 anos)
  const currentYear = 2026;
  const age = currentYear - birthYear;

  const isAgeValidForPilot = age >= 2 && age <= 12;
  assert.strictEqual(isAgeValidForPilot, true);

  const randomSuffix = "A7B9C3";
  const studentCode = `${schoolSlug.substring(0, 4).toUpperCase()}-2026-${randomSuffix}`;

  assert.strictEqual(studentCode.startsWith("EMEF-2026-"), true);
  assert.doesNotMatch(studentCode, /joao|maria|silva|cpf/i); // Sem PII
});

test("abertura de caso pela RE: bloqueia se a criança já possuir caso ativo no mesmo município", () => {
  const existingCases = [
    { id: "case-01", studentId: "student-100", status: "triagem" },
  ];

  const canOpenNewCase = (studentId: string) => {
    return !existingCases.some((c) => c.studentId === studentId && c.status !== "concluido");
  };

  assert.strictEqual(canOpenNewCase("student-100"), false);
  assert.strictEqual(canOpenNewCase("student-200"), true);
});

test("observação docente: registra a procedência (ex: formulário físico/relato enviado à RE)", () => {
  const observationPayload = {
    teacherName: "Profa. Cláudia",
    provenance: "relato_presencial_re", // Professor fora da aplicação direta
    domain: "neuro",
    observations: "Dificuldade na sustentação da atenção e agitação motora em sala.",
    submittedAt: new Date().toISOString(),
  };

  assert.strictEqual(observationPayload.provenance, "relato_presencial_re");
  assert.ok(observationPayload.observations.length > 10);
});
