import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { formatBytes } from "../../src/lib/formatBytes";
import * as adminOperations from "../../src/server/admin/adminOperations";
import { getOperationJsonSchemas } from "../../src/server/api/operations";
import { isInstanceAdministrator, isSolelyOwnedWorkspace } from "../../src/server/admin/instanceAdminPolicy";

describe("instance administrator rule (#324)", () => {
  const oldest = { id: "first", isInstanceAdmin: false };

  test("without any flagged account, the oldest account is the administrator", () => {
    assert.equal(isInstanceAdministrator({ userId: "first", flagged: [], oldest }), true);
    assert.equal(isInstanceAdministrator({ userId: "second", flagged: [], oldest }), false);
  });

  test("once an account is flagged, only flagged accounts are administrators", () => {
    const flagged = [{ id: "second", isInstanceAdmin: true }];

    assert.equal(isInstanceAdministrator({ userId: "second", flagged, oldest }), true);
    assert.equal(isInstanceAdministrator({ userId: "first", flagged, oldest }), false);
  });

  test("an empty instance has no administrator", () => {
    assert.equal(isInstanceAdministrator({ userId: "anyone", flagged: [], oldest: null }), false);
  });

  test("a workspace is solely owned when the user owns it and nobody else does", () => {
    assert.equal(isSolelyOwnedWorkspace({ userIsOwner: true, otherOwnerCount: 0 }), true);
    assert.equal(isSolelyOwnedWorkspace({ userIsOwner: true, otherOwnerCount: 1 }), false);
    assert.equal(isSolelyOwnedWorkspace({ userIsOwner: false, otherOwnerCount: 0 }), false);
  });
});

describe("admin operations (#324)", () => {
  const operations = Object.values(adminOperations).filter(
    (value): value is typeof adminOperations.adminListUsersOperation =>
      typeof value === "object" && value !== null && "name" in value && "permission" in value
  );

  test("every admin operation is named admin_… and has JSON Schemas", () => {
    assert.equal(operations.length, 7);

    for (const operation of operations) {
      assert.match(operation.name, /^admin_[a-z_]+$/);
      const schemas = getOperationJsonSchemas(operation);
      assert.equal(schemas.input.type, "object");
      assert.equal(schemas.output.type, "object");
    }
  });
});

describe("formatBytes", () => {
  test("formats in powers of 1000", () => {
    assert.equal(formatBytes(0), "0 B");
    assert.equal(formatBytes(812), "812 B");
    assert.equal(formatBytes(14_200), "14.2 kB");
    assert.equal(formatBytes(3_100_000), "3.1 MB");
  });
});
