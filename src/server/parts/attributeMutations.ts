import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import {
  decodeListCursor,
  encodeListCursor,
  getListPageSize,
  type ListPage
} from "@/server/pagination";
import {
  assertCanChangeAttributeShape,
  assertCanDeleteChoiceOption,
  assertCanDeleteAttribute,
  assertCanDetachCategoryAttribute,
  getEffectiveWorkspaceAttributes,
  assertValueAttributeIsEffectiveForCategory,
  getEffectivePartCategoryAttributes
} from "@/server/parts/attributes";
import {
  normalizeDictionaryName,
  parseAttributeValue,
  type AttributeValueType
} from "@/server/parts/attributeValues";

type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export type AttributeListItem = {
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

export type AttributeDefaultValueInput =
  | {
      rawValue: string;
    }
  | null;

export type AttributeChoiceOptionInput = {
  label: string;
  sortOrder: number;
};

export type AttributeChoiceOptionUpdateInput = AttributeChoiceOptionInput & {
  id?: string;
};

export async function getWorkspaceAttributes(workspaceId: string) {
  return prisma.attribute.findMany({
    where: {
      workspaceId
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: attributeListSelect
  });
}

export type AttributeListSortField = "name" | "type" | "baseUnit" | "description";

type AttributesOffsetCursor = {
  offset: number;
};

export async function getWorkspaceAttributePage({
  workspaceId,
  cursor,
  pageSize,
  sortBy = "name",
  sortDir = "asc"
}: {
  workspaceId: string;
  cursor?: string | null;
  pageSize?: number | null;
  sortBy?: AttributeListSortField;
  sortDir?: "asc" | "desc";
}): Promise<ListPage<AttributeListItem>> {
  const resolvedPageSize = getListPageSize(pageSize);
  const dir: Prisma.SortOrder = sortDir === "desc" ? "desc" : "asc";
  const offset = decodeListCursor<AttributesOffsetCursor>(cursor)?.offset ?? 0;
  const where: Prisma.AttributeWhereInput = { workspaceId };

  const [items, totalCount] = await Promise.all([
    prisma.attribute.findMany({
      where,
      orderBy: getAttributeOrderBy(sortBy, dir),
      skip: offset,
      take: resolvedPageSize,
      select: attributeListSelect
    }),
    prisma.attribute.count({ where })
  ]);
  const nextOffset = offset + items.length;

  return {
    items,
    nextCursor:
      nextOffset < totalCount
        ? encodeListCursor<AttributesOffsetCursor>({ offset: nextOffset })
        : null,
    totalCount,
    filteredCount: totalCount
  };
}

function getAttributeOrderBy(
  sortBy: AttributeListSortField,
  dir: Prisma.SortOrder
): Prisma.AttributeOrderByWithRelationInput[] {
  const tiebreak: Prisma.AttributeOrderByWithRelationInput = { id: dir };

  switch (sortBy) {
    case "type":
      return [{ type: dir }, tiebreak];
    // Nullable columns: keep empty values together at the end regardless of direction.
    case "baseUnit":
      return [{ baseUnitSymbol: { sort: dir, nulls: "last" } }, tiebreak];
    case "description":
      return [{ description: { sort: dir, nulls: "last" } }, tiebreak];
    default:
      return [{ name: dir }, tiebreak];
  }
}

export async function createAttribute({
  workspaceId,
  name,
  description,
  type,
  baseUnitSymbol,
  choiceOptions = []
}: {
  workspaceId: string;
  name: string;
  description?: string | null;
  type: AttributeValueType;
  baseUnitSymbol?: string | null;
  choiceOptions?: AttributeChoiceOptionInput[];
}) {
  const normalizedName = normalizeAttributeNameInput(name);
  const normalizedBaseUnitSymbol = normalizeBaseUnitSymbol({ type, baseUnitSymbol });
  const normalizedChoiceOptions =
    type === "CHOICE" ? normalizeChoiceOptionInputs(choiceOptions) : [];

  return prisma.$transaction(async (tx) => {
    const attribute = await tx.attribute.create({
      data: {
        workspaceId,
        name: name.trim(),
        normalizedName,
        description: normalizeOptionalText(description ?? null),
        type,
        baseUnitSymbol: normalizedBaseUnitSymbol
      },
      select: {
        id: true
      }
    });

    if (normalizedChoiceOptions.length > 0) {
      await tx.attributeChoiceOption.createMany({
        data: normalizedChoiceOptions.map((option) => ({
          attributeId: attribute.id,
          label: option.label,
          normalizedLabel: option.normalizedLabel,
          sortOrder: option.sortOrder
        }))
      });
    }

    return tx.attribute.findUniqueOrThrow({
      where: {
        id: attribute.id
      },
      select: attributeListSelect
    });
  });
}

export async function updateAttribute({
  workspaceId,
  attributeId,
  name,
  description,
  type,
  baseUnitSymbol,
  choiceOptions
}: {
  workspaceId: string;
  attributeId: string;
  name: string;
  description?: string | null;
  type: AttributeValueType;
  baseUnitSymbol?: string | null;
  choiceOptions?: AttributeChoiceOptionUpdateInput[];
}) {
  const existingAttribute = await prisma.attribute.findFirst({
    where: {
      id: attributeId,
      workspaceId
    },
    select: {
      id: true,
      type: true,
      baseUnitSymbol: true
    }
  });

  if (!existingAttribute) {
    throw new Error("attribute-not-found");
  }

  const normalizedBaseUnitSymbol = normalizeBaseUnitSymbol({ type, baseUnitSymbol });

  if (
    existingAttribute.type !== type ||
    existingAttribute.baseUnitSymbol !== normalizedBaseUnitSymbol
  ) {
    await assertCanChangeAttributeShape({ workspaceId, attributeId });
  }

  return prisma.$transaction(async (tx) => {
    await tx.attribute.update({
      where: {
        id: attributeId
      },
      data: {
        name: name.trim(),
        normalizedName: normalizeAttributeNameInput(name),
        description: normalizeOptionalText(description ?? null),
        type,
        baseUnitSymbol: normalizedBaseUnitSymbol
      }
    });

    if (type === "CHOICE" && choiceOptions) {
      await syncChoiceOptions({
        tx,
        attributeId,
        choiceOptions
      });
    }

    return tx.attribute.findUniqueOrThrow({
      where: {
        id: attributeId
      },
      select: attributeListSelect
    });
  });
}

export async function deleteAttribute({
  workspaceId,
  attributeId
}: {
  workspaceId: string;
  attributeId: string;
}) {
  await assertCanDeleteAttribute({ workspaceId, attributeId });

  await prisma.attribute.deleteMany({
    where: {
      id: attributeId,
      workspaceId
    }
  });
}

export async function createChoiceOption({
  workspaceId,
  attributeId,
  label,
  sortOrder
}: {
  workspaceId: string;
  attributeId: string;
  label: string;
  sortOrder: number;
}) {
  await assertChoiceAttribute({ workspaceId, attributeId });

  return prisma.attributeChoiceOption.create({
    data: {
      attributeId,
      label: normalizeChoiceLabelInput(label),
      normalizedLabel: normalizeDictionaryName(label),
      sortOrder
    },
    select: choiceOptionSelect
  });
}

export async function updateChoiceOption({
  workspaceId,
  optionId,
  label,
  sortOrder
}: {
  workspaceId: string;
  optionId: string;
  label: string;
  sortOrder: number;
}) {
  const option = await getChoiceOptionInWorkspace({ workspaceId, optionId });

  return prisma.attributeChoiceOption.update({
    where: {
      id: option.id
    },
    data: {
      label: normalizeChoiceLabelInput(label),
      normalizedLabel: normalizeDictionaryName(label),
      sortOrder
    },
    select: choiceOptionSelect
  });
}

export async function deleteChoiceOption({
  workspaceId,
  optionId
}: {
  workspaceId: string;
  optionId: string;
}) {
  const option = await getChoiceOptionInWorkspace({ workspaceId, optionId });

  await assertCanDeleteChoiceOption({ optionId: option.id });
  await prisma.attributeChoiceOption.delete({
    where: {
      id: option.id
    }
  });
}

export async function attachOrOverrideCategoryAttribute({
  workspaceId,
  categoryId,
  attributeId,
  sortOrder,
  defaultValue,
  isPrimary
}: {
  workspaceId: string;
  categoryId: string;
  attributeId: string;
  sortOrder: number;
  defaultValue: AttributeDefaultValueInput;
  isPrimary: boolean;
}) {
  const [category, attribute] = await Promise.all([
    getCategoryInWorkspace({ workspaceId, categoryId }),
    getAttributeForDefaultParsing({ workspaceId, attributeId })
  ]);
  const defaultValueData = getCategoryAttributeDefaultData({
    attribute,
    defaultValue
  });

  return prisma.categoryAttribute.upsert({
    where: {
      categoryId_attributeId: {
        categoryId: category.id,
        attributeId: attribute.id
      }
    },
    create: {
      workspaceId,
      categoryId: category.id,
      attributeId: attribute.id,
      sortOrder,
      isPrimary,
      ...defaultValueData
    },
    update: {
      sortOrder,
      isPrimary,
      ...defaultValueData
    }
  });
}

export async function detachCategoryAttribute({
  workspaceId,
  categoryId,
  attributeId
}: {
  workspaceId: string;
  categoryId: string;
  attributeId: string;
}) {
  await assertCanDetachCategoryAttribute({
    workspaceId,
    categoryId,
    attributeId
  });

  await prisma.categoryAttribute.deleteMany({
    where: {
      workspaceId,
      categoryId,
      attributeId
    }
  });
}

export async function setCategoryValueAttribute({
  workspaceId,
  categoryId,
  attributeId
}: {
  workspaceId: string;
  categoryId: string;
  attributeId: string | null;
}) {
  const category = await getCategoryInWorkspace({ workspaceId, categoryId });

  if (attributeId) {
    await assertValueAttributeIsEffectiveForCategory({
      workspaceId,
      categoryId: category.id,
      attributeId
    });
  }

  return prisma.partCategory.update({
    where: {
      id: category.id
    },
    data: {
      valueAttributeId: attributeId
    }
  });
}

export async function getEffectiveCategoryAttributeConfiguration({
  workspaceId,
  categoryId
}: {
  workspaceId: string;
  categoryId: string;
}) {
  await getCategoryInWorkspace({ workspaceId, categoryId });

  return getEffectivePartCategoryAttributes({ workspaceId, categoryId });
}

export async function attachOrOverrideWorkspaceAttribute({
  workspaceId,
  attributeId,
  sortOrder,
  defaultValue,
  isPrimary
}: {
  workspaceId: string;
  attributeId: string;
  sortOrder: number;
  defaultValue: AttributeDefaultValueInput;
  isPrimary: boolean;
}) {
  const attribute = await getAttributeForDefaultParsing({ workspaceId, attributeId });
  const defaultValueData = getCategoryAttributeDefaultData({
    attribute,
    defaultValue
  });

  return prisma.workspaceAttribute.upsert({
    where: {
      workspaceId_attributeId: {
        workspaceId,
        attributeId: attribute.id
      }
    },
    create: {
      workspaceId,
      attributeId: attribute.id,
      sortOrder,
      isPrimary,
      ...defaultValueData
    },
    update: {
      sortOrder,
      isPrimary,
      ...defaultValueData
    }
  });
}

export async function detachWorkspaceAttribute({
  workspaceId,
  attributeId
}: {
  workspaceId: string;
  attributeId: string;
}) {
  await prisma.workspaceAttribute.deleteMany({
    where: {
      workspaceId,
      attributeId
    }
  });
}

export async function getEffectiveWorkspaceAttributeConfiguration({
  workspaceId
}: {
  workspaceId: string;
}) {
  return getEffectiveWorkspaceAttributes({ workspaceId });
}

function getCategoryAttributeDefaultData({
  attribute,
  defaultValue
}: {
  attribute: Awaited<ReturnType<typeof getAttributeForDefaultParsing>>;
  defaultValue: AttributeDefaultValueInput;
}) {
  const emptyDefault = {
    defaultTextValue: null,
    defaultNumberValue: null,
    defaultQuantityBaseValue: null,
    defaultBooleanValue: null,
    defaultChoiceOptionId: null,
    defaultDisplayValue: null
  };

  if (!defaultValue) {
    return emptyDefault;
  }

  const parsedValue = parseAttributeValue({
    type: attribute.type,
    rawValue: defaultValue.rawValue,
    baseUnitSymbol: attribute.baseUnitSymbol,
    choiceOptions: attribute.choiceOptions
  });

  switch (parsedValue.type) {
    case "TEXT":
      return {
        ...emptyDefault,
        defaultTextValue: parsedValue.textValue,
        defaultDisplayValue: parsedValue.displayValue
      };
    case "NUMBER":
      return {
        ...emptyDefault,
        defaultNumberValue: new Prisma.Decimal(parsedValue.numberValue),
        defaultDisplayValue: parsedValue.displayValue
      };
    case "QUANTITY":
      return {
        ...emptyDefault,
        defaultQuantityBaseValue: new Prisma.Decimal(parsedValue.quantityBaseValue),
        defaultDisplayValue: parsedValue.displayValue
      };
    case "BOOLEAN":
      return {
        ...emptyDefault,
        defaultBooleanValue: parsedValue.booleanValue,
        defaultDisplayValue: parsedValue.displayValue
      };
    case "CHOICE":
      return {
        ...emptyDefault,
        defaultChoiceOptionId: parsedValue.choiceOptionId,
        defaultDisplayValue: parsedValue.displayValue
      };
  }
}

async function getAttributeForDefaultParsing({
  workspaceId,
  attributeId
}: {
  workspaceId: string;
  attributeId: string;
}) {
  const attribute = await prisma.attribute.findFirst({
    where: {
      id: attributeId,
      workspaceId
    },
    select: {
      id: true,
      type: true,
      baseUnitSymbol: true,
      choiceOptions: {
        select: {
          id: true,
          label: true
        }
      }
    }
  });

  if (!attribute) {
    throw new Error("attribute-not-found");
  }

  return attribute;
}

async function assertChoiceAttribute({
  workspaceId,
  attributeId
}: {
  workspaceId: string;
  attributeId: string;
}) {
  const attribute = await prisma.attribute.findFirst({
    where: {
      id: attributeId,
      workspaceId,
      type: "CHOICE"
    },
    select: {
      id: true
    }
  });

  if (!attribute) {
    throw new Error("choice_attribute-not-found");
  }
}

async function getChoiceOptionInWorkspace({
  workspaceId,
  optionId
}: {
  workspaceId: string;
  optionId: string;
}) {
  const option = await prisma.attributeChoiceOption.findFirst({
    where: {
      id: optionId,
      attribute: {
        workspaceId
      }
    },
    select: {
      id: true
    }
  });

  if (!option) {
    throw new Error("choice-option-not-found");
  }

  return option;
}

async function getCategoryInWorkspace({
  workspaceId,
  categoryId
}: {
  workspaceId: string;
  categoryId: string;
}) {
  const category = await prisma.partCategory.findFirst({
    where: {
      id: categoryId,
      workspaceId
    },
    select: {
      id: true
    }
  });

  if (!category) {
    throw new Error("category-not-found");
  }

  return category;
}

function normalizeAttributeNameInput(name: string) {
  const normalizedName = normalizeDictionaryName(name);

  if (!normalizedName) {
    throw new Error("attribute-name-required");
  }

  return normalizedName;
}

function normalizeChoiceLabelInput(label: string) {
  const normalizedLabel = label.trim().replace(/\s+/g, " ");

  if (!normalizedLabel) {
    throw new Error("choice-option-label-required");
  }

  return normalizedLabel;
}

function normalizeChoiceOptionInputs(options: AttributeChoiceOptionInput[]) {
  const normalizedOptions = options
    .map((option) => ({
      label: normalizeChoiceLabelInput(option.label),
      normalizedLabel: normalizeDictionaryName(option.label),
      sortOrder: option.sortOrder
    }))
    .filter((option) => option.label);
  const seenLabels = new Set<string>();

  for (const option of normalizedOptions) {
    if (seenLabels.has(option.normalizedLabel)) {
      throw new Error("duplicate-choice-option");
    }

    seenLabels.add(option.normalizedLabel);
  }

  return normalizedOptions;
}

async function syncChoiceOptions({
  tx,
  attributeId,
  choiceOptions
}: {
  tx: PrismaTransaction;
  attributeId: string;
  choiceOptions: AttributeChoiceOptionUpdateInput[];
}) {
  const normalizedChoiceOptions = normalizeChoiceOptionInputs(choiceOptions);
  const existingOptions = await tx.attributeChoiceOption.findMany({
    where: {
      attributeId
    },
    select: {
      id: true
    }
  });
  const existingOptionIds = new Set(
    existingOptions.map((existingOption) => existingOption.id)
  );
  const submittedOptionIds = new Set(
    choiceOptions
      .map((choiceOption) => choiceOption.id)
      .filter((id): id is string => Boolean(id))
  );
  const deletedOptionIds = existingOptions
    .map((existingOption) => existingOption.id)
    .filter((optionId) => !submittedOptionIds.has(optionId));

  for (const submittedOptionId of submittedOptionIds) {
    if (!existingOptionIds.has(submittedOptionId)) {
      throw new Error("choice-option-not-found");
    }
  }

  for (const deletedOptionId of deletedOptionIds) {
    await assertCanDeleteChoiceOption({ optionId: deletedOptionId });
  }

  for (const deletedOptionId of deletedOptionIds) {
    await tx.attributeChoiceOption.delete({
      where: {
        id: deletedOptionId
      }
    });
  }

  for (const [index, option] of normalizedChoiceOptions.entries()) {
    const optionId = choiceOptions[index]?.id;

    if (optionId) {
      await tx.attributeChoiceOption.update({
        where: {
          id: optionId
        },
        data: {
          label: option.label,
          normalizedLabel: option.normalizedLabel,
          sortOrder: option.sortOrder
        }
      });
    } else {
      await tx.attributeChoiceOption.create({
        data: {
          attributeId,
          label: option.label,
          normalizedLabel: option.normalizedLabel,
          sortOrder: option.sortOrder
        }
      });
    }
  }
}

function normalizeOptionalText(value: string | null) {
  const normalizedValue = value?.trim().replace(/\s+/g, " ") ?? "";

  return normalizedValue || null;
}

function normalizeBaseUnitSymbol({
  type,
  baseUnitSymbol
}: {
  type: AttributeValueType;
  baseUnitSymbol?: string | null;
}) {
  const normalizedBaseUnitSymbol = baseUnitSymbol?.trim() || null;

  if (type !== "QUANTITY") {
    return null;
  }

  if (!normalizedBaseUnitSymbol) {
    throw new Error("quantity-unit-required");
  }

  return normalizedBaseUnitSymbol === "ohm" ? "Ω" : normalizedBaseUnitSymbol;
}

const choiceOptionSelect = {
  id: true,
  label: true,
  sortOrder: true
} satisfies Prisma.AttributeChoiceOptionSelect;

const attributeListSelect = {
  id: true,
  name: true,
  description: true,
  type: true,
  baseUnitSymbol: true,
  choiceOptions: {
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }, { id: "asc" }],
    select: choiceOptionSelect
  }
} satisfies Prisma.AttributeSelect;
