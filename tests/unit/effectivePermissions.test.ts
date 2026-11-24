import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  getEffectivePermissions,
  permissionSetGrants
} from "../../src/server/access-control/effectivePermissions";
import { PERMISSIONS } from "../../src/server/access-control/permissions";

describe("effective permissions", () => {
  test("a session gets exactly its roles' permissions", () => {
    const effective = getEffectivePermissions({
      rolePermissions: ["parts:read", "units:read"],
      tokenPermissions: null
    });

    assert.deepEqual([...effective].sort(), ["parts:read", "units:read"]);
  });

  test("admin in a role is a wildcard", () => {
    const effective = getEffectivePermissions({ rolePermissions: ["admin"], tokenPermissions: null });

    for (const permission of PERMISSIONS) {
      assert.equal(permissionSetGrants(effective, permission), true, permission);
    }
  });

  test("a token is intersected with the user's roles", () => {
    const effective = getEffectivePermissions({
      rolePermissions: ["parts:read", "parts:write", "units:read"],
      tokenPermissions: ["parts:read", "builds:read"]
    });

    assert.deepEqual([...effective], ["parts:read"]);
  });

  test("a token never grants more than its user holds", () => {
    const effective = getEffectivePermissions({
      rolePermissions: ["parts:read"],
      tokenPermissions: ["admin"]
    });

    assert.deepEqual([...effective], ["parts:read"]);
    assert.equal(permissionSetGrants(effective, "admin"), false);
    assert.equal(permissionSetGrants(effective, "parts:write"), false);
  });

  test("an admin user's token keeps only the token's set", () => {
    const effective = getEffectivePermissions({
      rolePermissions: ["admin"],
      tokenPermissions: ["parts:read", "parts:write"]
    });

    assert.deepEqual([...effective], ["parts:read", "parts:write"]);
    assert.equal(permissionSetGrants(effective, "admin"), false);
  });

  test("admin survives only when both the token and the roles hold it", () => {
    const effective = getEffectivePermissions({
      rolePermissions: ["admin"],
      tokenPermissions: ["admin"]
    });

    assert.equal(permissionSetGrants(effective, "admin"), true);
    assert.equal(permissionSetGrants(effective, "builds:write"), true);
  });

  test("an empty token grants nothing", () => {
    const effective = getEffectivePermissions({ rolePermissions: ["admin"], tokenPermissions: [] });

    assert.equal(effective.size, 0);
  });
});
