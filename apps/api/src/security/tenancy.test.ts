import assert from "node:assert/strict";
import test from "node:test";
import type { Actor } from "./actor";
import { canAccessSchool, canAccessTenant } from "./tenancy";

const schoolActor: Actor = {
  id: "user-1",
  email: "ppi@escola.test",
  tenantId: "tenant-1",
  schoolId: "school-1",
  role: "ppi",
};

test("bloqueia outro município", () => {
  assert.equal(canAccessTenant(schoolActor, "tenant-2"), false);
});

test("bloqueia outra escola para um perfil escolar", () => {
  assert.equal(canAccessSchool(schoolActor, "tenant-1", "school-2"), false);
});

test("permite a escola vinculada ao ator", () => {
  assert.equal(canAccessSchool(schoolActor, "tenant-1", "school-1"), true);
});
