import assert from "node:assert/strict";
import test from "node:test";
import { hasRole, type Role } from "./roles";

const role: Role = "ppi";

test("permite um papel explicitamente autorizado", () => {
  assert.equal(hasRole(role, ["ppi", "school_manager"]), true);
});

test("nega um papel fora da lista autorizada", () => {
  assert.equal(hasRole(role, ["md1", "specialist"]), false);
});
