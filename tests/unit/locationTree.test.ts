import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { getLocationPathBelow, getLocationSubtreeIds } from "../../src/lib/locationTree";

const locations = [
  { id: "cabinet", parentId: null, name: "Cabinet A" },
  { id: "drawer1", parentId: "cabinet", name: "Drawer 1" },
  { id: "drawer2", parentId: "cabinet", name: "Drawer 2" },
  { id: "bin", parentId: "drawer1", name: "Bin 3" },
  { id: "shelf", parentId: null, name: "Shelf" }
];

describe("location tree", () => {
  describe("getLocationSubtreeIds", () => {
    test("returns the location and every descendant, however deep", () => {
      assert.deepEqual(
        new Set(getLocationSubtreeIds(locations, "cabinet")),
        new Set(["cabinet", "drawer1", "drawer2", "bin"])
      );
    });

    test("returns only the location when it has no children", () => {
      assert.deepEqual(getLocationSubtreeIds(locations, "shelf"), ["shelf"]);
    });

    test("does not loop on a cyclic parent chain", () => {
      const cyclic = [
        { id: "a", parentId: "b" },
        { id: "b", parentId: "a" }
      ];
      assert.deepEqual(new Set(getLocationSubtreeIds(cyclic, "a")), new Set(["a", "b"]));
    });
  });

  describe("getLocationPathBelow", () => {
    test("names the root itself when the location is the root", () => {
      assert.equal(getLocationPathBelow(locations, "cabinet", "cabinet"), "Cabinet A");
    });

    test("gives the path under the root, without the root", () => {
      assert.equal(getLocationPathBelow(locations, "cabinet", "drawer1"), "Drawer 1");
      assert.equal(getLocationPathBelow(locations, "cabinet", "bin"), "Drawer 1 / Bin 3");
    });

    test("falls back to the location's own name outside the root's subtree", () => {
      assert.equal(getLocationPathBelow(locations, "drawer2", "bin"), "Bin 3");
    });
  });
});
