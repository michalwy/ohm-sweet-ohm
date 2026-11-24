import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  parseStoredExpandedIds,
  serializeExpandedIds,
  toggleExpandedId
} from "../../src/app/tree-list-expansion";

describe("toggleExpandedId", () => {
  test("adds a collapsed id and removes an expanded one without mutating the input", () => {
    const expandedIds = new Set(["a"]);

    assert.deepEqual([...toggleExpandedId(expandedIds, "b")].sort(), ["a", "b"]);
    assert.deepEqual([...toggleExpandedId(expandedIds, "a")], []);
    assert.deepEqual([...expandedIds], ["a"]);
  });
});

describe("parseStoredExpandedIds", () => {
  const fallbackIds = new Set(["default"]);

  test("returns the fallback when nothing usable is stored", () => {
    assert.equal(parseStoredExpandedIds(null, fallbackIds), fallbackIds);
    assert.equal(parseStoredExpandedIds("", fallbackIds), fallbackIds);
    assert.equal(parseStoredExpandedIds("not json", fallbackIds), fallbackIds);
    assert.equal(parseStoredExpandedIds('{"a":1}', fallbackIds), fallbackIds);
  });

  test("keeps string entries of a stored array, including an empty one", () => {
    assert.deepEqual([...parseStoredExpandedIds('["a", 1, "b", null]', fallbackIds)], ["a", "b"]);
    assert.deepEqual([...parseStoredExpandedIds("[]", fallbackIds)], []);
  });

  test("round-trips with serializeExpandedIds", () => {
    const expandedIds = new Set(["x", "y"]);

    assert.deepEqual(
      [...parseStoredExpandedIds(serializeExpandedIds(expandedIds), fallbackIds)],
      ["x", "y"]
    );
  });
});
