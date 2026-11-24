import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { PERMISSIONS } from "../../src/server/access-control/permissions";
import {
  API_TOKEN_PERMISSION_KEYS,
  isApiTokenPermissionKey,
  resolveApiTokenPermissions
} from "../../src/server/api-tokens/apiTokenPermissions";
import {
  generateApiTokenValue,
  hashApiTokenValue,
  isWellFormedApiToken
} from "../../src/server/api-tokens/apiTokenValue";

describe("API token permission sets", () => {
  test("admin is never a token permission", () => {
    assert.equal(isApiTokenPermissionKey("admin"), false);
    assert.equal((API_TOKEN_PERMISSION_KEYS as readonly string[]).includes("admin"), false);
    assert.equal(API_TOKEN_PERMISSION_KEYS.length, PERMISSIONS.length - 1);
  });

  test("read-only holds every read key and nothing else", () => {
    const keys = resolveApiTokenPermissions("read-only", ["parts:write"]);

    assert.ok(keys.length > 0);
    assert.ok(keys.every((key) => key.endsWith(":read")));
    assert.deepEqual(
      keys,
      PERMISSIONS.filter((key) => key.endsWith(":read"))
    );
  });

  test("read-write holds every key but admin", () => {
    assert.deepEqual(resolveApiTokenPermissions("read-write", []), [...API_TOKEN_PERMISSION_KEYS]);
  });

  test("custom holds exactly its known keys", () => {
    assert.deepEqual(
      resolveApiTokenPermissions("custom", ["units:read", "admin", "no-such:key", "parts:write"]),
      ["units:read", "parts:write"]
    );
  });

  test("an unknown access level holds nothing", () => {
    assert.deepEqual(resolveApiTokenPermissions("everything", ["parts:read"]), []);
  });
});

describe("API token values", () => {
  test("a generated value is well formed and unique", () => {
    const first = generateApiTokenValue();
    const second = generateApiTokenValue();

    assert.match(first, /^oso_[A-Za-z0-9_-]{43}$/);
    assert.equal(isWellFormedApiToken(first), true);
    assert.notEqual(first, second);
  });

  test("malformed values are rejected", () => {
    for (const value of ["", "oso_", "oso_short", "xyz_" + "a".repeat(43), "oso_" + "a".repeat(44), "oso_" + "a".repeat(42) + "!"]) {
      assert.equal(isWellFormedApiToken(value), false, value);
    }
  });

  test("the hash is SHA-256 hex and not the value", () => {
    const value = generateApiTokenValue();
    const hash = hashApiTokenValue(value);

    assert.match(hash, /^[0-9a-f]{64}$/);
    assert.equal(hash, hashApiTokenValue(value));
    assert.ok(!hash.includes(value.slice(4)));
  });
});
