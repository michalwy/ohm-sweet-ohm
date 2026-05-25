import "server-only";

import { prisma } from "@/server/db/prisma";
import { WORKSPACE_ATTRIBUTE_SOURCE_ID } from "@/lib/part-attribute-sources";
import { resolveEffectiveCategoryAttributes } from "@/server/parts/attributeInheritance";
import type { AttributeValueType } from "@/server/parts/attributeValues";

export type EffectiveCategoryAttribute = {
  attribute: {
    id: string;
    name: string;
    description: string | null;
    type: AttributeValueType;
    baseUnitSymbol: string | null;
    choiceOptions: Array<{
      id: string;
      label: string;
      sortOrder: number;
    }>;
  };
  sourceCategoryId: string;
  sortOrder: number;
  defaultValue: EffectiveAttributeDefaultValue | null;
  isValue: boolean;
  isPrimary: boolean;
  inheritedAttribute: EffectiveCategoryAttribute | null;
};

export type EffectiveAttributeDefaultValue = {
  textValue: string | null;
  numberValue: string | null;
  quantityBaseValue: string | null;
  booleanValue: boolean | null;
  choiceOptionId: string | null;
  displayValue: string | null;
};

type CategoryChainItem = {
  id: string;
  valueAttributeId: string | null;
};

export async function getEffectivePartCategoryAttributes({
  workspaceId,
  categoryId
}: {
  workspaceId: string;
  categoryId: string;
}) {
  const categoryChain = await getCategoryChain({ workspaceId, categoryId });
  const categoryIds = categoryChain.map((category) => category.id);
  const [categoryAttributes, workspaceAttributes] = await Promise.all([
    prisma.categoryAttribute.findMany({
      where: {
        workspaceId,
        categoryId: {
          in: categoryIds
        }
      },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        categoryId: true,
        attributeId: true,
        sortOrder: true,
        isPrimary: true,
        defaultTextValue: true,
        defaultNumberValue: true,
        defaultQuantityBaseValue: true,
        defaultBooleanValue: true,
        defaultChoiceOptionId: true,
        defaultDisplayValue: true,
        attribute: {
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
    }),
    prisma.workspaceAttribute.findMany({
      where: {
        workspaceId
      },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        attributeId: true,
        sortOrder: true,
        isPrimary: true,
        defaultTextValue: true,
        defaultNumberValue: true,
        defaultQuantityBaseValue: true,
        defaultBooleanValue: true,
        defaultChoiceOptionId: true,
        defaultDisplayValue: true,
        attribute: {
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
    })
  ]);

  const effectiveCategoryChain = [
    { id: WORKSPACE_ATTRIBUTE_SOURCE_ID, valueAttributeId: null },
    ...categoryChain
  ];

  return resolveEffectiveCategoryAttributes({
    categoryChain: effectiveCategoryChain,
    categoryAttributes: [
      ...workspaceAttributes.map((workspaceAttribute) => ({
        categoryId: WORKSPACE_ATTRIBUTE_SOURCE_ID,
        attributeId: workspaceAttribute.attributeId,
        sortOrder: workspaceAttribute.sortOrder,
        isPrimary: workspaceAttribute.isPrimary,
        defaultValue: getDefaultValue(workspaceAttribute),
        attribute: {
          id: workspaceAttribute.attribute.id,
          name: workspaceAttribute.attribute.name,
          description: workspaceAttribute.attribute.description,
          type: workspaceAttribute.attribute.type,
          baseUnitSymbol: workspaceAttribute.attribute.baseUnitSymbol,
          choiceOptions: workspaceAttribute.attribute.choiceOptions
        }
      })),
      ...categoryAttributes.map((categoryAttribute) => ({
        categoryId: categoryAttribute.categoryId,
        attributeId: categoryAttribute.attributeId,
        sortOrder: categoryAttribute.sortOrder,
        isPrimary: categoryAttribute.isPrimary,
        defaultValue: getDefaultValue(categoryAttribute),
        attribute: {
          id: categoryAttribute.attribute.id,
          name: categoryAttribute.attribute.name,
          description: categoryAttribute.attribute.description,
          type: categoryAttribute.attribute.type,
          baseUnitSymbol: categoryAttribute.attribute.baseUnitSymbol,
          choiceOptions: categoryAttribute.attribute.choiceOptions
        }
      }))
    ]
  });
}

export async function getEffectiveWorkspaceAttributes({
  workspaceId
}: {
  workspaceId: string;
}) {
  const workspaceAttributes = await prisma.workspaceAttribute.findMany({
    where: {
      workspaceId
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      attributeId: true,
      sortOrder: true,
      isPrimary: true,
      defaultTextValue: true,
      defaultNumberValue: true,
      defaultQuantityBaseValue: true,
      defaultBooleanValue: true,
      defaultChoiceOptionId: true,
      defaultDisplayValue: true,
      attribute: {
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

  return resolveEffectiveCategoryAttributes({
    categoryChain: [{ id: WORKSPACE_ATTRIBUTE_SOURCE_ID, valueAttributeId: null }],
    categoryAttributes: workspaceAttributes.map((workspaceAttribute) => ({
      categoryId: WORKSPACE_ATTRIBUTE_SOURCE_ID,
      attributeId: workspaceAttribute.attributeId,
      sortOrder: workspaceAttribute.sortOrder,
      isPrimary: workspaceAttribute.isPrimary,
      defaultValue: getDefaultValue(workspaceAttribute),
      attribute: {
        id: workspaceAttribute.attribute.id,
        name: workspaceAttribute.attribute.name,
        description: workspaceAttribute.attribute.description,
        type: workspaceAttribute.attribute.type,
        baseUnitSymbol: workspaceAttribute.attribute.baseUnitSymbol,
        choiceOptions: workspaceAttribute.attribute.choiceOptions
      }
    }))
  });
}

export async function assertValueAttributeIsEffectiveForCategory({
  workspaceId,
  categoryId,
  attributeId
}: {
  workspaceId: string;
  categoryId: string;
  attributeId: string | null;
}) {
  if (!attributeId) {
    return;
  }

  const effectiveAttributes = await getEffectivePartCategoryAttributes({
    workspaceId,
    categoryId
  });
  const isEffective = effectiveAttributes.some(
    (effectiveAttribute) => effectiveAttribute.attribute.id === attributeId
  );

  if (!isEffective) {
    throw new Error("primary_attribute_not_effective");
  }
}

export async function assertCanChangeAttributeShape({
  workspaceId,
  attributeId
}: {
  workspaceId: string;
  attributeId: string;
}) {
  const partValueCount = await prisma.partAttributeValue.count({
    where: {
      workspaceId,
      attributeId
    }
  });

  if (partValueCount > 0) {
    throw new Error("attribute_shape_in_use");
  }
}

export async function assertCanDeleteChoiceOption({
  optionId
}: {
  optionId: string;
}) {
  const [
    partValueCount,
    categoryDefaultValueCount,
    workspaceDefaultValueCount
  ] = await Promise.all([
    prisma.partAttributeValue.count({
      where: {
        choiceOptionId: optionId
      }
    }),
    prisma.categoryAttribute.count({
      where: {
        defaultChoiceOptionId: optionId
      }
    }),
    prisma.workspaceAttribute.count({
      where: {
        defaultChoiceOptionId: optionId
      }
    })
  ]);

  if (
    partValueCount > 0 ||
    categoryDefaultValueCount > 0 ||
    workspaceDefaultValueCount > 0
  ) {
    throw new Error("choice_option_in_use");
  }
}

export async function assertCanDeleteAttribute({
  workspaceId,
  attributeId
}: {
  workspaceId: string;
  attributeId: string;
}) {
  const [
    categoryAttachmentCount,
    workspaceAttachmentCount,
    valueCategoryCount,
    partValueCount
  ] = await Promise.all([
    prisma.categoryAttribute.count({
      where: {
        workspaceId,
        attributeId
      }
    }),
    prisma.workspaceAttribute.count({
      where: {
        workspaceId,
        attributeId
      }
    }),
    prisma.partCategory.count({
      where: {
        workspaceId,
        valueAttributeId: attributeId
      }
    }),
    prisma.partAttributeValue.count({
      where: {
        workspaceId,
        attributeId
      }
    })
  ]);

  if (
    categoryAttachmentCount > 0 ||
    workspaceAttachmentCount > 0 ||
    valueCategoryCount > 0 ||
    partValueCount > 0
  ) {
    throw new Error("attribute_in_use");
  }
}

export async function assertCanDetachCategoryAttribute({
  workspaceId,
  categoryId,
  attributeId: _attributeId
}: {
  workspaceId: string;
  categoryId: string;
  attributeId: string;
}) {
  void _attributeId;

  const category = await prisma.partCategory.findFirst({
    where: {
      workspaceId,
      id: categoryId
    },
    select: {
      id: true
    }
  });

  if (!category) {
    throw new Error("category_not_found");
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
          valueAttributeId: true
        }
      }
    }
  });

  if (closures.length === 0) {
    throw new Error("category_not_found");
  }

  return closures.map((closure) => closure.ancestor);
}

function getDefaultValue(categoryAttribute: {
  defaultTextValue: string | null;
  defaultNumberValue: unknown;
  defaultQuantityBaseValue: unknown;
  defaultBooleanValue: boolean | null;
  defaultChoiceOptionId: string | null;
  defaultDisplayValue: string | null;
}) {
  const hasDefaultValue =
    categoryAttribute.defaultTextValue !== null ||
    categoryAttribute.defaultNumberValue !== null ||
    categoryAttribute.defaultQuantityBaseValue !== null ||
    categoryAttribute.defaultBooleanValue !== null ||
    categoryAttribute.defaultChoiceOptionId !== null ||
    categoryAttribute.defaultDisplayValue !== null;

  if (!hasDefaultValue) {
    return null;
  }

  return {
    textValue: categoryAttribute.defaultTextValue,
    numberValue:
      categoryAttribute.defaultNumberValue === null
        ? null
        : String(categoryAttribute.defaultNumberValue),
    quantityBaseValue:
      categoryAttribute.defaultQuantityBaseValue === null
        ? null
        : String(categoryAttribute.defaultQuantityBaseValue),
    booleanValue: categoryAttribute.defaultBooleanValue,
    choiceOptionId: categoryAttribute.defaultChoiceOptionId,
    displayValue: categoryAttribute.defaultDisplayValue
  };
}
