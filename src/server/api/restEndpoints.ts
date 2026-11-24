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
  getWorkspaceOperation,
  whoamiOperation
} from "@/server/workspaces/workspaceOperations";

/**
 * Every REST endpoint under `/api/v1` (#274), as the OpenAPI document describes it. Pure, so the
 * document can be built and validated in a unit test. Each area issue adds its endpoints here and a
 * route file under `src/app/api/v1/` that serves the same operation through `restOperation`.
 *
 * Conventions (`docs/agents/architecture.md` § *REST API*):
 * - `path` is relative to `/api/v1`, with OpenAPI `{param}` placeholders;
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
  }
];
