import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  normalizeDictionaryName,
  parseParameterValue
} from "../../src/server/parts/parameterValues";

describe("parameter value parsing", () => {
  test("normalizes dictionary names case-insensitively with collapsed whitespace", () => {
    assert.equal(normalizeDictionaryName("  Power   Rating  "), "power rating");
  });

  test("normalizes resistance aliases to the same base value", () => {
    for (const rawValue of ["10 kohm", "10 k", "10kΩ", "10000 Ω"]) {
      assert.deepEqual(
        parseParameterValue({
          type: "QUANTITY",
          rawValue,
          baseUnitSymbol: "Ω"
        }),
        {
          type: "QUANTITY",
          quantityBaseValue: "10000",
          displayValue: rawValue === "10000 Ω" ? "10000 Ω" : "10 kΩ"
        }
      );
    }
  });

  test("adds the base unit to quantity display when the input omits a unit", () => {
    assert.deepEqual(
      parseParameterValue({
        type: "QUANTITY",
        rawValue: "10000",
        baseUnitSymbol: "Ω"
      }),
      {
        type: "QUANTITY",
        quantityBaseValue: "10000",
        displayValue: "10000 Ω"
      }
    );
  });

  test("accepts decimal comma and displays decimal point", () => {
    assert.deepEqual(
      parseParameterValue({
        type: "QUANTITY",
        rawValue: "4,7 kΩ",
        baseUnitSymbol: "Ω"
      }),
      {
        type: "QUANTITY",
        quantityBaseValue: "4700",
        displayValue: "4.7 kΩ"
      }
    );
  });

  test("rejects unknown quantity units", () => {
    assert.throws(
      () =>
        parseParameterValue({
          type: "QUANTITY",
          rawValue: "10 banana",
          baseUnitSymbol: "Ω"
        }),
      /invalid_quantity_unit/
    );
  });

  test("stores choice values by option id", () => {
    assert.deepEqual(
      parseParameterValue({
        type: "CHOICE",
        rawValue: " smd ",
        choiceOptions: [{ id: "option-smd", label: "SMD" }]
      }),
      {
        type: "CHOICE",
        choiceOptionId: "option-smd",
        displayValue: "SMD"
      }
    );
  });
});
