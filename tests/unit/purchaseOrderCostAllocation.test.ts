import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { computeAllocatedUnitCosts } from "../../src/lib/purchaseOrderCostAllocation";

describe("computeAllocatedUnitCosts", () => {
  test("splits proportionally by lineNetValue and divides by ordered quantity", () => {
    const result = computeAllocatedUnitCosts(
      [
        { itemId: "a", lineNetValue: 30, quantity: 3, eligible: true },
        { itemId: "b", lineNetValue: 70, quantity: 7, eligible: true }
      ],
      12
    );

    assert.equal(result.get("a"), (12 * (30 / 100)) / 3);
    assert.equal(result.get("b"), (12 * (70 / 100)) / 7);
  });

  test("is stable regardless of how many units are received (uses ordered quantity)", () => {
    const items = [
      { itemId: "a", lineNetValue: 30, quantity: 3, eligible: true },
      { itemId: "b", lineNetValue: 70, quantity: 7, eligible: true }
    ];

    const firstReceive = computeAllocatedUnitCosts(items, 12);
    const secondReceive = computeAllocatedUnitCosts(items, 12);

    assert.equal(firstReceive.get("a"), secondReceive.get("a"));
    assert.equal(firstReceive.get("b"), secondReceive.get("b"));
  });

  test("excludes ineligible items (currency mismatch) from the allocation base and gives them zero", () => {
    const result = computeAllocatedUnitCosts(
      [
        { itemId: "a", lineNetValue: 30, quantity: 3, eligible: true },
        { itemId: "b", lineNetValue: 70, quantity: 7, eligible: false }
      ],
      12
    );

    assert.equal(result.get("a"), 12 / 3);
    assert.equal(result.get("b"), 0);
  });

  test("returns zero for every item when there are no additional costs", () => {
    const result = computeAllocatedUnitCosts(
      [{ itemId: "a", lineNetValue: 30, quantity: 3, eligible: true }],
      0
    );

    assert.equal(result.get("a"), 0);
  });

  test("returns zero when the eligible line net sum is zero", () => {
    const result = computeAllocatedUnitCosts(
      [{ itemId: "a", lineNetValue: 0, quantity: 3, eligible: true }],
      12
    );

    assert.equal(result.get("a"), 0);
  });
});
