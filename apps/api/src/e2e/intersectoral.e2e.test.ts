import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../app";

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL ausente" : false;

describe("Rede Intersetorial (E2E)", { skip }, () => {
  test("recusa requisição anônima sem token (401)", async () => {
    const app = await buildApp({ logger: false });
    const response = await app.inject({
      method: "GET",
      url: "/api/intersectoral/monitoring/sla-90d",
    });
    assert.equal(response.statusCode, 401);
  });

  test("recusa perfil sem permissão na rede intersetorial (403)", async () => {
    const app = await buildApp({ logger: false });
    const response = await app.inject({
      method: "GET",
      url: "/api/intersectoral/monitoring/sla-90d",
      headers: {
        "x-test-email": "pesquisador@demo.periscopio.test",
      },
    });
    assert.equal(response.statusCode, 403);
  });

  test("permite acesso a perfil autorizado (200) e calcula métricas", async () => {
    const app = await buildApp({ logger: false });
    const response = await app.inject({
      method: "GET",
      url: "/api/intersectoral/monitoring/sla-90d",
      headers: {
        "x-test-email": "bruno@oceanoazul.dev.br",
      },
    });
    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.ok(typeof body.taxaConformidadeLei90d === "number");
  });
});
