"use server";


import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import {
  createPartCategory,
  createPartCategoryPath,
  deletePartCategory,
  getPartCategories,
  type PartCategoryListItem,
  updatePartCategory
} from "@/server/parts/categories";

export type PartCategoryMutationResult =
  | {
      ok: true;
      category: PartCategoryListItem;
      categories: PartCategoryListItem[];
      submittedAt: number;
    }
  | {
      ok: false;
      error: string;
      submittedAt: number;
    };

export type PartCategoryDeleteResult =
  | {
      ok: true;
      id: string;
      categories: PartCategoryListItem[];
      submittedAt: number;
    }
  | {
      ok: false;
      error: string;
      submittedAt: number;
    };

export async function createPartCategoryFromForm(
  formData: FormData
): Promise<PartCategoryMutationResult> {
  const workspaceSlug = getRequiredFormValue(formData, "workspaceSlug");
  const name = getRequiredFormValue(formData, "name");
  const parentId = getOptionalFormValue(formData, "parentId");
  const isAssignable = getRequiredFormValue(formData, "type") === "assignable";

  let category: PartCategoryListItem | null = null;
  let categories: PartCategoryListItem[] = [];

  if (!workspaceSlug || !name) {
    return getMutationErrorState("missing-required-fields");
  }

  let formError: string | null = null;

  try {
    const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

    if (!context) {
      formError = "database-unavailable";
    } else {
      await authorizeWorkspacePermission({
        userId: context.user.id,
        workspaceId: context.workspace.id,
        permission: "part-categories:write"
      });

      const createdCategory = await createPartCategory({
        workspaceId: context.workspace.id,
        parentId,
        name,
        isAssignable
      });
      const nextCategories = await getPartCategories(context.workspace.id);
      category =
        nextCategories.find(
          (currentCategory) => currentCategory.id === createdCategory.id
        ) ?? null;
      categories = nextCategories;
    }
  } catch (error) {
    formError = getPartCategoryFormError(error);
  }

  if (formError) {
    return getMutationErrorState(formError);
  }

  if (!category) {
    return getMutationErrorState("database-unavailable");
  }

  return getMutationSuccessState(category, categories);
}

export async function createPartCategoryPathFromForm(
  formData: FormData
): Promise<PartCategoryMutationResult> {
  const workspaceSlug = getRequiredFormValue(formData, "workspaceSlug");
  const path = getRequiredFormValue(formData, "path");
  const parentId = getOptionalFormValue(formData, "parentId");
  const finalIsAssignable =
    getRequiredFormValue(formData, "finalType") !== "organizational";

  let category: PartCategoryListItem | null = null;
  let categories: PartCategoryListItem[] = [];

  if (!workspaceSlug || !path) {
    return getMutationErrorState("missing-required-fields");
  }

  let formError: string | null = null;

  try {
    const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

    if (!context) {
      formError = "database-unavailable";
    } else {
      await authorizeWorkspacePermission({
        userId: context.user.id,
        workspaceId: context.workspace.id,
        permission: "part-categories:write"
      });

      const createdCategory = await createPartCategoryPath({
        workspaceId: context.workspace.id,
        parentId,
        path,
        finalIsAssignable
      });
      const nextCategories = await getPartCategories(context.workspace.id);
      category =
        nextCategories.find(
          (currentCategory) => currentCategory.id === createdCategory.id
        ) ?? null;
      categories = nextCategories;
    }
  } catch (error) {
    formError = getPartCategoryFormError(error);
  }

  if (formError) {
    return getMutationErrorState(formError);
  }

  if (!category) {
    return getMutationErrorState("database-unavailable");
  }

  return getMutationSuccessState(category, categories);
}

export async function updatePartCategoryFromForm(
  formData: FormData
): Promise<PartCategoryMutationResult> {
  const workspaceSlug = getRequiredFormValue(formData, "workspaceSlug");
  const id = getRequiredFormValue(formData, "id");
  const name = getRequiredFormValue(formData, "name");
  const parentId = getOptionalFormValue(formData, "parentId");
  const isAssignable = getRequiredFormValue(formData, "type") === "assignable";

  let category: PartCategoryListItem | null = null;
  let categories: PartCategoryListItem[] = [];

  if (!workspaceSlug || !id || !name) {
    return getMutationErrorState("missing-required-fields");
  }

  let formError: string | null = null;

  try {
    const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

    if (!context) {
      formError = "database-unavailable";
    } else {
      await authorizeWorkspacePermission({
        userId: context.user.id,
        workspaceId: context.workspace.id,
        permission: "part-categories:write"
      });

      const updatedCategory = await updatePartCategory({
        id,
        workspaceId: context.workspace.id,
        parentId,
        name,
        isAssignable
      });
      const nextCategories = await getPartCategories(context.workspace.id);
      category =
        nextCategories.find(
          (currentCategory) => currentCategory.id === updatedCategory.id
        ) ?? null;
      categories = nextCategories;
    }
  } catch (error) {
    formError = getPartCategoryFormError(error);
  }

  if (formError) {
    return getMutationErrorState(formError);
  }

  if (!category) {
    return getMutationErrorState("database-unavailable");
  }

  return getMutationSuccessState(category, categories);
}

export async function deletePartCategoryFromForm(
  formData: FormData
): Promise<PartCategoryDeleteResult> {
  const workspaceSlug = getRequiredFormValue(formData, "workspaceSlug");
  const id = getRequiredFormValue(formData, "id");

  let categories: PartCategoryListItem[] = [];

  if (!workspaceSlug || !id) {
    return getDeleteErrorState("missing-required-fields");
  }

  let formError: string | null = null;

  try {
    const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

    if (!context) {
      formError = "database-unavailable";
    } else {
      await authorizeWorkspacePermission({
        userId: context.user.id,
        workspaceId: context.workspace.id,
        permission: "part-categories:write"
      });

      await deletePartCategory({
        id,
        workspaceId: context.workspace.id
      });
      categories = await getPartCategories(context.workspace.id);
    }
  } catch (error) {
    formError = getPartCategoryFormError(error);
  }

  if (formError) {
    return getDeleteErrorState(formError);
  }

  return {
    ok: true,
    id,
    categories,
    submittedAt: Date.now()
  };
}

function getRequiredFormValue(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getOptionalFormValue(formData: FormData, name: string) {
  const value = getRequiredFormValue(formData, name);

  return value || null;
}

function getPartCategoryFormError(error: unknown) {
  if (!(error instanceof Error)) {
    return "database-unavailable";
  }

  if (
    error.message === "category-name-required" ||
    error.message === "category-not-found" ||
    error.message === "invalid-parent-category" ||
    error.message === "category-tree-cycle" ||
    error.message === "category-in-use-by-parts" ||
    error.message === "category-has-children" ||
    error.message === "workspace-permission-denied"
  ) {
    return error.message.replaceAll("_", "-");
  }

  return "database-unavailable";
}

function getMutationSuccessState(
  category: PartCategoryListItem,
  categories: PartCategoryListItem[]
): PartCategoryMutationResult {
  return {
    ok: true,
    category,
    categories,
    submittedAt: Date.now()
  };
}

function getMutationErrorState(error: string): PartCategoryMutationResult {
  return {
    ok: false,
    error,
    submittedAt: Date.now()
  };
}

function getDeleteErrorState(error: string): PartCategoryDeleteResult {
  return {
    ok: false,
    error,
    submittedAt: Date.now()
  };
}
