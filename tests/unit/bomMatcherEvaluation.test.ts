import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  MATCHER_OPERATORS_BY_TYPE,
  evaluateMatcher,
  isOperatorAllowedForType
} from "../../src/server/designs/bomMatcherEvaluation";

describe("matcher operator constraints", () => {
  test("numeric types allow ordering operators", () => {
    assert.deepEqual(MATCHER_OPERATORS_BY_TYPE.QUANTITY, [
      "EQ",
      "NEQ",
      "LT",
      "LTE",
      "GT",
      "GTE"
    ]);
    assert.equal(isOperatorAllowedForType("NUMBER", "GTE"), true);
  });

  test("non-numeric types allow only equality operators", () => {
    assert.deepEqual(MATCHER_OPERATORS_BY_TYPE.TEXT, ["EQ", "NEQ"]);
    assert.equal(isOperatorAllowedForType("TEXT", "LT"), false);
    assert.equal(isOperatorAllowedForType("CHOICE", "GT"), false);
    assert.equal(isOperatorAllowedForType("BOOLEAN", "LTE"), false);
  });
});

describe("evaluateMatcher", () => {
  test("QUANTITY satisfies a >= threshold on the base value", () => {
    assert.equal(
      evaluateMatcher({
        type: "QUANTITY",
        operator: "GTE",
        matcherValue: { quantityBaseValue: "0.25" },
        partValue: { quantityBaseValue: "0.5" }
      }),
      true
    );
    assert.equal(
      evaluateMatcher({
        type: "QUANTITY",
        operator: "GTE",
        matcherValue: { quantityBaseValue: "0.25" },
        partValue: { quantityBaseValue: "0.1" }
      }),
      false
    );
  });

  test("QUANTITY equality compares normalized base values", () => {
    assert.equal(
      evaluateMatcher({
        type: "QUANTITY",
        operator: "EQ",
        matcherValue: { quantityBaseValue: "10000" },
        partValue: { quantityBaseValue: "10000" }
      }),
      true
    );
  });

  test("NUMBER comparison uses the number value", () => {
    assert.equal(
      evaluateMatcher({
        type: "NUMBER",
        operator: "LT",
        matcherValue: { numberValue: "5" },
        partValue: { numberValue: "3" }
      }),
      true
    );
  });

  test("TEXT equality is case-insensitive and whitespace-normalized", () => {
    assert.equal(
      evaluateMatcher({
        type: "TEXT",
        operator: "EQ",
        matcherValue: { textValue: "0207" },
        partValue: { textValue: "0207" }
      }),
      true
    );
    assert.equal(
      evaluateMatcher({
        type: "TEXT",
        operator: "NEQ",
        matcherValue: { textValue: "0207" },
        partValue: { textValue: "0805" }
      }),
      true
    );
  });

  test("CHOICE compares option ids", () => {
    assert.equal(
      evaluateMatcher({
        type: "CHOICE",
        operator: "EQ",
        matcherValue: { choiceOptionId: "opt-smd" },
        partValue: { choiceOptionId: "opt-smd" }
      }),
      true
    );
    assert.equal(
      evaluateMatcher({
        type: "CHOICE",
        operator: "EQ",
        matcherValue: { choiceOptionId: "opt-smd" },
        partValue: { choiceOptionId: "opt-tht" }
      }),
      false
    );
  });

  test("BOOLEAN compares the boolean value", () => {
    assert.equal(
      evaluateMatcher({
        type: "BOOLEAN",
        operator: "EQ",
        matcherValue: { booleanValue: true },
        partValue: { booleanValue: true }
      }),
      true
    );
  });

  test("a missing part value satisfies only NEQ", () => {
    assert.equal(
      evaluateMatcher({
        type: "QUANTITY",
        operator: "GTE",
        matcherValue: { quantityBaseValue: "0.25" },
        partValue: null
      }),
      false
    );
    assert.equal(
      evaluateMatcher({
        type: "TEXT",
        operator: "NEQ",
        matcherValue: { textValue: "0207" },
        partValue: null
      }),
      true
    );
  });
});
