"use server";

import { revalidatePath } from "next/cache";

import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import {
  createPartCategory,
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

export async function createPartCategoryFromForm(
  formData: FormData
): Promise<PartCategoryMutationResult> {
  const workspaceSlug = getRequiredFormValue(formData, "workspaceSlug");
  const name = getRequiredFormValue(formData, "name");
  const parentId = getOptionalFormValue(formData, "parentId");
  const isAssignable = getRequiredFormValue(formData, "type") === "assignable";
  const categoriesPath = getPartCategoriesPath(workspaceSlug);
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

  revalidatePath(categoriesPath);
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
  const categoriesPath = getPartCategoriesPath(workspaceSlug);
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

  revalidatePath(categoriesPath);
  return getMutationSuccessState(category, categories);
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

function getPartCategoriesPath(workspaceSlug: string) {
  if (!workspaceSlug) {
    return "/workspaces";
  }

  return `/w/${encodeURIComponent(workspaceSlug)}/part-categories`;
}

function getPartCategoryFormError(error: unknown) {
  if (!(error instanceof Error)) {
    return "database-unavailable";
  }

  if (
    error.message === "category_name_required" ||
    error.message === "category_not_found" ||
    error.message === "invalid_parent_category" ||
    error.message === "category_tree_cycle" ||
    error.message === "workspace_permission_denied"
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
