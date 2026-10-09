import test from "node:test";
import assert from "node:assert/strict";
import { filterPeerSections, medicalFinalSummary } from "./specialist-view.service";

const base = { summary: { t: "x" }, completedAt: new Date(), assignedProfessionalId: "outro" };

test("só seções concluídas de outros especialistas, sem serviço social", () => {
  const out = filterPeerSections(
    [
      { id: "1", specialty: "fonoaudiologia", status: "concluido", ...base },
      { id: "2", specialty: "psicologia", status: "em_andamento", ...base },
      { id: "3", specialty: "servico_social", status: "concluido", ...base },
      { id: "4", specialty: "neuropsicologia", status: "concluido", ...base, assignedProfessionalId: "eu" },
    ],
    "eu"
  );
  assert.deepEqual(out.map((s) => s.specialty), ["fonoaudiologia"]);
  assert.ok(!("assignedProfessionalId" in out[0]!));
});

test("resumo final do médico ignora payload inválido", () => {
  assert.equal(medicalFinalSummary(null), null);
  assert.deepEqual(medicalFinalSummary({ decision: "alta", reason: "r", actorRole: "md1" }), { decision: "alta", followUp: undefined, reason: "r" });
});
