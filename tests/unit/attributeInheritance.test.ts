import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { resolveEffectiveCategoryAttributes } from "../../src/server/parts/attributeInheritance";
import type { CategoryAttributeInheritanceInput } from "../../src/server/parts/attributeInheritance";

const attributes = {
  package: makeAttribute("package", "Package", "TEXT"),
  resistance: makeAttribute("resistance", "Resistance", "QUANTITY", "Ω"),
  power: makeAttribute("power", "Power Rating", "QUANTITY", "W")
} as const;

describe("category attribute inheritance", () => {
  test("inherits through multiple levels and lets descendants override settings", () => {
    const effectiveAttributes = resolveEffectiveCategoryAttributes({
      categoryChain: [
        { id: "passives", valueAttributeId: "package" },
        { id: "resistors", valueAttributeId: null },
        { id: "precision-resistors", valueAttributeId: "resistance" }
      ],
      categoryAttributes: [
        makeCategoryAttribute("passives", attributes.package, 10, {
          textValue: "SMD",
          numberValue: null,
          quantityBaseValue: null,
          booleanValue: null,
          choiceOptionId: null,
          displayValue: "SMD"
        }),
        makeCategoryAttribute("resistors", attributes.resistance, 20, null, true),
        makeCategoryAttribute("resistors", attributes.power, 30, {
          textValue: null,
          numberValue: null,
          quantityBaseValue: "0.25",
          booleanValue: null,
          choiceOptionId: null,
          displayValue: "0.25 W"
        }),
        makeCategoryAttribute("precision-resistors", attributes.power, 5, null)
      ]
    });

    assert.deepEqual(
      effectiveAttributes.map((attribute) => ({
        id: attribute.attribute.id,
        sortOrder: attribute.sortOrder,
        displayDefault: attribute.defaultValue?.displayValue ?? null,
        isValue: attribute.isValue,
        isPrimary: attribute.isPrimary,
        sourceCategoryId: attribute.sourceCategoryId
      })),
      [
        {
          id: "power",
          sortOrder: 5,
          displayDefault: null,
          isValue: false,
          isPrimary: false,
          sourceCategoryId: "precision-resistors"
        },
        {
          id: "package",
          sortOrder: 10,
          displayDefault: "SMD",
          isValue: false,
          isPrimary: false,
          sourceCategoryId: "passives"
        },
        {
          id: "resistance",
          sortOrder: 20,
          displayDefault: null,
          isValue: true,
          isPrimary: true,
          sourceCategoryId: "resistors"
        }
      ]
    );

    const powerAttribute = effectiveAttributes.find(
      (attribute) => attribute.attribute.id === "power"
    );
    assert.equal(powerAttribute?.inheritedAttribute?.sourceCategoryId, "resistors");
    assert.equal(
      powerAttribute?.inheritedAttribute?.defaultValue?.displayValue,
      "0.25 W"
    );
  });

  test("inherits the nearest value attribute when a category has no local value", () => {
    const effectiveAttributes = resolveEffectiveCategoryAttributes({
      categoryChain: [
        { id: "passives", valueAttributeId: "package" },
        { id: "resistors", valueAttributeId: null }
      ],
      categoryAttributes: [
        makeCategoryAttribute("passives", attributes.package, 10),
        makeCategoryAttribute("resistors", attributes.resistance, 20)
      ]
    });

    assert.equal(
      effectiveAttributes.find((attribute) => attribute.isValue)?.attribute.id,
      "package"
    );
  });

  test("inherits and overrides primary attribute flags independently from value", () => {
    const effectiveAttributes = resolveEffectiveCategoryAttributes({
      categoryChain: [
        { id: "passives", valueAttributeId: "package" },
        { id: "resistors", valueAttributeId: null }
      ],
      categoryAttributes: [
        makeCategoryAttribute("passives", attributes.package, 10, null, true),
        makeCategoryAttribute("resistors", attributes.package, 20, null, false)
      ]
    });
    const packageAttribute = effectiveAttributes.find(
      (attribute) => attribute.attribute.id === "package"
    );

    assert.equal(packageAttribute?.isValue, true);
    assert.equal(packageAttribute?.isPrimary, false);
    assert.equal(packageAttribute?.inheritedAttribute?.isPrimary, true);
  });
});

function makeAttribute(
  id: string,
  name: string,
  type: CategoryAttributeInheritanceInput["categoryAttributes"][number]["attribute"]["type"],
  baseUnitSymbol: string | null = null
) {
  return {
    id,
    name,
    description: null,
    type,
    baseUnitSymbol,
    choiceOptions: []
  };
}

function makeCategoryAttribute(
  categoryId: string,
  attribute: CategoryAttributeInheritanceInput["categoryAttributes"][number]["attribute"],
  sortOrder: number,
  defaultValue: CategoryAttributeInheritanceInput["categoryAttributes"][number]["defaultValue"] = null,
  isPrimary = false
) {
  return {
    categoryId,
    attributeId: attribute.id,
    sortOrder,
    isPrimary,
    defaultValue,
    attribute
  };
}
