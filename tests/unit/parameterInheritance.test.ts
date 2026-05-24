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
        { id: "passives", valueParameterId: "package" },
        { id: "resistors", valueParameterId: null },
        { id: "precision-resistors", valueParameterId: "resistance" }
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
        makeCategoryParameter("resistors", parameters.resistance, 20, null, true),
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
        isValue: parameter.isValue,
        isPrimary: parameter.isPrimary,
        sourceCategoryId: parameter.sourceCategoryId
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

    const powerParameter = effectiveParameters.find(
      (parameter) => parameter.parameter.id === "power"
    );
    assert.equal(powerParameter?.inheritedParameter?.sourceCategoryId, "resistors");
    assert.equal(
      powerParameter?.inheritedParameter?.defaultValue?.displayValue,
      "0.25 W"
    );
  });

  test("inherits the nearest value parameter when a category has no local value", () => {
    const effectiveParameters = resolveEffectiveCategoryParameters({
      categoryChain: [
        { id: "passives", valueParameterId: "package" },
        { id: "resistors", valueParameterId: null }
      ],
      categoryParameters: [
        makeCategoryParameter("passives", parameters.package, 10),
        makeCategoryParameter("resistors", parameters.resistance, 20)
      ]
    });

    assert.equal(
      effectiveParameters.find((parameter) => parameter.isValue)?.parameter.id,
      "package"
    );
  });

  test("inherits and overrides primary parameter flags independently from value", () => {
    const effectiveParameters = resolveEffectiveCategoryParameters({
      categoryChain: [
        { id: "passives", valueParameterId: "package" },
        { id: "resistors", valueParameterId: null }
      ],
      categoryParameters: [
        makeCategoryParameter("passives", parameters.package, 10, null, true),
        makeCategoryParameter("resistors", parameters.package, 20, null, false)
      ]
    });
    const packageParameter = effectiveParameters.find(
      (parameter) => parameter.parameter.id === "package"
    );

    assert.equal(packageParameter?.isValue, true);
    assert.equal(packageParameter?.isPrimary, false);
    assert.equal(packageParameter?.inheritedParameter?.isPrimary, true);
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
  defaultValue: CategoryParameterInheritanceInput["categoryParameters"][number]["defaultValue"] = null,
  isPrimary = false
) {
  return {
    categoryId,
    parameterId: parameter.id,
    sortOrder,
    isPrimary,
    defaultValue,
    parameter
  };
}
