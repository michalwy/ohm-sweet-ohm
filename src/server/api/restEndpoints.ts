import type { z } from "zod";

import type { Operation } from "@/server/api/operations";
import {
  createOrganizationOperation,
  deleteOrganizationOperation,
  getOrganizationOperation,
  listOrganizationsOperation,
  updateOrganizationOperation
} from "@/server/organizations/organizationOperations";
import {
  attachCategoryAttributeOperation,
  createAttributeOperation,
  createChoiceOptionOperation,
  deleteAttributeOperation,
  deleteChoiceOptionOperation,
  detachCategoryAttributeOperation,
  getCategoryAttributesOperation,
  getWorkspaceAttributesOperation,
  listAttributesOperation,
  saveCategoryAttributeConfigurationOperation,
  saveWorkspaceAttributeConfigurationOperation,
  setCategoryValueAttributeOperation,
  updateAttributeOperation,
  updateChoiceOptionOperation
} from "@/server/parts/attributeOperations";
import {
  createPartCategoryOperation,
  createPartCategoryPathOperation,
  deletePartCategoryOperation,
  getPartCategoryTreeOperation,
  movePartCategoryOperation,
  updatePartCategoryOperation
} from "@/server/parts/categoryOperations";
import {
  createUnitOperation,
  deleteUnitOperation,
  listUnitsOperation,
  updateUnitOperation
} from "@/server/units/unitOperations";
import {
  createPartOperation,
  deletePartOperation,
  getPartOperation,
  listPartsOperation,
  updatePartOperation
} from "@/server/parts/partOperations";
import {
  getWorkspaceOperation,
  whoamiOperation
} from "@/server/workspaces/workspaceOperations";

/**
 * Every REST endpoint under `/api/v1` (#274), as the OpenAPI document describes it. Pure, so the
 * document can be built and validated in a unit test. Each area issue adds its endpoints here and a
 * route file under `src/app/api/v1/` that serves the same operation through `restOperation`.
 *
 * Conventions (`docs/agents/architecture.md` § *REST API*):
 * - `path` is relative to `/api/v1`, with OpenAPI `{param}` placeholders, each an input field of
 *   the operation; its route file is under the matching `[param]` folder;
 * - a `get` endpoint reads its input from the query string, every other method from a JSON body;
 * - list endpoints are `get`, spread `listPageInputShape` and return `listPageOutputSchema`, so
 *   paging is `?cursor=<nextCursor>&pageSize=<n>` everywhere;
 * - a `{param}` in `path` is served by a `[param]` route segment and is an input field of the
 *   operation, taken from the path, not from the query string or body.
 */
export type RestMethod = "get" | "post" | "put" | "patch" | "delete";

export type RestEndpoint = {
  method: RestMethod;
  path: string;
  summary: string;
  tag: string;
  operation: Operation<z.ZodType, z.ZodType>;
};

export const REST_API_BASE_PATH = "/api/v1";

export const restEndpoints: RestEndpoint[] = [
  { method: "get", path: "/me", summary: "The caller", tag: "Workspace", operation: whoamiOperation },
  {
    method: "get",
    path: "/workspace",
    summary: "The token's workspace",
    tag: "Workspace",
    operation: getWorkspaceOperation
  },
  {
    method: "get",
    path: "/organizations",
    summary: "List organizations",
    tag: "Organizations",
    operation: listOrganizationsOperation
  },
  {
    method: "post",
    path: "/organizations",
    summary: "Create an organization",
    tag: "Organizations",
    operation: createOrganizationOperation
  },
  {
    method: "get",
    path: "/organizations/{id}",
    summary: "Get an organization",
    tag: "Organizations",
    operation: getOrganizationOperation
  },
  {
    method: "patch",
    path: "/organizations/{id}",
    summary: "Update an organization",
    tag: "Organizations",
    operation: updateOrganizationOperation
  },
  {
    method: "delete",
    path: "/organizations/{id}",
    summary: "Delete an organization",
    tag: "Organizations",
    operation: deleteOrganizationOperation
  },
  // Part categories (#278)
  { method: "get", path: "/part-categories", summary: "The category tree", tag: "Part categories", operation: getPartCategoryTreeOperation },
  { method: "post", path: "/part-categories", summary: "Create a category", tag: "Part categories", operation: createPartCategoryOperation },
  { method: "post", path: "/part-categories/paths", summary: "Create a category path", tag: "Part categories", operation: createPartCategoryPathOperation },
  { method: "patch", path: "/part-categories/{categoryId}", summary: "Update a category", tag: "Part categories", operation: updatePartCategoryOperation },
  { method: "delete", path: "/part-categories/{categoryId}", summary: "Delete a category", tag: "Part categories", operation: deletePartCategoryOperation },
  { method: "post", path: "/part-categories/{categoryId}/move", summary: "Move a category", tag: "Part categories", operation: movePartCategoryOperation },
  // Attributes (#278)
  { method: "get", path: "/attributes", summary: "List attributes", tag: "Attributes", operation: listAttributesOperation },
  { method: "post", path: "/attributes", summary: "Create an attribute", tag: "Attributes", operation: createAttributeOperation },
  { method: "patch", path: "/attributes/{attributeId}", summary: "Update an attribute", tag: "Attributes", operation: updateAttributeOperation },
  { method: "delete", path: "/attributes/{attributeId}", summary: "Delete an attribute", tag: "Attributes", operation: deleteAttributeOperation },
  { method: "post", path: "/attributes/{attributeId}/choice-options", summary: "Add a choice option", tag: "Attributes", operation: createChoiceOptionOperation },
  { method: "patch", path: "/attribute-choice-options/{optionId}", summary: "Update a choice option", tag: "Attributes", operation: updateChoiceOptionOperation },
  { method: "delete", path: "/attribute-choice-options/{optionId}", summary: "Delete a choice option", tag: "Attributes", operation: deleteChoiceOptionOperation },
  { method: "get", path: "/part-categories/{categoryId}/attributes", summary: "A category's effective attributes", tag: "Attributes", operation: getCategoryAttributesOperation },
  { method: "put", path: "/part-categories/{categoryId}/attributes", summary: "Save a category's attribute configuration", tag: "Attributes", operation: saveCategoryAttributeConfigurationOperation },
  { method: "put", path: "/part-categories/{categoryId}/attributes/{attributeId}", summary: "Attach or override an attribute on a category", tag: "Attributes", operation: attachCategoryAttributeOperation },
  { method: "delete", path: "/part-categories/{categoryId}/attributes/{attributeId}", summary: "Detach an attribute from a category", tag: "Attributes", operation: detachCategoryAttributeOperation },
  { method: "put", path: "/part-categories/{categoryId}/value-attribute", summary: "Set a category's value attribute", tag: "Attributes", operation: setCategoryValueAttributeOperation },
  { method: "get", path: "/workspace/attributes", summary: "The workspace's attributes", tag: "Attributes", operation: getWorkspaceAttributesOperation },
  { method: "put", path: "/workspace/attributes", summary: "Save the workspace's attributes", tag: "Attributes", operation: saveWorkspaceAttributeConfigurationOperation },
  // Units (#278)
  { method: "get", path: "/units", summary: "List units", tag: "Units", operation: listUnitsOperation },
  { method: "post", path: "/units", summary: "Create a unit", tag: "Units", operation: createUnitOperation },
  { method: "patch", path: "/units/{unitId}", summary: "Update a unit", tag: "Units", operation: updateUnitOperation },
  { method: "delete", path: "/units/{unitId}", summary: "Delete a unit", tag: "Units", operation: deleteUnitOperation },
  // Parts (#277)
  { method: "get", path: "/parts", summary: "List parts", tag: "Parts", operation: listPartsOperation },
  { method: "post", path: "/parts", summary: "Create a part", tag: "Parts", operation: createPartOperation },
  { method: "get", path: "/parts/{id}", summary: "Get a part", tag: "Parts", operation: getPartOperation },
  {
    method: "patch",
    path: "/parts/{id}",
    summary: "Change a part",
    tag: "Parts",
    operation: updatePartOperation
  },
  {
    method: "delete",
    path: "/parts/{id}",
    summary: "Delete a part",
    tag: "Parts",
    operation: deletePartOperation
  }
];
