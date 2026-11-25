import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { computeFloatingPosition } from "../../src/app/floating-position";

const viewport = { width: 1000, height: 800 };

describe("computeFloatingPosition", () => {
  test("centres above the anchor when there is room", () => {
    const position = computeFloatingPosition({
      anchor: { top: 400, left: 500, width: 20, height: 20 },
      size: { width: 60, height: 24 },
      viewport,
      gap: 6,
      margin: 8
    });
    assert.deepEqual(position, { top: 400 - 6 - 24, left: 510 - 30, side: "top" });
  });

  test("flips below when the top does not fit", () => {
    const position = computeFloatingPosition({
      anchor: { top: 10, left: 500, width: 20, height: 20 },
      size: { width: 60, height: 24 },
      viewport,
      gap: 6,
      margin: 8
    });
    assert.deepEqual(position, { top: 10 + 20 + 6, left: 480, side: "bottom" });
  });

  test("keeps the preferred bottom side when it fits", () => {
    const position = computeFloatingPosition({
      anchor: { top: 400, left: 500, width: 20, height: 20 },
      size: { width: 60, height: 24 },
      viewport,
      preferredSide: "bottom",
      gap: 6,
      margin: 8
    });
    assert.equal(position.side, "bottom");
    assert.equal(position.top, 426);
  });

  test("flips above when the bottom does not fit", () => {
    const position = computeFloatingPosition({
      anchor: { top: 770, left: 500, width: 20, height: 20 },
      size: { width: 60, height: 100 },
      viewport,
      preferredSide: "bottom",
      gap: 6,
      margin: 8
    });
    assert.equal(position.side, "top");
    assert.equal(position.top, 770 - 6 - 100);
  });

  test("keeps the side with more room when neither fits", () => {
    const position = computeFloatingPosition({
      anchor: { top: 300, left: 500, width: 20, height: 20 },
      size: { width: 60, height: 700 },
      viewport,
      gap: 6,
      margin: 8
    });
    assert.equal(position.side, "bottom");
  });

  test("clamps to the viewport's left and right edges", () => {
    const nearLeft = computeFloatingPosition({
      anchor: { top: 400, left: 0, width: 10, height: 10 },
      size: { width: 200, height: 24 },
      viewport,
      margin: 8
    });
    assert.equal(nearLeft.left, 8);

    const nearRight = computeFloatingPosition({
      anchor: { top: 400, left: 990, width: 10, height: 10 },
      size: { width: 200, height: 24 },
      viewport,
      margin: 8
    });
    assert.equal(nearRight.left, 1000 - 8 - 200);
  });
});
