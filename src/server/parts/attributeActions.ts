"use server";


import { getAuthorizedSessionActor } from "@/server/auth/currentActor";
import {
  attachOrOverrideCategoryAttribute,
  createChoiceOption,
  createAttribute,
  deleteChoiceOption,
  deleteAttribute,
  detachCategoryAttribute,
  getEffectiveCategoryAttributeConfiguration,
  getEffectiveWorkspaceAttributeConfiguration,
  getWorkspaceAttributePage,
  getWorkspaceAttributes,
  saveCategoryAttributeConfiguration,
  saveWorkspaceAttributeConfiguration,
  setCategoryValueAttribute,
  updateChoiceOption,
  updateAttribute,
  type AttributeChoiceOptionInput,
  type AttributeConfigurationEntry,
  type AttributeChoiceOptionUpdateInput,
  type AttributeDefaultValueInput,
  type AttributeListItem,
  type AttributeListSortField
} from "@/server/parts/attributeMutations";
import type { EffectiveCategoryAttribute } from "@/server/parts/attributes";
import type { AttributeValueType } from "@/server/parts/attributeValues";
import type { ListPage } from "@/server/pagination";

export type AttributeActionResult<T> =
  | {
      ok: true;
      data: T;
      submittedAt: number;
    }
  | {
      ok: false;
      error: string;
      submittedAt: number;
    };

export async function getAttributeDictionaryForWorkspace(
  workspaceSlug: string
): Promise<AttributeActionResult<AttributeListItem[]>> {
  try {
    const context = await getAuthorizedAttributeContext({
      workspaceSlug,
      permission: "attributes:read"
    });

    return getSuccessState(await getWorkspaceAttributes(context.workspace.id));
  } catch (error) {
    return getErrorState(getAttributeActionError(error));
  }
}

export async function getAttributeDictionaryPageForWorkspace(input: {
  workspaceSlug: string;
  cursor?: string | null;
  pageSize?: number | null;
  sortBy?: AttributeListSortField;
  sortDir?: "asc" | "desc";
}): Promise<AttributeActionResult<ListPage<AttributeListItem>>> {
  try {
    const context = await getAuthorizedAttributeContext({
      workspaceSlug: input.workspaceSlug,
      permission: "attributes:read"
    });

    return getSuccessState(
      await getWorkspaceAttributePage({
        workspaceId: context.workspace.id,
        cursor: input.cursor,
        pageSize: input.pageSize,
        sortBy: input.sortBy,
        sortDir: input.sortDir
      })
    );
  } catch (error) {
    return getErrorState(getAttributeActionError(error));
  }
}

export async function createAttributeForWorkspace(input: {
  workspaceSlug: string;
  name: string;
  description?: string | null;
  type: AttributeValueType;
  baseUnitSymbol?: string | null;
  choiceOptions?: AttributeChoiceOptionInput[];
}): Promise<AttributeActionResult<AttributeListItem>> {
  try {
    const context = await getAuthorizedAttributeContext({
      workspaceSlug: input.workspaceSlug,
      permission: "attributes:write"
    });
    const attribute = await createAttribute({
      workspaceId: context.workspace.id,
      name: input.name,
      description: input.description,
      type: input.type,
      baseUnitSymbol: input.baseUnitSymbol,
      choiceOptions: input.choiceOptions
    });

    return getSuccessState(attribute);
  } catch (error) {
    return getErrorState(getAttributeActionError(error));
  }
}

export async function updateAttributeForWorkspace(input: {
  workspaceSlug: string;
  attributeId: string;
  name: string;
  description?: string | null;
  type: AttributeValueType;
  baseUnitSymbol?: string | null;
  choiceOptions?: AttributeChoiceOptionUpdateInput[];
}): Promise<AttributeActionResult<AttributeListItem>> {
  try {
    const context = await getAuthorizedAttributeContext({
      workspaceSlug: input.workspaceSlug,
      permission: "attributes:write"
    });
    const attribute = await updateAttribute({
      workspaceId: context.workspace.id,
      attributeId: input.attributeId,
      name: input.name,
      description: input.description,
      type: input.type,
      baseUnitSymbol: input.baseUnitSymbol,
      choiceOptions: input.choiceOptions
    });

    return getSuccessState(attribute);
  } catch (error) {
    return getErrorState(getAttributeActionError(error));
  }
}

export async function deleteAttributeForWorkspace(input: {
  workspaceSlug: string;
  attributeId: string;
}): Promise<AttributeActionResult<null>> {
  try {
    const context = await getAuthorizedAttributeContext({
      workspaceSlug: input.workspaceSlug,
      permission: "attributes:write"
    });

    await deleteAttribute({
      workspaceId: context.workspace.id,
      attributeId: input.attributeId
    });
    return getSuccessState(null);
  } catch (error) {
    return getErrorState(getAttributeActionError(error));
  }
}

export async function createChoiceOptionForWorkspace(input: {
  workspaceSlug: string;
  attributeId: string;
  label: string;
  sortOrder: number;
}) {
  try {
    const context = await getAuthorizedAttributeContext({
      workspaceSlug: input.workspaceSlug,
      permission: "attributes:write"
    });
    const option = await createChoiceOption({
      workspaceId: context.workspace.id,
      attributeId: input.attributeId,
      label: input.label,
      sortOrder: input.sortOrder
    });

    return getSuccessState(option);
  } catch (error) {
    return getErrorState(getAttributeActionError(error));
  }
}

export async function updateChoiceOptionForWorkspace(input: {
  workspaceSlug: string;
  optionId: string;
  label: string;
  sortOrder: number;
}) {
  try {
    const context = await getAuthorizedAttributeContext({
      workspaceSlug: input.workspaceSlug,
      permission: "attributes:write"
    });
    const option = await updateChoiceOption({
      workspaceId: context.workspace.id,
      optionId: input.optionId,
      label: input.label,
      sortOrder: input.sortOrder
    });

    return getSuccessState(option);
  } catch (error) {
    return getErrorState(getAttributeActionError(error));
  }
}

export async function deleteChoiceOptionForWorkspace(input: {
  workspaceSlug: string;
  optionId: string;
}): Promise<AttributeActionResult<null>> {
  try {
    const context = await getAuthorizedAttributeContext({
      workspaceSlug: input.workspaceSlug,
      permission: "attributes:write"
    });

    await deleteChoiceOption({
      workspaceId: context.workspace.id,
      optionId: input.optionId
    });
    return getSuccessState(null);
  } catch (error) {
    return getErrorState(getAttributeActionError(error));
  }
}

export async function getEffectiveCategoryAttributesForWorkspace(input: {
  workspaceSlug: string;
  categoryId: string;
}): Promise<AttributeActionResult<EffectiveCategoryAttribute[]>> {
  try {
    const context = await getAuthorizedAttributeContext({
      workspaceSlug: input.workspaceSlug,
      permission: "attributes:read"
    });

    return getSuccessState(
      await getEffectiveCategoryAttributeConfiguration({
        workspaceId: context.workspace.id,
        categoryId: input.categoryId
      })
    );
  } catch (error) {
    return getErrorState(getAttributeActionError(error));
  }
}

export async function getEffectiveWorkspaceAttributesForWorkspace(input: {
  workspaceSlug: string;
}): Promise<AttributeActionResult<EffectiveCategoryAttribute[]>> {
  try {
    const context = await getAuthorizedAttributeContext({
      workspaceSlug: input.workspaceSlug,
      permission: "attributes:read"
    });

    return getSuccessState(
      await getEffectiveWorkspaceAttributeConfiguration({
        workspaceId: context.workspace.id
      })
    );
  } catch (error) {
    return getErrorState(getAttributeActionError(error));
  }
}

export async function attachCategoryAttributeForWorkspace(input: {
  workspaceSlug: string;
  categoryId: string;
  attributeId: string;
  sortOrder: number;
  defaultValue: AttributeDefaultValueInput;
  isPrimary?: boolean;
}): Promise<AttributeActionResult<null>> {
  try {
    const context = await getAuthorizedAttributeContext({
      workspaceSlug: input.workspaceSlug,
      permission: "attributes:write"
    });

    await attachOrOverrideCategoryAttribute({
      workspaceId: context.workspace.id,
      categoryId: input.categoryId,
      attributeId: input.attributeId,
      sortOrder: input.sortOrder,
      defaultValue: input.defaultValue,
      isPrimary: input.isPrimary ?? false
    });
    return getSuccessState(null);
  } catch (error) {
    return getErrorState(getAttributeActionError(error));
  }
}

export async function detachCategoryAttributeForWorkspace(input: {
  workspaceSlug: string;
  categoryId: string;
  attributeId: string;
}): Promise<AttributeActionResult<null>> {
  try {
    const context = await getAuthorizedAttributeContext({
      workspaceSlug: input.workspaceSlug,
      permission: "attributes:write"
    });

    await detachCategoryAttribute({
      workspaceId: context.workspace.id,
      categoryId: input.categoryId,
      attributeId: input.attributeId
    });
    return getSuccessState(null);
  } catch (error) {
    return getErrorState(getAttributeActionError(error));
  }
}

export async function setCategoryValueAttributeForWorkspace(input: {
  workspaceSlug: string;
  categoryId: string;
  attributeId: string | null;
}): Promise<AttributeActionResult<null>> {
  try {
    const context = await getAuthorizedAttributeContext({
      workspaceSlug: input.workspaceSlug,
      permission: "attributes:write"
    });

    await setCategoryValueAttribute({
      workspaceId: context.workspace.id,
      categoryId: input.categoryId,
      attributeId: input.attributeId
    });
    return getSuccessState(null);
  } catch (error) {
    return getErrorState(getAttributeActionError(error));
  }
}

export async function saveCategoryAttributeConfigurationForWorkspace(input: {
  workspaceSlug: string;
  categoryId: string;
  valueAttributeId: string | null;
  attributes: AttributeConfigurationEntry[];
}): Promise<AttributeActionResult<EffectiveCategoryAttribute[]>> {
  try {
    const context = await getAuthorizedAttributeContext({
      workspaceSlug: input.workspaceSlug,
      permission: "attributes:write"
    });

    return getSuccessState(
      await saveCategoryAttributeConfiguration({
        workspaceId: context.workspace.id,
        categoryId: input.categoryId,
        valueAttributeId: input.valueAttributeId,
        attributes: input.attributes
      })
    );
  } catch (error) {
    return getErrorState(getAttributeActionError(error));
  }
}

export async function saveWorkspaceAttributeConfigurationForWorkspace(input: {
  workspaceSlug: string;
  attributes: AttributeConfigurationEntry[];
}): Promise<AttributeActionResult<EffectiveCategoryAttribute[]>> {
  try {
    const context = await getAuthorizedAttributeContext({
      workspaceSlug: input.workspaceSlug,
      permission: "attributes:write"
    });

    return getSuccessState(
      await saveWorkspaceAttributeConfiguration({
        workspaceId: context.workspace.id,
        attributes: input.attributes
      })
    );
  } catch (error) {
    return getErrorState(getAttributeActionError(error));
  }
}

async function getAuthorizedAttributeContext({
  workspaceSlug,
  permission
}: {
  workspaceSlug: string;
  permission: "attributes:read" | "attributes:write";
}) {
  return getAuthorizedSessionActor(workspaceSlug, permission);
}

function getSuccessState<T>(data: T): AttributeActionResult<T> {
  return {
    ok: true,
    data,
    submittedAt: Date.now()
  };
}

function getErrorState(error: string): AttributeActionResult<never> {
  return {
    ok: false,
    error,
    submittedAt: Date.now()
  };
}

function getAttributeActionError(error: unknown) {
  if (!(error instanceof Error)) {
    return "database-unavailable";
  }

  return error.message.replaceAll("_", "-");
}
