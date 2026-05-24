"use server";

import { revalidatePath } from "next/cache";

import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import {
  attachOrOverrideCategoryAttribute,
  createChoiceOption,
  createAttribute,
  deleteChoiceOption,
  deleteAttribute,
  detachCategoryAttribute,
  getEffectiveCategoryAttributeConfiguration,
  getWorkspaceAttributes,
  setCategoryValueAttribute,
  updateChoiceOption,
  updateAttribute,
  type AttributeChoiceOptionInput,
  type AttributeChoiceOptionUpdateInput,
  type AttributeDefaultValueInput,
  type AttributeListItem
} from "@/server/parts/attributeMutations";
import type { EffectiveCategoryAttribute } from "@/server/parts/attributes";
import type { AttributeValueType } from "@/server/parts/attributeValues";

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

    revalidatePath(getWorkspacePath(input.workspaceSlug));
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

    revalidatePath(getWorkspacePath(input.workspaceSlug));
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
    revalidatePath(getWorkspacePath(input.workspaceSlug));
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

    revalidatePath(getWorkspacePath(input.workspaceSlug));
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

    revalidatePath(getWorkspacePath(input.workspaceSlug));
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
    revalidatePath(getWorkspacePath(input.workspaceSlug));
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
    revalidatePath(getWorkspacePath(input.workspaceSlug));
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
    revalidatePath(getWorkspacePath(input.workspaceSlug));
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
    revalidatePath(getWorkspacePath(input.workspaceSlug));
    return getSuccessState(null);
  } catch (error) {
    return getErrorState(getAttributeActionError(error));
  }
}

export async function saveCategoryAttributeConfigurationForWorkspace(input: {
  workspaceSlug: string;
  categoryId: string;
  valueAttributeId: string | null;
  attributes: Array<{
    attributeId: string;
    sortOrder: number;
    defaultValue: AttributeDefaultValueInput;
    isPrimary: boolean;
  }>;
}): Promise<AttributeActionResult<EffectiveCategoryAttribute[]>> {
  try {
    const context = await getAuthorizedAttributeContext({
      workspaceSlug: input.workspaceSlug,
      permission: "attributes:write"
    });
    const existingEffectiveAttributes =
      await getEffectiveCategoryAttributeConfiguration({
        workspaceId: context.workspace.id,
        categoryId: input.categoryId
      });
    const existingLocalAttributeIds = new Set(
      existingEffectiveAttributes
        .filter(
          (effectiveAttribute) =>
            effectiveAttribute.sourceCategoryId === input.categoryId
        )
        .map((effectiveAttribute) => effectiveAttribute.attribute.id)
    );
    const nextLocalAttributeIds = new Set(
      input.attributes.map((attribute) => attribute.attributeId)
    );

    await setCategoryValueAttribute({
      workspaceId: context.workspace.id,
      categoryId: input.categoryId,
      attributeId: null
    });

    for (const attribute of input.attributes) {
      await attachOrOverrideCategoryAttribute({
        workspaceId: context.workspace.id,
        categoryId: input.categoryId,
        attributeId: attribute.attributeId,
        sortOrder: attribute.sortOrder,
        defaultValue: attribute.defaultValue,
        isPrimary: attribute.isPrimary
      });
    }

    for (const attributeId of existingLocalAttributeIds) {
      if (!nextLocalAttributeIds.has(attributeId)) {
        await detachCategoryAttribute({
          workspaceId: context.workspace.id,
          categoryId: input.categoryId,
          attributeId
        });
      }
    }

    await setCategoryValueAttribute({
      workspaceId: context.workspace.id,
      categoryId: input.categoryId,
      attributeId: input.valueAttributeId
    });

    const effectiveAttributes = await getEffectiveCategoryAttributeConfiguration({
      workspaceId: context.workspace.id,
      categoryId: input.categoryId
    });

    revalidatePath(getWorkspacePath(input.workspaceSlug));
    return getSuccessState(effectiveAttributes);
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
  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

  if (!context) {
    throw new Error("workspace_not_found");
  }

  await authorizeWorkspacePermission({
    userId: context.user.id,
    workspaceId: context.workspace.id,
    permission
  });

  return context;
}

function getWorkspacePath(workspaceSlug: string) {
  return `/w/${encodeURIComponent(workspaceSlug)}`;
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
