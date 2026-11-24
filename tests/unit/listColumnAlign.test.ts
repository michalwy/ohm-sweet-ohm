import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  attributeColumnFlags,
  partValueColumnFlags,
  resolveListColumnAlign
} from "../../src/app/list-column-align";

describe("list column alignment (#245)", () => {
  test("the part Value column is a centered measured quantity", () => {
    const flags = partValueColumnFlags();
    assert.equal(flags.measuredQuantity, true);
    assert.equal(resolveListColumnAlign({ id: "value", label: "Value", ...flags }), "center");
  });

  test("a Quantity attribute column is a centered measured quantity", () => {
    const flags = attributeColumnFlags({ type: "QUANTITY" });
    assert.equal(flags.measuredQuantity, true);
    assert.equal(resolveListColumnAlign({ id: "a", label: "R", ...flags }), "center");
  });

  test("other attribute types keep their header alignment and are not measured quantities", () => {
    for (const type of ["TEXT", "NUMBER", "BOOLEAN", "CHOICE"]) {
      const flags = attributeColumnFlags({ type });
      assert.equal(flags.measuredQuantity, undefined);
      assert.equal(flags.align, "center");
    }
  });

  test("a measured quantity is centered whatever align says; others use align, else left", () => {
    assert.equal(
      resolveListColumnAlign({ id: "x", label: "X", align: "right", measuredQuantity: true }),
      "center"
    );
    assert.equal(resolveListColumnAlign({ id: "x", label: "X", align: "right" }), "right");
    assert.equal(resolveListColumnAlign({ id: "x", label: "X" }), "left");
    assert.equal(resolveListColumnAlign(undefined), "left");
  });
});
