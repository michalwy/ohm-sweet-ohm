import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import {
  assertCanChangeParameterShape,
  assertCanDeleteChoiceOption,
  assertCanDeleteParameter,
  assertCanDetachCategoryParameter,
  assertValueParameterIsEffectiveForCategory,
  getEffectivePartCategoryParameters
} from "@/server/parts/parameters";
import {
  normalizeDictionaryName,
  parseParameterValue,
  type ParameterValueType
} from "@/server/parts/parameterValues";

type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export type ParameterListItem = {
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

export type ParameterDefaultValueInput =
  | {
      rawValue: string;
    }
  | null;

export type ParameterChoiceOptionInput = {
  label: string;
  sortOrder: number;
};

export type ParameterChoiceOptionUpdateInput = ParameterChoiceOptionInput & {
  id?: string;
};

export async function getWorkspaceParameters(workspaceId: string) {
  return prisma.parameter.findMany({
    where: {
      workspaceId
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: parameterListSelect
  });
}

export async function createParameter({
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
  type: ParameterValueType;
  baseUnitSymbol?: string | null;
  choiceOptions?: ParameterChoiceOptionInput[];
}) {
  const normalizedName = normalizeParameterNameInput(name);
  const normalizedBaseUnitSymbol = normalizeBaseUnitSymbol({ type, baseUnitSymbol });
  const normalizedChoiceOptions =
    type === "CHOICE" ? normalizeChoiceOptionInputs(choiceOptions) : [];

  return prisma.$transaction(async (tx) => {
    const parameter = await tx.parameter.create({
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
      await tx.parameterChoiceOption.createMany({
        data: normalizedChoiceOptions.map((option) => ({
          parameterId: parameter.id,
          label: option.label,
          normalizedLabel: option.normalizedLabel,
          sortOrder: option.sortOrder
        }))
      });
    }

    return tx.parameter.findUniqueOrThrow({
      where: {
        id: parameter.id
      },
      select: parameterListSelect
    });
  });
}

export async function updateParameter({
  workspaceId,
  parameterId,
  name,
  description,
  type,
  baseUnitSymbol,
  choiceOptions
}: {
  workspaceId: string;
  parameterId: string;
  name: string;
  description?: string | null;
  type: ParameterValueType;
  baseUnitSymbol?: string | null;
  choiceOptions?: ParameterChoiceOptionUpdateInput[];
}) {
  const existingParameter = await prisma.parameter.findFirst({
    where: {
      id: parameterId,
      workspaceId
    },
    select: {
      id: true,
      type: true,
      baseUnitSymbol: true
    }
  });

  if (!existingParameter) {
    throw new Error("parameter_not_found");
  }

  const normalizedBaseUnitSymbol = normalizeBaseUnitSymbol({ type, baseUnitSymbol });

  if (
    existingParameter.type !== type ||
    existingParameter.baseUnitSymbol !== normalizedBaseUnitSymbol
  ) {
    await assertCanChangeParameterShape({ workspaceId, parameterId });
  }

  return prisma.$transaction(async (tx) => {
    await tx.parameter.update({
      where: {
        id: parameterId
      },
      data: {
        name: name.trim(),
        normalizedName: normalizeParameterNameInput(name),
        description: normalizeOptionalText(description ?? null),
        type,
        baseUnitSymbol: normalizedBaseUnitSymbol
      }
    });

    if (type === "CHOICE" && choiceOptions) {
      await syncChoiceOptions({
        tx,
        parameterId,
        choiceOptions
      });
    }

    return tx.parameter.findUniqueOrThrow({
      where: {
        id: parameterId
      },
      select: parameterListSelect
    });
  });
}

export async function deleteParameter({
  workspaceId,
  parameterId
}: {
  workspaceId: string;
  parameterId: string;
}) {
  await assertCanDeleteParameter({ workspaceId, parameterId });

  await prisma.parameter.deleteMany({
    where: {
      id: parameterId,
      workspaceId
    }
  });
}

export async function createChoiceOption({
  workspaceId,
  parameterId,
  label,
  sortOrder
}: {
  workspaceId: string;
  parameterId: string;
  label: string;
  sortOrder: number;
}) {
  await assertChoiceParameter({ workspaceId, parameterId });

  return prisma.parameterChoiceOption.create({
    data: {
      parameterId,
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

  return prisma.parameterChoiceOption.update({
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
  await prisma.parameterChoiceOption.delete({
    where: {
      id: option.id
    }
  });
}

export async function attachOrOverrideCategoryParameter({
  workspaceId,
  categoryId,
  parameterId,
  sortOrder,
  defaultValue,
  isPrimary
}: {
  workspaceId: string;
  categoryId: string;
  parameterId: string;
  sortOrder: number;
  defaultValue: ParameterDefaultValueInput;
  isPrimary: boolean;
}) {
  const [category, parameter] = await Promise.all([
    getCategoryInWorkspace({ workspaceId, categoryId }),
    getParameterForDefaultParsing({ workspaceId, parameterId })
  ]);
  const defaultValueData = getCategoryParameterDefaultData({
    parameter,
    defaultValue
  });

  return prisma.categoryParameter.upsert({
    where: {
      categoryId_parameterId: {
        categoryId: category.id,
        parameterId: parameter.id
      }
    },
    create: {
      workspaceId,
      categoryId: category.id,
      parameterId: parameter.id,
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

export async function detachCategoryParameter({
  workspaceId,
  categoryId,
  parameterId
}: {
  workspaceId: string;
  categoryId: string;
  parameterId: string;
}) {
  await assertCanDetachCategoryParameter({
    workspaceId,
    categoryId,
    parameterId
  });

  await prisma.categoryParameter.deleteMany({
    where: {
      workspaceId,
      categoryId,
      parameterId
    }
  });
}

export async function setCategoryValueParameter({
  workspaceId,
  categoryId,
  parameterId
}: {
  workspaceId: string;
  categoryId: string;
  parameterId: string | null;
}) {
  const category = await getCategoryInWorkspace({ workspaceId, categoryId });

  if (parameterId) {
    await assertValueParameterIsEffectiveForCategory({
      workspaceId,
      categoryId: category.id,
      parameterId
    });
  }

  return prisma.partCategory.update({
    where: {
      id: category.id
    },
    data: {
      valueParameterId: parameterId
    }
  });
}

export async function getEffectiveCategoryParameterConfiguration({
  workspaceId,
  categoryId
}: {
  workspaceId: string;
  categoryId: string;
}) {
  await getCategoryInWorkspace({ workspaceId, categoryId });

  return getEffectivePartCategoryParameters({ workspaceId, categoryId });
}

function getCategoryParameterDefaultData({
  parameter,
  defaultValue
}: {
  parameter: Awaited<ReturnType<typeof getParameterForDefaultParsing>>;
  defaultValue: ParameterDefaultValueInput;
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

  const parsedValue = parseParameterValue({
    type: parameter.type,
    rawValue: defaultValue.rawValue,
    baseUnitSymbol: parameter.baseUnitSymbol,
    choiceOptions: parameter.choiceOptions
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

async function getParameterForDefaultParsing({
  workspaceId,
  parameterId
}: {
  workspaceId: string;
  parameterId: string;
}) {
  const parameter = await prisma.parameter.findFirst({
    where: {
      id: parameterId,
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

  if (!parameter) {
    throw new Error("parameter_not_found");
  }

  return parameter;
}

async function assertChoiceParameter({
  workspaceId,
  parameterId
}: {
  workspaceId: string;
  parameterId: string;
}) {
  const parameter = await prisma.parameter.findFirst({
    where: {
      id: parameterId,
      workspaceId,
      type: "CHOICE"
    },
    select: {
      id: true
    }
  });

  if (!parameter) {
    throw new Error("choice_parameter_not_found");
  }
}

async function getChoiceOptionInWorkspace({
  workspaceId,
  optionId
}: {
  workspaceId: string;
  optionId: string;
}) {
  const option = await prisma.parameterChoiceOption.findFirst({
    where: {
      id: optionId,
      parameter: {
        workspaceId
      }
    },
    select: {
      id: true
    }
  });

  if (!option) {
    throw new Error("choice_option_not_found");
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
    throw new Error("category_not_found");
  }

  return category;
}

function normalizeParameterNameInput(name: string) {
  const normalizedName = normalizeDictionaryName(name);

  if (!normalizedName) {
    throw new Error("parameter_name_required");
  }

  return normalizedName;
}

function normalizeChoiceLabelInput(label: string) {
  const normalizedLabel = label.trim().replace(/\s+/g, " ");

  if (!normalizedLabel) {
    throw new Error("choice_option_label_required");
  }

  return normalizedLabel;
}

function normalizeChoiceOptionInputs(options: ParameterChoiceOptionInput[]) {
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
      throw new Error("duplicate_choice_option");
    }

    seenLabels.add(option.normalizedLabel);
  }

  return normalizedOptions;
}

async function syncChoiceOptions({
  tx,
  parameterId,
  choiceOptions
}: {
  tx: PrismaTransaction;
  parameterId: string;
  choiceOptions: ParameterChoiceOptionUpdateInput[];
}) {
  const normalizedChoiceOptions = normalizeChoiceOptionInputs(choiceOptions);
  const existingOptions = await tx.parameterChoiceOption.findMany({
    where: {
      parameterId
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
      throw new Error("choice_option_not_found");
    }
  }

  for (const deletedOptionId of deletedOptionIds) {
    await assertCanDeleteChoiceOption({ optionId: deletedOptionId });
  }

  for (const deletedOptionId of deletedOptionIds) {
    await tx.parameterChoiceOption.delete({
      where: {
        id: deletedOptionId
      }
    });
  }

  for (const [index, option] of normalizedChoiceOptions.entries()) {
    const optionId = choiceOptions[index]?.id;

    if (optionId) {
      await tx.parameterChoiceOption.update({
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
      await tx.parameterChoiceOption.create({
        data: {
          parameterId,
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
  type: ParameterValueType;
  baseUnitSymbol?: string | null;
}) {
  const normalizedBaseUnitSymbol = baseUnitSymbol?.trim() || null;

  if (type !== "QUANTITY") {
    return null;
  }

  if (!normalizedBaseUnitSymbol) {
    throw new Error("quantity_unit_required");
  }

  return normalizedBaseUnitSymbol === "ohm" ? "Ω" : normalizedBaseUnitSymbol;
}

const choiceOptionSelect = {
  id: true,
  label: true,
  sortOrder: true
} satisfies Prisma.ParameterChoiceOptionSelect;

const parameterListSelect = {
  id: true,
  name: true,
  description: true,
  type: true,
  baseUnitSymbol: true,
  choiceOptions: {
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }, { id: "asc" }],
    select: choiceOptionSelect
  }
} satisfies Prisma.ParameterSelect;
