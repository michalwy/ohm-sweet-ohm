import { z } from "zod";

import { defineOperation } from "@/server/api/operations";

/**
 * Part categories in the API and MCP (#278). Pure, so unit tests and the OpenAPI document can
 * load it; the implementations are in `categoryApi.ts`.
 */

export const partCategorySchema = z.object({
  id: z.string().describe("The category's id."),
  parentId: z
    .string()
    .nullable()
    .describe("The parent category's id; null for a top-level category."),
  name: z.string().describe("The category's own name, e.g. \"Resistors\"."),
  isAssignable: z
    .boolean()
    .describe(
      "Whether parts can be put in this category (true), or it only groups other categories (false, an organizational category)."
    ),
  path: z
    .string()
    .describe("The category's full path from the top, joined with \" » \", e.g. \"Passives » Resistors\".")
});

const categoryIdInput = z.string().min(1).describe("The category's id, as get_part_category_tree returns it.");

const parentIdInput = z
  .string()
  .min(1)
  .nullable()
  .describe("The parent category's id; null for a top-level category.");

export const getPartCategoryTreeOperation = defineOperation({
  name: "get_part_category_tree",
  description:
    "The workspace's whole part-category tree, as a flat list sorted by path: each category names its parent, so the tree can be rebuilt from parentId.",
  permission: "part-categories:read",
  input: z.object({}),
  output: z.object({
    categories: z.array(partCategorySchema).describe("Every category of the workspace, sorted by path.")
  })
});

export const createPartCategoryOperation = defineOperation({
  name: "create_part_category",
  description: "Create one part category, at the top level or under a parent.",
  permission: "part-categories:write",
  input: z.object({
    name: z.string().min(1).describe("The category's name."),
    parentId: parentIdInput.optional(),
    isAssignable: z
      .boolean()
      .describe("true for a category parts can be put in; false for an organizational one that only groups others.")
  }),
  output: partCategorySchema
});

export const createPartCategoryPathOperation = defineOperation({
  name: "create_part_category_path",
  description:
    "Create a whole path of categories at once, e.g. \"Passives/Resistors/SMD\", as the app's \"create path\" does: a segment that already exists at its place (same name, ignoring case) is reused, a missing one is created. Every segment but the last is made organizational — an existing one too; the last is assignable unless finalIsAssignable is false. Returns the last category of the path.",
  permission: "part-categories:write",
  input: z.object({
    path: z.string().min(1).describe("Category names separated by \"/\", e.g. \"Passives/Resistors/SMD\"."),
    parentId: parentIdInput
      .optional()
      .describe("The category the path starts under; null or omitted for the top level."),
    finalIsAssignable: z
      .boolean()
      .optional()
      .describe("Whether parts can be put in the last category of the path; true when omitted.")
  }),
  output: partCategorySchema
});

export const updatePartCategoryOperation = defineOperation({
  name: "update_part_category",
  description:
    "Rename a part category, change whether parts can be put in it, or move it under another parent. Fields left out keep their current value.",
  permission: "part-categories:write",
  input: z.object({
    categoryId: categoryIdInput,
    name: z.string().min(1).optional().describe("The new name."),
    parentId: parentIdInput
      .optional()
      .describe("The new parent's id, or null to move it to the top level; omit to keep its parent. A category cannot move under itself or its own descendants."),
    isAssignable: z
      .boolean()
      .optional()
      .describe("true for a category parts can be put in; false for an organizational one.")
  }),
  output: partCategorySchema
});

export const movePartCategoryOperation = defineOperation({
  name: "move_part_category",
  description:
    "Move a part category, with everything under it, under another parent or to the top level.",
  permission: "part-categories:write",
  input: z.object({
    categoryId: categoryIdInput,
    parentId: parentIdInput.describe(
      "The new parent's id, or null for the top level. A category cannot move under itself or its own descendants."
    )
  }),
  output: partCategorySchema
});

export const deletePartCategoryOperation = defineOperation({
  name: "delete_part_category",
  description:
    "Delete a part category. A category with subcategories (category-has-children) or with parts in it (category-in-use-by-parts) cannot be deleted.",
  permission: "part-categories:write",
  input: z.object({ categoryId: categoryIdInput }),
  output: z.object({ id: z.string().describe("The deleted category's id.") })
});
