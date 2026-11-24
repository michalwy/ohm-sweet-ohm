import { z } from "zod";

import { defineOperation } from "@/server/api/operations";
import { API_TOKEN_PERMISSION_KEYS } from "@/server/api-tokens/apiTokenPermissions";

/**
 * The caller and its workspace (#274, #275): `GET /api/v1/me`, `GET /api/v1/workspace` and the
 * `whoami` MCP tool. Pure, so unit tests and the OpenAPI document can load it; the implementations
 * are in `workspaceApi.ts`.
 */

export const actorUserSchema = z.object({
  id: z.string().describe("The user's id."),
  name: z.string().nullable().describe("The user's display name; null when unset."),
  email: z.string().describe("The user's email address.")
});

export const actorWorkspaceSummarySchema = z.object({
  id: z.string().describe("The workspace's id."),
  name: z.string().describe("The workspace's name."),
  slug: z.string().describe("The workspace's slug, as in its URL /w/<slug>.")
});

export const whoamiOperation = defineOperation({
  name: "whoami",
  description:
    "Who the caller is: the user the token acts as, the one workspace it is bound to, and the permissions it holds there (the token's set intersected with the user's roles).",
  permission: null,
  input: z.object({}),
  output: z.object({
    user: actorUserSchema.describe("The user the token acts as."),
    workspace: actorWorkspaceSummarySchema.describe("The workspace every call acts in."),
    permissions: z
      .array(z.enum(API_TOKEN_PERMISSION_KEYS))
      .describe(
        "Permission keys the caller holds in the workspace, sorted. An operation needing a key not listed here is refused."
      )
  })
});

export const workspaceDetailsSchema = z.object({
  id: z.string().describe("The workspace's id."),
  name: z.string().describe("The workspace's name."),
  slug: z.string().describe("The workspace's slug, as in its URL /w/<slug>."),
  primaryCurrency: z
    .string()
    .describe("ISO 4217 code of the currency prices are reported in, e.g. \"EUR\"."),
  defaultPriceEntryMode: z
    .string()
    .describe("Whether new purchase prices are entered \"net\" or \"gross\" by default."),
  defaultTaxRate: z
    .string()
    .nullable()
    .describe("Default tax rate in percent, as a decimal string (e.g. \"23\"); null when unset."),
  activeSupplierProvider: z
    .enum(["DIGIKEY", "MOUSER", "TME"])
    .nullable()
    .describe("The supplier catalogue used for part lookups; null when none is active."),
  createdAt: z.iso.datetime().describe("When the workspace was created (ISO 8601, UTC)."),
  updatedAt: z.iso.datetime().describe("When the workspace was last changed (ISO 8601, UTC).")
});

export const getWorkspaceOperation = defineOperation({
  name: "get_workspace",
  description: "The workspace the token is bound to, with its general and ordering settings.",
  permission: "workspace:read",
  input: z.object({}),
  output: workspaceDetailsSchema
});
