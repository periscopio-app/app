import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../app";

test("Rede Intersetorial: GET /api/intersectoral/monitoring/sla-90d calcula conformidade do prazo legal", async () => {
  const app = await buildApp({ logger: false });
  const response = await app.inject({
    method: "GET",
    url: "/api/intersectoral/monitoring/sla-90d",
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.ok(typeof body.taxaConformidadeLei90d === "number");
  assert.ok(body.distribuicaoPorRede.CAPS_IJ >= 1);
  assert.ok(body.distribuicaoPorRede.CRAS >= 1);
  assert.ok(body.distribuicaoPorRede.UBS >= 1);
  assert.ok(body.alertaPrazos90d);
});

test("Rede Intersetorial: POST /api/intersectoral/referrals cria encaminhamento para CRAS/CAPS/UBS", async () => {
  const app = await buildApp({ logger: false });
  const response = await app.inject({
    method: "POST",
    url: "/api/intersectoral/referrals",
    payload: {
      caseId: "caso-novo-099",
      studentCode: "TAR-2026-0099",
      schoolName: "EMEF Gilberto Lex",
      destination: "CAPS_AJ",
      destinationName: "CAPS Álcool e Drogas Regional",
      reason: "Suporte e acolhimento para vulnerabilidade psicossocial",
      specialtyRequired: "Apoio Especializado",
      priority: "urgente",
      requestedBy: "Psicólogo Periscópio",
    },
  });

  assert.equal(response.statusCode, 201);
  const body = JSON.parse(response.body);
  assert.equal(body.studentCode, "TAR-2026-0099");
  assert.equal(body.destination, "CAPS_AJ");
  assert.equal(body.status, "solicitado");
  assert.equal(body.slaDeadlineDays, 90);
  assert.equal(body.slaStatus, "no_prazo");
});

test("Rede Intersetorial: PATCH /api/intersectoral/referrals/:id/status atualiza acolhimento com contrarreferência", async () => {
  const app = await buildApp({ logger: false });
  const response = await app.inject({
    method: "PATCH",
    url: "/api/intersectoral/referrals/ref-taruma-001/status",
    payload: {
      status: "contrarreferencia_concluida",
      feedbackNotes: "Paciente acolhido no CAPS IJ com início de plano terapêutico singular (PTS).",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.id, "ref-taruma-001");
  assert.equal(body.status, "contrarreferencia_concluida");
  assert.ok(body.feedbackNotes.includes("plano terapêutico singular"));
});
