import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  LOCATION_GENERATOR_MAX_NEW,
  countPlannedLocations,
  normalizeLocationName,
  parseLocationGeneratorLevels,
  planLocationHierarchy,
  resolvePlannedLocations,
  validateLocationGeneratorLevels,
  type LocationGeneratorLevel
} from "../../src/lib/locationGenerator";

function level(overrides: Partial<LocationGeneratorLevel> = {}): LocationGeneratorLevel {
  return {
    prefix: "",
    suffix: "",
    counter: "numeric",
    start: "1",
    count: 3,
    padding: "auto",
    isAssignable: true,
    ...overrides
  };
}

function names(levels: LocationGeneratorLevel[]) {
  return planLocationHierarchy(levels).map((planned) => planned.name);
}

describe("location generator", () => {
  describe("counters", () => {
    test("numbers count from the start value with prefix and suffix around them", () => {
      assert.deepEqual(names([level({ prefix: "Row-", suffix: " (top)", start: "4" })]), [
        "Row-4 (top)",
        "Row-5 (top)",
        "Row-6 (top)"
      ]);
    });

    test("auto padding widens every number to the level's largest", () => {
      assert.deepEqual(names([level({ start: "8", count: 3 })]), ["08", "09", "10"]);
    });

    test("fixed padding is a minimum width, and 1 digit means no padding", () => {
      assert.deepEqual(names([level({ start: "9", count: 2, padding: 3 })]), ["009", "010"]);
      assert.deepEqual(names([level({ start: "9", count: 2, padding: 1 })]), ["9", "10"]);
    });

    test("letters run like spreadsheet columns past Z and ignore padding", () => {
      assert.deepEqual(
        names([level({ counter: "alphabetic", start: "y", count: 4, padding: 4 })]),
        ["Y", "Z", "AA", "AB"]
      );
    });
  });

  describe("hierarchy", () => {
    test("every location of a level gets the whole next level, parents first", () => {
      const plan = planLocationHierarchy([
        level({ prefix: "Row ", counter: "alphabetic", start: "A", count: 2, isAssignable: false }),
        level({ prefix: "Bin ", count: 2 })
      ]);

      assert.deepEqual(
        plan.map((planned) => [planned.key, planned.parentKey, planned.name, planned.isAssignable]),
        [
          ["0", null, "Row A", false],
          ["0.0", "0", "Bin 1", true],
          ["0.1", "0", "Bin 2", true],
          ["1", null, "Row B", false],
          ["1.0", "1", "Bin 1", true],
          ["1.1", "1", "Bin 2", true]
        ]
      );
    });

    test("level tokens in a prefix or suffix insert that level's counter", () => {
      assert.deepEqual(
        names([
          level({ prefix: "R", count: 2 }),
          level({ prefix: "R{1}C", suffix: "-{2}", count: 2 })
        ]),
        ["R1", "R1C1-1", "R1C2-2", "R2", "R2C1-1", "R2C2-2"]
      );
    });

    test("names are trimmed and normalized the way manual names are", () => {
      const [planned] = planLocationHierarchy([level({ prefix: "  Big   Bin ", count: 1 })]);
      assert.equal(planned.name, "Big   Bin 1");
      assert.equal(planned.normalizedName, "big bin 1");
      assert.equal(normalizeLocationName("  Big   BIN 1 "), "big bin 1");
    });
  });

  describe("validation", () => {
    test("accepts a valid multi-level definition", () => {
      assert.deepEqual(
        validateLocationGeneratorLevels([level(), level({ counter: "alphabetic", start: "AA" })]),
        []
      );
    });

    test("reports each broken field against its level", () => {
      assert.deepEqual(
        validateLocationGeneratorLevels([
          level({ count: 0 }),
          level({ start: "A" }),
          level({ counter: "alphabetic", start: "ABCD", padding: 0 }),
          level({ prefix: "{5}" })
        ]),
        [
          { code: "invalid-count", level: 0 },
          { code: "invalid-start", level: 1 },
          { code: "invalid-start", level: 2 },
          { code: "invalid-padding", level: 2 },
          { code: "invalid-token", level: 3 }
        ]
      );
    });

    test("rejects no levels, fractional counts and tokens for deeper or zero levels", () => {
      assert.deepEqual(validateLocationGeneratorLevels([]), [{ code: "no-levels" }]);
      assert.deepEqual(validateLocationGeneratorLevels([level({ count: 1.5 })]), [
        { code: "invalid-count", level: 0 }
      ]);
      assert.deepEqual(validateLocationGeneratorLevels([level({ suffix: "{0}" })]), [
        { code: "invalid-token", level: 0 }
      ]);
      assert.deepEqual(validateLocationGeneratorLevels([level({ prefix: "{2}" }), level()]), [
        { code: "invalid-token", level: 0 }
      ]);
    });

    test("a count may not exceed the new-location limit", () => {
      assert.deepEqual(
        validateLocationGeneratorLevels([level({ count: LOCATION_GENERATOR_MAX_NEW + 1 })]),
        [{ code: "invalid-count", level: 0 }]
      );
    });

    test("counts the plan without expanding it and refuses one that is too large", () => {
      const huge = [level({ count: 100 }), level({ count: 100 }), level({ count: 100 })];
      assert.equal(countPlannedLocations([level({ count: 2 }), level({ count: 3 })]), 8);
      assert.deepEqual(validateLocationGeneratorLevels(huge), [{ code: "too-many-planned" }]);
      assert.deepEqual(planLocationHierarchy(huge), []);
    });

    test("parses well-formed input and refuses malformed input", () => {
      assert.deepEqual(parseLocationGeneratorLevels([level()]), [level()]);
      assert.equal(parseLocationGeneratorLevels("levels"), null);
      assert.equal(parseLocationGeneratorLevels([{ ...level(), count: "3" }]), null);
      assert.equal(parseLocationGeneratorLevels([{ ...level(), counter: "roman" }]), null);
    });
  });

  describe("resolving against existing locations", () => {
    const plan = planLocationHierarchy([
      level({ prefix: "Row ", count: 2 }),
      level({ prefix: "Bin ", count: 2 })
    ]);

    test("reuses a same-named sibling and generates the next level inside it", () => {
      const resolved = resolvePlannedLocations(plan, "cabinet", [
        { id: "row1", parentId: "cabinet", normalizedName: "row 1" },
        { id: "bin1", parentId: "row1", normalizedName: "bin 1" },
        // Same name, different parent: not a match.
        { id: "elsewhere", parentId: "shelf", normalizedName: "row 2" }
      ]);

      assert.deepEqual(Object.fromEntries(resolved), {
        "0": "row1",
        "0.0": "bin1",
        "0.1": null,
        "1": null,
        "1.0": null,
        "1.1": null
      });
    });

    test("never matches below a new location, even when a root-level name would", () => {
      const resolved = resolvePlannedLocations(plan, null, [
        { id: "bin-at-root", parentId: null, normalizedName: "bin 1" }
      ]);
      assert.equal(resolved.get("0"), null);
      assert.equal(resolved.get("0.0"), null);
    });

    test("matches at root level when no parent is chosen", () => {
      const resolved = resolvePlannedLocations(plan, null, [
        { id: "row2", parentId: null, normalizedName: "row 2" }
      ]);
      assert.equal(resolved.get("1"), "row2");
    });
  });
});
