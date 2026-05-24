"use server";

import { revalidatePath } from "next/cache";

import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import {
  attachOrOverrideCategoryParameter,
  createChoiceOption,
  createParameter,
  deleteChoiceOption,
  deleteParameter,
  detachCategoryParameter,
  getEffectiveCategoryParameterConfiguration,
  getWorkspaceParameters,
  setCategoryValueParameter,
  updateChoiceOption,
  updateParameter,
  type ParameterChoiceOptionInput,
  type ParameterChoiceOptionUpdateInput,
  type ParameterDefaultValueInput,
  type ParameterListItem
} from "@/server/parts/parameterMutations";
import type { EffectiveCategoryParameter } from "@/server/parts/parameters";
import type { ParameterValueType } from "@/server/parts/parameterValues";

export type ParameterActionResult<T> =
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

export async function getParameterDictionaryForWorkspace(
  workspaceSlug: string
): Promise<ParameterActionResult<ParameterListItem[]>> {
  try {
    const context = await getAuthorizedParameterContext({
      workspaceSlug,
      permission: "parameters:read"
    });

    return getSuccessState(await getWorkspaceParameters(context.workspace.id));
  } catch (error) {
    return getErrorState(getParameterActionError(error));
  }
}

export async function createParameterForWorkspace(input: {
  workspaceSlug: string;
  name: string;
  description?: string | null;
  type: ParameterValueType;
  baseUnitSymbol?: string | null;
  choiceOptions?: ParameterChoiceOptionInput[];
}): Promise<ParameterActionResult<ParameterListItem>> {
  try {
    const context = await getAuthorizedParameterContext({
      workspaceSlug: input.workspaceSlug,
      permission: "parameters:write"
    });
    const parameter = await createParameter({
      workspaceId: context.workspace.id,
      name: input.name,
      description: input.description,
      type: input.type,
      baseUnitSymbol: input.baseUnitSymbol,
      choiceOptions: input.choiceOptions
    });

    revalidatePath(getWorkspacePath(input.workspaceSlug));
    return getSuccessState(parameter);
  } catch (error) {
    return getErrorState(getParameterActionError(error));
  }
}

export async function updateParameterForWorkspace(input: {
  workspaceSlug: string;
  parameterId: string;
  name: string;
  description?: string | null;
  type: ParameterValueType;
  baseUnitSymbol?: string | null;
  choiceOptions?: ParameterChoiceOptionUpdateInput[];
}): Promise<ParameterActionResult<ParameterListItem>> {
  try {
    const context = await getAuthorizedParameterContext({
      workspaceSlug: input.workspaceSlug,
      permission: "parameters:write"
    });
    const parameter = await updateParameter({
      workspaceId: context.workspace.id,
      parameterId: input.parameterId,
      name: input.name,
      description: input.description,
      type: input.type,
      baseUnitSymbol: input.baseUnitSymbol,
      choiceOptions: input.choiceOptions
    });

    revalidatePath(getWorkspacePath(input.workspaceSlug));
    return getSuccessState(parameter);
  } catch (error) {
    return getErrorState(getParameterActionError(error));
  }
}

export async function deleteParameterForWorkspace(input: {
  workspaceSlug: string;
  parameterId: string;
}): Promise<ParameterActionResult<null>> {
  try {
    const context = await getAuthorizedParameterContext({
      workspaceSlug: input.workspaceSlug,
      permission: "parameters:write"
    });

    await deleteParameter({
      workspaceId: context.workspace.id,
      parameterId: input.parameterId
    });
    revalidatePath(getWorkspacePath(input.workspaceSlug));
    return getSuccessState(null);
  } catch (error) {
    return getErrorState(getParameterActionError(error));
  }
}

export async function createChoiceOptionForWorkspace(input: {
  workspaceSlug: string;
  parameterId: string;
  label: string;
  sortOrder: number;
}) {
  try {
    const context = await getAuthorizedParameterContext({
      workspaceSlug: input.workspaceSlug,
      permission: "parameters:write"
    });
    const option = await createChoiceOption({
      workspaceId: context.workspace.id,
      parameterId: input.parameterId,
      label: input.label,
      sortOrder: input.sortOrder
    });

    revalidatePath(getWorkspacePath(input.workspaceSlug));
    return getSuccessState(option);
  } catch (error) {
    return getErrorState(getParameterActionError(error));
  }
}

export async function updateChoiceOptionForWorkspace(input: {
  workspaceSlug: string;
  optionId: string;
  label: string;
  sortOrder: number;
}) {
  try {
    const context = await getAuthorizedParameterContext({
      workspaceSlug: input.workspaceSlug,
      permission: "parameters:write"
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
    return getErrorState(getParameterActionError(error));
  }
}

export async function deleteChoiceOptionForWorkspace(input: {
  workspaceSlug: string;
  optionId: string;
}): Promise<ParameterActionResult<null>> {
  try {
    const context = await getAuthorizedParameterContext({
      workspaceSlug: input.workspaceSlug,
      permission: "parameters:write"
    });

    await deleteChoiceOption({
      workspaceId: context.workspace.id,
      optionId: input.optionId
    });
    revalidatePath(getWorkspacePath(input.workspaceSlug));
    return getSuccessState(null);
  } catch (error) {
    return getErrorState(getParameterActionError(error));
  }
}

export async function getEffectiveCategoryParametersForWorkspace(input: {
  workspaceSlug: string;
  categoryId: string;
}): Promise<ParameterActionResult<EffectiveCategoryParameter[]>> {
  try {
    const context = await getAuthorizedParameterContext({
      workspaceSlug: input.workspaceSlug,
      permission: "parameters:read"
    });

    return getSuccessState(
      await getEffectiveCategoryParameterConfiguration({
        workspaceId: context.workspace.id,
        categoryId: input.categoryId
      })
    );
  } catch (error) {
    return getErrorState(getParameterActionError(error));
  }
}

export async function attachCategoryParameterForWorkspace(input: {
  workspaceSlug: string;
  categoryId: string;
  parameterId: string;
  sortOrder: number;
  defaultValue: ParameterDefaultValueInput;
  isPrimary?: boolean;
}): Promise<ParameterActionResult<null>> {
  try {
    const context = await getAuthorizedParameterContext({
      workspaceSlug: input.workspaceSlug,
      permission: "parameters:write"
    });

    await attachOrOverrideCategoryParameter({
      workspaceId: context.workspace.id,
      categoryId: input.categoryId,
      parameterId: input.parameterId,
      sortOrder: input.sortOrder,
      defaultValue: input.defaultValue,
      isPrimary: input.isPrimary ?? false
    });
    revalidatePath(getWorkspacePath(input.workspaceSlug));
    return getSuccessState(null);
  } catch (error) {
    return getErrorState(getParameterActionError(error));
  }
}

export async function detachCategoryParameterForWorkspace(input: {
  workspaceSlug: string;
  categoryId: string;
  parameterId: string;
}): Promise<ParameterActionResult<null>> {
  try {
    const context = await getAuthorizedParameterContext({
      workspaceSlug: input.workspaceSlug,
      permission: "parameters:write"
    });

    await detachCategoryParameter({
      workspaceId: context.workspace.id,
      categoryId: input.categoryId,
      parameterId: input.parameterId
    });
    revalidatePath(getWorkspacePath(input.workspaceSlug));
    return getSuccessState(null);
  } catch (error) {
    return getErrorState(getParameterActionError(error));
  }
}

export async function setCategoryValueParameterForWorkspace(input: {
  workspaceSlug: string;
  categoryId: string;
  parameterId: string | null;
}): Promise<ParameterActionResult<null>> {
  try {
    const context = await getAuthorizedParameterContext({
      workspaceSlug: input.workspaceSlug,
      permission: "parameters:write"
    });

    await setCategoryValueParameter({
      workspaceId: context.workspace.id,
      categoryId: input.categoryId,
      parameterId: input.parameterId
    });
    revalidatePath(getWorkspacePath(input.workspaceSlug));
    return getSuccessState(null);
  } catch (error) {
    return getErrorState(getParameterActionError(error));
  }
}

export async function saveCategoryParameterConfigurationForWorkspace(input: {
  workspaceSlug: string;
  categoryId: string;
  valueParameterId: string | null;
  parameters: Array<{
    parameterId: string;
    sortOrder: number;
    defaultValue: ParameterDefaultValueInput;
    isPrimary: boolean;
  }>;
}): Promise<ParameterActionResult<EffectiveCategoryParameter[]>> {
  try {
    const context = await getAuthorizedParameterContext({
      workspaceSlug: input.workspaceSlug,
      permission: "parameters:write"
    });
    const existingEffectiveParameters =
      await getEffectiveCategoryParameterConfiguration({
        workspaceId: context.workspace.id,
        categoryId: input.categoryId
      });
    const existingLocalParameterIds = new Set(
      existingEffectiveParameters
        .filter(
          (effectiveParameter) =>
            effectiveParameter.sourceCategoryId === input.categoryId
        )
        .map((effectiveParameter) => effectiveParameter.parameter.id)
    );
    const nextLocalParameterIds = new Set(
      input.parameters.map((parameter) => parameter.parameterId)
    );

    await setCategoryValueParameter({
      workspaceId: context.workspace.id,
      categoryId: input.categoryId,
      parameterId: null
    });

    for (const parameter of input.parameters) {
      await attachOrOverrideCategoryParameter({
        workspaceId: context.workspace.id,
        categoryId: input.categoryId,
        parameterId: parameter.parameterId,
        sortOrder: parameter.sortOrder,
        defaultValue: parameter.defaultValue,
        isPrimary: parameter.isPrimary
      });
    }

    for (const parameterId of existingLocalParameterIds) {
      if (!nextLocalParameterIds.has(parameterId)) {
        await detachCategoryParameter({
          workspaceId: context.workspace.id,
          categoryId: input.categoryId,
          parameterId
        });
      }
    }

    await setCategoryValueParameter({
      workspaceId: context.workspace.id,
      categoryId: input.categoryId,
      parameterId: input.valueParameterId
    });

    const effectiveParameters = await getEffectiveCategoryParameterConfiguration({
      workspaceId: context.workspace.id,
      categoryId: input.categoryId
    });

    revalidatePath(getWorkspacePath(input.workspaceSlug));
    return getSuccessState(effectiveParameters);
  } catch (error) {
    return getErrorState(getParameterActionError(error));
  }
}

async function getAuthorizedParameterContext({
  workspaceSlug,
  permission
}: {
  workspaceSlug: string;
  permission: "parameters:read" | "parameters:write";
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

function getSuccessState<T>(data: T): ParameterActionResult<T> {
  return {
    ok: true,
    data,
    submittedAt: Date.now()
  };
}

function getErrorState(error: string): ParameterActionResult<never> {
  return {
    ok: false,
    error,
    submittedAt: Date.now()
  };
}

function getParameterActionError(error: unknown) {
  if (!(error instanceof Error)) {
    return "database-unavailable";
  }

  return error.message.replaceAll("_", "-");
}
