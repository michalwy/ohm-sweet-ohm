import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { mergeShoppingListRows } from "../../src/lib/shoppingListRowMerge";

describe("shopping list row merge", () => {
  test("sums quantities for rows resolving to the same partId", () => {
    assert.deepEqual(
      mergeShoppingListRows([
        { partId: "p1", quantity: "2" },
        { partId: "p1", quantity: "3.5" }
      ]),
      [{ partId: "p1", quantity: "5.5" }]
    );
  });

  test("drops zero, negative, and blank quantity rows", () => {
    assert.deepEqual(
      mergeShoppingListRows([
        { partId: "p1", quantity: "0" },
        { partId: "p2", quantity: "-1" },
        { partId: "p3", quantity: "" },
        { partId: "p4", quantity: "abc" },
        { partId: "p5", quantity: "2" }
      ]),
      [{ partId: "p5", quantity: "2" }]
    );
  });

  test("passes independent partIds through unchanged, preserving first-seen order", () => {
    assert.deepEqual(
      mergeShoppingListRows([
        { partId: "p2", quantity: "1" },
        { partId: "p1", quantity: "4" }
      ]),
      [
        { partId: "p2", quantity: "1" },
        { partId: "p1", quantity: "4" }
      ]
    );
  });
});
