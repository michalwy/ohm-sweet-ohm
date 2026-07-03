import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  distributeAllocations,
  suggestAllocation,
  sumEntries,
  validateAllocation,
  type AllocationEntry
} from "../../src/lib/buildAllocation";

describe("build split allocation", () => {
  describe("validateAllocation", () => {
    test("passes when the entries total matches the requirement", () => {
      const entries: AllocationEntry[] = [
        { partId: "a", sourceLocationId: "l1", quantity: 20 },
        { partId: "b", sourceLocationId: "l2", quantity: 30 }
      ];
      assert.doesNotThrow(() => validateAllocation(entries, tenDesignators(), 5));
      assert.equal(sumEntries(entries), 50);
    });

    test("throws allocation-total-mismatch when the total is off", () => {
      const entries: AllocationEntry[] = [{ partId: "a", sourceLocationId: null, quantity: 9 }];
      assert.throws(
        () => validateAllocation(entries, ["R1", "R2"], 5),
        /allocation-total-mismatch/
      );
    });

    test("throws invalid-allocation-quantity for a non-positive entry", () => {
      const entries: AllocationEntry[] = [
        { partId: "a", sourceLocationId: null, quantity: 0 },
        { partId: "b", sourceLocationId: null, quantity: 10 }
      ];
      assert.throws(
        () => validateAllocation(entries, ["R1"], 10),
        /invalid-allocation-quantity/
      );
    });
  });

  describe("distributeAllocations", () => {
    test("splits whole designators when the split aligns to target quantity", () => {
      // 10 designators × build qty 1 = 10 units; 4 Yageo + 6 Royal Ohm.
      const rows = distributeAllocations(tenDesignators(), 1, [
        { partId: "yageo", sourceLocationId: "l1", quantity: 4 },
        { partId: "royal", sourceLocationId: "l2", quantity: 6 }
      ]);
      assert.equal(rows.length, 10);
      assert.deepEqual(
        rows.map((r) => r.partId),
        ["yageo", "yageo", "yageo", "yageo", "royal", "royal", "royal", "royal", "royal", "royal"]
      );
      assert.ok(rows.every((r) => r.quantity === 1));
    });

    test("splits a single designator across parts when target quantity > 1", () => {
      // 2 designators × build qty 5 = 10 units; 7 A + 3 B -> R2 is mixed.
      const rows = distributeAllocations(["R1", "R2"], 5, [
        { partId: "A", sourceLocationId: "la", quantity: 7 },
        { partId: "B", sourceLocationId: "lb", quantity: 3 }
      ]);
      assert.deepEqual(rows, [
        { designator: "R1", partId: "A", sourceLocationId: "la", quantity: 5 },
        { designator: "R2", partId: "A", sourceLocationId: "la", quantity: 2 },
        { designator: "R2", partId: "B", sourceLocationId: "lb", quantity: 3 }
      ]);
    });

    test("produces one row per designator for a single-part line", () => {
      const rows = distributeAllocations(["R1", "R2", "R3"], 2, [
        { partId: "only", sourceLocationId: "l", quantity: 6 }
      ]);
      assert.equal(rows.length, 3);
      assert.ok(rows.every((r) => r.partId === "only" && r.quantity === 2));
    });

    test("rejects a mismatched total before distributing", () => {
      assert.throws(
        () =>
          distributeAllocations(["R1", "R2"], 1, [
            { partId: "a", sourceLocationId: null, quantity: 1 }
          ]),
        /allocation-total-mismatch/
      );
    });
  });

  describe("suggestAllocation", () => {
    test("greedily covers the requirement from best-first candidates", () => {
      const entries = suggestAllocation(50, [
        { partId: "a", sourceLocationId: "l1", available: 20 },
        { partId: "b", sourceLocationId: "l2", available: 40 }
      ]);
      assert.deepEqual(entries, [
        { partId: "a", sourceLocationId: "l1", quantity: 20 },
        { partId: "b", sourceLocationId: "l2", quantity: 30 }
      ]);
    });

    test("stops exactly on the boundary without a trailing zero entry", () => {
      const entries = suggestAllocation(20, [
        { partId: "a", sourceLocationId: "l1", available: 20 },
        { partId: "b", sourceLocationId: "l2", available: 40 }
      ]);
      assert.deepEqual(entries, [{ partId: "a", sourceLocationId: "l1", quantity: 20 }]);
    });

    test("returns a partial split when stock is short and skips empty candidates", () => {
      const entries = suggestAllocation(50, [
        { partId: "a", sourceLocationId: "l1", available: 0 },
        { partId: "b", sourceLocationId: "l2", available: 30 }
      ]);
      assert.deepEqual(entries, [{ partId: "b", sourceLocationId: "l2", quantity: 30 }]);
      assert.equal(sumEntries(entries), 30);
    });

    test("returns nothing when there is no requirement", () => {
      assert.deepEqual(
        suggestAllocation(0, [{ partId: "a", sourceLocationId: null, available: 5 }]),
        []
      );
    });
  });
});

function tenDesignators(): string[] {
  return ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10"];
}
