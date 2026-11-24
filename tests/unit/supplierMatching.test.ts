import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import {
  buildSourceAttributeKey,
  formatSourceAttributeDisplay,
  getTargetCategoryScopeKey,
  normalizeSourceCategoryKey,
  normalizeSourceManufacturerKey
} from "../../src/server/integrations/matchingKeys";

describe("supplier matching (#291)", () => {
  test("the \"use server\" module exports only the suggestion action", () => {
    // Every exported async function of a "use server" module is a server action the browser can
    // call; internal helpers such as learnSupplierMatching must live elsewhere.
    const source = readFileSync(
      new URL("../../src/server/integrations/matching.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /^"use server";/);
    const exportedFunctions = [...source.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)].map(
      (match) => match[1]
    );
    assert.deepEqual(exportedFunctions, ["getSupplierMatchingSuggestionsForWorkspace"]);
  });

  test("the learning helper is server-only and not a server action", () => {
    const source = readFileSync(
      new URL("../../src/server/integrations/matchingLearning.ts", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(source, /^\s*["']use server["'];/m);
    assert.match(source, /^import "server-only";/);
  });

  test("keys are normalized as before", () => {
    assert.equal(normalizeSourceCategoryKey(null), "uncategorized");
    assert.equal(normalizeSourceCategoryKey("  Ceramic   Capacitors "), "ceramic capacitors");
    assert.equal(normalizeSourceManufacturerKey(""), "uncategorized");
    assert.equal(normalizeSourceManufacturerKey("Texas  Instruments"), "texas instruments");
    assert.equal(buildSourceAttributeKey({ name: " Voltage - Rated ", unit: "V" }), "voltage - rated::v");
    assert.equal(buildSourceAttributeKey({ name: "Package" }), "package::");
    assert.equal(formatSourceAttributeDisplay({ name: "Voltage", unit: " V " }), "Voltage (V)");
    assert.equal(formatSourceAttributeDisplay({ name: "Package", unit: null }), "Package");
    assert.equal(getTargetCategoryScopeKey(null), "__none__");
    assert.equal(getTargetCategoryScopeKey("cat_1"), "cat_1");
  });
});
