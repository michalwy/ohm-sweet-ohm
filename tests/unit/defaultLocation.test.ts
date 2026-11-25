import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { resolvePreselectedLocationId } from "../../src/lib/defaultLocation";

const locations = [{ id: "shelf" }, { id: "drawer" }];

describe("resolvePreselectedLocationId (#39)", () => {
  test("a part's own default location wins over the workspace's", () => {
    assert.equal(resolvePreselectedLocationId("drawer", "shelf", locations), "drawer");
  });

  test("a part without a default location falls back to the workspace's", () => {
    assert.equal(resolvePreselectedLocationId(null, "shelf", locations), "shelf");
    assert.equal(resolvePreselectedLocationId(undefined, "shelf", locations), "shelf");
    assert.equal(resolvePreselectedLocationId("", "shelf", locations), "shelf");
  });

  test("nothing is preselected when neither is set", () => {
    assert.equal(resolvePreselectedLocationId(null, null, locations), "");
  });

  test("a default the picker does not offer preselects nothing", () => {
    assert.equal(resolvePreselectedLocationId(null, "archived", locations), "");
    assert.equal(resolvePreselectedLocationId("archived", "shelf", locations), "");
  });
});
