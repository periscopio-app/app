import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../app";

test("RNDS Route: GET /api/rnds/status retorna protocolo FHIR R4 e status ready", async () => {
  const app = await buildApp({ logger: false });
  const response = await app.inject({
    method: "GET",
    url: "/api/rnds/status",
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.status, "ready");
  assert.ok(body.protocol.includes("HL7 FHIR R4"));
  assert.ok(body.activeCbos["225125"]); // Médico clínico
  assert.ok(body.activeCbos["251510"]); // Psicólogo clínico
});

test("RNDS Route: POST /api/rnds/rel/bundle gera Bundle FHIR REL válido com encaminhamento", async () => {
  const app = await buildApp({ logger: false });
  const payload = {
    caseId: "caso-taruma-001",
    patient: {
      nome: "Aluno Demonstrativo",
      cns: "700000000000001",
      dataNascimento: "2016-04-12",
      sexo: "M" as const,
      municipioIbge: "3553957",
    },
    practitioner: {
      nome: "Dra. Maria Helena",
      cns: "898000000000002",
      cbo: "225125",
      conselho: {
        tipo: "CRM" as const,
        numero: "123456",
        uf: "SP",
      },
    },
    organization: {
      nome: "EMEF Gilberto Lex - Tarumã",
      cnes: "1234567",
      municipioIbge: "3553957",
    },
    encounter: {
      dataInicio: "2026-10-10T09:00:00Z",
      modalidade: "escolar" as const,
      motivoConsulta: "Dificuldade acentuada de aprendizagem e desatenção",
    },
    clinicalFindings: {
      cid10: "F90.0",
      descricaoQueixa: "Queixa de desatenção e hiperatividade em ambiente de sala de aula",
      hipoteseDiagnostica: "Transtorno do Déficit de Atenção e Hiperatividade",
    },
    referral: {
      destinoTipo: "CAPS_IJ" as const,
      prioridade: "prioritario" as const,
      justificativaClinica: "Necessidade de avaliação psiquiátrica infantil e suporte psicossocial",
      prazoAcolhimentoDias: 90,
    },
  };

  const response = await app.inject({
    method: "POST",
    url: "/api/rnds/rel/bundle",
    payload,
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.success, true);
  assert.equal(body.bundle.resourceType, "Bundle");
  assert.equal(body.bundle.type, "document");

  const resources = body.bundle.entry.map((e: any) => e.resource.resourceType);
  assert.ok(resources.includes("Composition"));
  assert.ok(resources.includes("Patient"));
  assert.ok(resources.includes("Practitioner"));
  assert.ok(resources.includes("Organization"));
  assert.ok(resources.includes("Encounter"));
  assert.ok(resources.includes("Condition"));
  assert.ok(resources.includes("ServiceRequest"));
});
