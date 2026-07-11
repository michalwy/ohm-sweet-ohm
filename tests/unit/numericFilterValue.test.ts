import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  serializeNumericFilter,
  deserializeNumericFilter,
  type ParsedNumericFilter
} from "../../src/app/numeric-filter-value.js";

const SINGLE_VALUE_CASES: Array<{ filter: ParsedNumericFilter; serialized: string }> = [
  { filter: { op: "eq", rawValue: "100" }, serialized: "eq:100" },
  { filter: { op: "neq", rawValue: "1mV" }, serialized: "neq:1mV" },
  { filter: { op: "gt", rawValue: "10kΩ" }, serialized: "gt:10kΩ" },
  { filter: { op: "gte", rawValue: "5" }, serialized: "gte:5" },
  { filter: { op: "lt", rawValue: "1.5" }, serialized: "lt:1.5" },
  { filter: { op: "lte", rawValue: "100µF" }, serialized: "lte:100µF" }
];

const RANGE_CASES: Array<{ filter: ParsedNumericFilter; serialized: string }> = [
  {
    filter: { op: "between", rawMin: "1mV", rawMax: "1V" },
    serialized: "between:1mV:1V"
  },
  {
    filter: { op: "not-between", rawMin: "100", rawMax: "1000" },
    serialized: "not-between:100:1000"
  }
];

describe("serializeNumericFilter", () => {
  for (const { filter, serialized } of [...SINGLE_VALUE_CASES, ...RANGE_CASES]) {
    it(`serializes ${filter.op}`, () => {
      assert.equal(serializeNumericFilter(filter), serialized);
    });
  }
});

describe("deserializeNumericFilter", () => {
  it("returns null for empty string", () => {
    assert.equal(deserializeNumericFilter(""), null);
  });

  it("returns null for string without colon", () => {
    assert.equal(deserializeNumericFilter("gt"), null);
  });

  it("returns null for unknown operator", () => {
    assert.equal(deserializeNumericFilter("foo:100"), null);
  });

  it("returns null for range op missing second colon", () => {
    assert.equal(deserializeNumericFilter("between:100"), null);
  });

  it("returns null for range op with empty min or max", () => {
    assert.equal(deserializeNumericFilter("between::1000"), null);
    assert.equal(deserializeNumericFilter("between:100:"), null);
  });

  for (const { filter, serialized } of [...SINGLE_VALUE_CASES, ...RANGE_CASES]) {
    it(`round-trips ${filter.op}`, () => {
      assert.deepEqual(deserializeNumericFilter(serialized), filter);
    });
  }

  it("deserializes single-value filter from string", () => {
    assert.deepEqual(deserializeNumericFilter("gt:1mV"), { op: "gt", rawValue: "1mV" });
  });

  it("deserializes range filter from string", () => {
    assert.deepEqual(deserializeNumericFilter("between:1mV:1V"), {
      op: "between",
      rawMin: "1mV",
      rawMax: "1V"
    });
  });
});
