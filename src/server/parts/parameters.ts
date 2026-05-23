import "server-only";

import { prisma } from "@/server/db/prisma";
import { resolveEffectiveCategoryParameters } from "@/server/parts/parameterInheritance";
import type { ParameterValueType } from "@/server/parts/parameterValues";

export type EffectiveCategoryParameter = {
  parameter: {
    id: string;
    name: string;
    description: string | null;
    type: ParameterValueType;
    baseUnitSymbol: string | null;
    choiceOptions: Array<{
      id: string;
      label: string;
      sortOrder: number;
    }>;
  };
  sourceCategoryId: string;
  sortOrder: number;
  defaultValue: EffectiveParameterDefaultValue | null;
  isPrimary: boolean;
};

export type EffectiveParameterDefaultValue = {
  textValue: string | null;
  numberValue: string | null;
  quantityBaseValue: string | null;
  booleanValue: boolean | null;
  choiceOptionId: string | null;
  displayValue: string | null;
};

type CategoryChainItem = {
  id: string;
  primaryParameterId: string | null;
};

export async function getEffectivePartCategoryParameters({
  workspaceId,
  categoryId
}: {
  workspaceId: string;
  categoryId: string;
}) {
  const categoryChain = await getCategoryChain({ workspaceId, categoryId });
  const categoryIds = categoryChain.map((category) => category.id);
  const categoryParameters = await prisma.categoryParameter.findMany({
    where: {
      workspaceId,
      categoryId: {
        in: categoryIds
      }
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      categoryId: true,
      parameterId: true,
      sortOrder: true,
      defaultTextValue: true,
      defaultNumberValue: true,
      defaultQuantityBaseValue: true,
      defaultBooleanValue: true,
      defaultChoiceOptionId: true,
      defaultDisplayValue: true,
      parameter: {
        select: {
          id: true,
          name: true,
          description: true,
          type: true,
          baseUnitSymbol: true,
          choiceOptions: {
            orderBy: [{ sortOrder: "asc" }, { label: "asc" }, { id: "asc" }],
            select: {
              id: true,
              label: true,
              sortOrder: true
            }
          }
        }
      }
    }
  });
  return resolveEffectiveCategoryParameters({
    categoryChain,
    categoryParameters: categoryParameters.map((categoryParameter) => ({
      categoryId: categoryParameter.categoryId,
      parameterId: categoryParameter.parameterId,
      sortOrder: categoryParameter.sortOrder,
      defaultValue: getDefaultValue(categoryParameter),
      parameter: {
        id: categoryParameter.parameter.id,
        name: categoryParameter.parameter.name,
        description: categoryParameter.parameter.description,
        type: categoryParameter.parameter.type,
        baseUnitSymbol: categoryParameter.parameter.baseUnitSymbol,
        choiceOptions: categoryParameter.parameter.choiceOptions
      }
    }))
  });
}

export async function getPartParameterValuesOutsidePrimaryCategory({
  workspaceId,
  partId,
  primaryCategoryId
}: {
  workspaceId: string;
  partId: string;
  primaryCategoryId: string | null;
}) {
  const existingValues = await prisma.partParameterValue.findMany({
    where: {
      workspaceId,
      partId
    },
    select: {
      id: true,
      parameterId: true,
      displayValue: true,
      parameter: {
        select: {
          name: true
        }
      }
    },
    orderBy: [{ parameter: { name: "asc" } }, { id: "asc" }]
  });

  if (!primaryCategoryId) {
    return existingValues;
  }

  const effectiveParameters = await getEffectivePartCategoryParameters({
    workspaceId,
    categoryId: primaryCategoryId
  });
  const effectiveParameterIds = new Set(
    effectiveParameters.map((effectiveParameter) => effectiveParameter.parameter.id)
  );

  return existingValues.filter(
    (existingValue) => !effectiveParameterIds.has(existingValue.parameterId)
  );
}

export async function assertPrimaryParameterIsEffectiveForCategory({
  workspaceId,
  categoryId,
  parameterId
}: {
  workspaceId: string;
  categoryId: string;
  parameterId: string | null;
}) {
  if (!parameterId) {
    return;
  }

  const effectiveParameters = await getEffectivePartCategoryParameters({
    workspaceId,
    categoryId
  });
  const isEffective = effectiveParameters.some(
    (effectiveParameter) => effectiveParameter.parameter.id === parameterId
  );

  if (!isEffective) {
    throw new Error("primary_parameter_not_effective");
  }
}

export async function assertCanChangeParameterShape({
  workspaceId,
  parameterId
}: {
  workspaceId: string;
  parameterId: string;
}) {
  const partValueCount = await prisma.partParameterValue.count({
    where: {
      workspaceId,
      parameterId
    }
  });

  if (partValueCount > 0) {
    throw new Error("parameter_shape_in_use");
  }
}

export async function assertCanDeleteChoiceOption({
  optionId
}: {
  optionId: string;
}) {
  const [partValueCount, defaultValueCount] = await Promise.all([
    prisma.partParameterValue.count({
      where: {
        choiceOptionId: optionId
      }
    }),
    prisma.categoryParameter.count({
      where: {
        defaultChoiceOptionId: optionId
      }
    })
  ]);

  if (partValueCount > 0 || defaultValueCount > 0) {
    throw new Error("choice_option_in_use");
  }
}

export async function assertCanDeleteParameter({
  workspaceId,
  parameterId
}: {
  workspaceId: string;
  parameterId: string;
}) {
  const [
    categoryAttachmentCount,
    primaryCategoryCount,
    partValueCount
  ] = await Promise.all([
    prisma.categoryParameter.count({
      where: {
        workspaceId,
        parameterId
      }
    }),
    prisma.partCategory.count({
      where: {
        workspaceId,
        primaryParameterId: parameterId
      }
    }),
    prisma.partParameterValue.count({
      where: {
        workspaceId,
        parameterId
      }
    })
  ]);

  if (
    categoryAttachmentCount > 0 ||
    primaryCategoryCount > 0 ||
    partValueCount > 0
  ) {
    throw new Error("parameter_in_use");
  }
}

export async function assertCanDetachCategoryParameter({
  workspaceId,
  categoryId,
  parameterId
}: {
  workspaceId: string;
  categoryId: string;
  parameterId: string;
}) {
  const descendantCategoryIds = await getDescendantCategoryIds({
    workspaceId,
    categoryId
  });
  const [primaryCategoryCount, descendantOverrideCount, partValueCount] =
    await Promise.all([
      prisma.partCategory.count({
        where: {
          workspaceId,
          id: {
            in: descendantCategoryIds
          },
          primaryParameterId: parameterId
        }
      }),
      prisma.categoryParameter.count({
        where: {
          workspaceId,
          parameterId,
          categoryId: {
            in: descendantCategoryIds.filter(
              (descendantCategoryId) => descendantCategoryId !== categoryId
            )
          }
        }
      }),
      prisma.partParameterValue.count({
        where: {
          workspaceId,
          parameterId,
          part: {
            primaryCategoryId: {
              in: descendantCategoryIds
            }
          }
        }
      })
    ]);

  if (primaryCategoryCount > 0) {
    throw new Error("category_parameter_used_as_primary");
  }

  if (descendantOverrideCount > 0) {
    throw new Error("category_parameter_has_descendant_overrides");
  }

  if (partValueCount > 0) {
    throw new Error("category_parameter_has_part_values");
  }
}

async function getCategoryChain({
  workspaceId,
  categoryId
}: {
  workspaceId: string;
  categoryId: string;
}): Promise<CategoryChainItem[]> {
  const closures = await prisma.partCategoryClosure.findMany({
    where: {
      workspaceId,
      descendantId: categoryId
    },
    orderBy: {
      depth: "desc"
    },
    select: {
      ancestor: {
        select: {
          id: true,
          primaryParameterId: true
        }
      }
    }
  });

  if (closures.length === 0) {
    throw new Error("category_not_found");
  }

  return closures.map((closure) => closure.ancestor);
}

async function getDescendantCategoryIds({
  workspaceId,
  categoryId
}: {
  workspaceId: string;
  categoryId: string;
}) {
  const closures = await prisma.partCategoryClosure.findMany({
    where: {
      workspaceId,
      ancestorId: categoryId
    },
    select: {
      descendantId: true
    }
  });

  if (closures.length === 0) {
    throw new Error("category_not_found");
  }

  return closures.map((closure) => closure.descendantId);
}

function getDefaultValue(categoryParameter: {
  defaultTextValue: string | null;
  defaultNumberValue: unknown;
  defaultQuantityBaseValue: unknown;
  defaultBooleanValue: boolean | null;
  defaultChoiceOptionId: string | null;
  defaultDisplayValue: string | null;
}) {
  const hasDefaultValue =
    categoryParameter.defaultTextValue !== null ||
    categoryParameter.defaultNumberValue !== null ||
    categoryParameter.defaultQuantityBaseValue !== null ||
    categoryParameter.defaultBooleanValue !== null ||
    categoryParameter.defaultChoiceOptionId !== null ||
    categoryParameter.defaultDisplayValue !== null;

  if (!hasDefaultValue) {
    return null;
  }

  return {
    textValue: categoryParameter.defaultTextValue,
    numberValue:
      categoryParameter.defaultNumberValue === null
        ? null
        : String(categoryParameter.defaultNumberValue),
    quantityBaseValue:
      categoryParameter.defaultQuantityBaseValue === null
        ? null
        : String(categoryParameter.defaultQuantityBaseValue),
    booleanValue: categoryParameter.defaultBooleanValue,
    choiceOptionId: categoryParameter.defaultChoiceOptionId,
    displayValue: categoryParameter.defaultDisplayValue
  };
}
