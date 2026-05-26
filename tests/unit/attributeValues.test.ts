import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  normalizeDictionaryName,
  parseAttributeValue
} from "../../src/server/parts/attributeValues";

describe("attribute value parsing", () => {
  test("normalizes dictionary names case-insensitively with collapsed whitespace", () => {
    assert.equal(normalizeDictionaryName("  Power   Rating  "), "power rating");
  });

  test("normalizes resistance aliases to the same base value", () => {
    for (const rawValue of ["10 kohm", "10 k", "10kΩ", "10000 Ω"]) {
      assert.deepEqual(
        parseAttributeValue({
          type: "QUANTITY",
          rawValue,
          baseUnitSymbol: "Ω"
        }),
        {
          type: "QUANTITY",
          quantityBaseValue: "10000",
          displayValue: "10 kΩ"
        }
      );
    }
  });

  test("adds the base unit to quantity display when the input omits a unit", () => {
    assert.deepEqual(
      parseAttributeValue({
        type: "QUANTITY",
        rawValue: "10000",
        baseUnitSymbol: "Ω"
      }),
      {
        type: "QUANTITY",
        quantityBaseValue: "10000",
        displayValue: "10 kΩ"
      }
    );
  });

  test("accepts decimal comma and displays decimal point", () => {
    assert.deepEqual(
      parseAttributeValue({
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

  test("normalizes quantity display to the closest SI unit", () => {
    assert.deepEqual(
      parseAttributeValue({
        type: "QUANTITY",
        rawValue: "2200 pF",
        baseUnitSymbol: "F"
      }),
      {
        type: "QUANTITY",
        quantityBaseValue: "0.0000000022",
        displayValue: "2.2 nF"
      }
    );

    assert.deepEqual(
      parseAttributeValue({
        type: "QUANTITY",
        rawValue: "0.047 uF",
        baseUnitSymbol: "F"
      }),
      {
        type: "QUANTITY",
        quantityBaseValue: "0.000000047",
        displayValue: "47 nF"
      }
    );
  });

  test("does not normalize percent quantities and removes leading +/- markers", () => {
    assert.deepEqual(
      parseAttributeValue({
        type: "QUANTITY",
        rawValue: "±5%",
        baseUnitSymbol: "%"
      }),
      {
        type: "QUANTITY",
        quantityBaseValue: "5",
        displayValue: "5 %"
      }
    );

    assert.deepEqual(
      parseAttributeValue({
        type: "QUANTITY",
        rawValue: "+/- 10 %",
        baseUnitSymbol: "%"
      }),
      {
        type: "QUANTITY",
        quantityBaseValue: "10",
        displayValue: "10 %"
      }
    );
  });

  test("rejects unknown quantity units", () => {
    assert.throws(
      () =>
        parseAttributeValue({
          type: "QUANTITY",
          rawValue: "10 banana",
          baseUnitSymbol: "Ω"
        }),
      /invalid_quantity_unit/
    );
  });

  test("stores choice values by option id", () => {
    assert.deepEqual(
      parseAttributeValue({
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
