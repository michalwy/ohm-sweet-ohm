import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  aggregateRequirementsByPart,
  isAllocationEditable,
  isCancellable,
  isTerminal,
  requiredForLine
} from "../../src/server/builds/buildTransitions";

describe("build transition helpers", () => {
  test("requiredForLine multiplies designator count by target quantity", () => {
    assert.equal(requiredForLine(3, 2), 6);
    assert.equal(requiredForLine(10, 1), 10);
    assert.equal(requiredForLine(0, 5), 0);
  });

  test("aggregateRequirementsByPart sums per part and ignores unallocated lines", () => {
    const result = aggregateRequirementsByPart([
      { partId: "p1", required: 4 },
      { partId: "p2", required: 2 },
      { partId: "p1", required: 6 },
      { partId: null, required: 99 }
    ]);
    assert.equal(result.get("p1"), 10);
    assert.equal(result.get("p2"), 2);
    assert.equal(result.has("null"), false);
    assert.equal([...result.keys()].length, 2);
  });

  test("isAllocationEditable only in created/allocated", () => {
    assert.equal(isAllocationEditable("CREATED"), true);
    assert.equal(isAllocationEditable("ALLOCATED"), true);
    assert.equal(isAllocationEditable("STARTED"), false);
    assert.equal(isAllocationEditable("COMPLETED"), false);
  });

  test("isCancellable excludes terminal states", () => {
    assert.equal(isCancellable("CREATED"), true);
    assert.equal(isCancellable("STARTED"), true);
    assert.equal(isCancellable("IN_PROGRESS"), true);
    assert.equal(isCancellable("COMPLETED"), false);
    assert.equal(isCancellable("CANCELLED"), false);
  });

  test("isTerminal marks completed and cancelled", () => {
    assert.equal(isTerminal("COMPLETED"), true);
    assert.equal(isTerminal("CANCELLED"), true);
    assert.equal(isTerminal("STARTED"), false);
  });
});
