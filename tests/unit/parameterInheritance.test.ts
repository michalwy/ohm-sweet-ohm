import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { resolveEffectiveCategoryParameters } from "../../src/server/parts/parameterInheritance";
import type { CategoryParameterInheritanceInput } from "../../src/server/parts/parameterInheritance";

const parameters = {
  package: makeParameter("package", "Package", "TEXT"),
  resistance: makeParameter("resistance", "Resistance", "QUANTITY", "Ω"),
  power: makeParameter("power", "Power Rating", "QUANTITY", "W")
} as const;

describe("category parameter inheritance", () => {
  test("inherits through multiple levels and lets descendants override settings", () => {
    const effectiveParameters = resolveEffectiveCategoryParameters({
      categoryChain: [
        { id: "passives", primaryParameterId: "package" },
        { id: "resistors", primaryParameterId: null },
        { id: "precision-resistors", primaryParameterId: "resistance" }
      ],
      categoryParameters: [
        makeCategoryParameter("passives", parameters.package, 10, {
          textValue: "SMD",
          numberValue: null,
          quantityBaseValue: null,
          booleanValue: null,
          choiceOptionId: null,
          displayValue: "SMD"
        }),
        makeCategoryParameter("resistors", parameters.resistance, 20),
        makeCategoryParameter("resistors", parameters.power, 30, {
          textValue: null,
          numberValue: null,
          quantityBaseValue: "0.25",
          booleanValue: null,
          choiceOptionId: null,
          displayValue: "0.25 W"
        }),
        makeCategoryParameter("precision-resistors", parameters.power, 5, null)
      ]
    });

    assert.deepEqual(
      effectiveParameters.map((parameter) => ({
        id: parameter.parameter.id,
        sortOrder: parameter.sortOrder,
        displayDefault: parameter.defaultValue?.displayValue ?? null,
        isPrimary: parameter.isPrimary,
        sourceCategoryId: parameter.sourceCategoryId
      })),
      [
        {
          id: "power",
          sortOrder: 5,
          displayDefault: null,
          isPrimary: false,
          sourceCategoryId: "precision-resistors"
        },
        {
          id: "package",
          sortOrder: 10,
          displayDefault: "SMD",
          isPrimary: false,
          sourceCategoryId: "passives"
        },
        {
          id: "resistance",
          sortOrder: 20,
          displayDefault: null,
          isPrimary: true,
          sourceCategoryId: "resistors"
        }
      ]
    );
  });

  test("inherits the nearest primary parameter when a category has no local primary", () => {
    const effectiveParameters = resolveEffectiveCategoryParameters({
      categoryChain: [
        { id: "passives", primaryParameterId: "package" },
        { id: "resistors", primaryParameterId: null }
      ],
      categoryParameters: [
        makeCategoryParameter("passives", parameters.package, 10),
        makeCategoryParameter("resistors", parameters.resistance, 20)
      ]
    });

    assert.equal(
      effectiveParameters.find((parameter) => parameter.isPrimary)?.parameter.id,
      "package"
    );
  });
});

function makeParameter(
  id: string,
  name: string,
  type: CategoryParameterInheritanceInput["categoryParameters"][number]["parameter"]["type"],
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

function makeCategoryParameter(
  categoryId: string,
  parameter: CategoryParameterInheritanceInput["categoryParameters"][number]["parameter"],
  sortOrder: number,
  defaultValue: CategoryParameterInheritanceInput["categoryParameters"][number]["defaultValue"] = null
) {
  return {
    categoryId,
    parameterId: parameter.id,
    sortOrder,
    defaultValue,
    parameter
  };
}
