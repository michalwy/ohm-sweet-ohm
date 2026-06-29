import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { parseDesignatorRange } from "../../src/lib/designators";

describe("designator range parsing", () => {
  test("expands an inclusive range and derives quantity", () => {
    assert.deepEqual(parseDesignatorRange("R5-R10"), {
      designators: ["R5", "R6", "R7", "R8", "R9", "R10"],
      quantity: 6
    });
  });

  test("combines single designators and ranges in order", () => {
    assert.deepEqual(parseDesignatorRange("R1, R3, R5-R7"), {
      designators: ["R1", "R3", "R5", "R6", "R7"],
      quantity: 5
    });
  });

  test("allows mixed prefixes across tokens", () => {
    assert.deepEqual(parseDesignatorRange("R1, C2"), {
      designators: ["R1", "C2"],
      quantity: 2
    });
  });

  test("tolerates surrounding whitespace and empty tokens", () => {
    assert.deepEqual(parseDesignatorRange("  R1 , , C2  ,"), {
      designators: ["R1", "C2"],
      quantity: 2
    });
  });

  test("returns an empty list for blank input", () => {
    assert.deepEqual(parseDesignatorRange("   "), {
      designators: [],
      quantity: 0
    });
  });

  test("rejects a duplicate single designator", () => {
    assert.throws(() => parseDesignatorRange("R1, R1"), /duplicate-designator/);
  });

  test("rejects a designator that overlaps a range", () => {
    assert.throws(() => parseDesignatorRange("R1, R1-R3"), /duplicate-designator/);
  });

  test("rejects a reversed range", () => {
    assert.throws(() => parseDesignatorRange("R10-R5"), /invalid-range/);
  });

  test("rejects a range with mismatched prefixes", () => {
    assert.throws(() => parseDesignatorRange("R5-C10"), /invalid-range/);
  });

  test("rejects malformed tokens", () => {
    assert.throws(() => parseDesignatorRange("R"), /invalid-designator/);
    assert.throws(() => parseDesignatorRange("123"), /invalid-designator/);
  });
});
