import { z } from "zod";

import { defineOperation } from "@/server/api/operations";
import { API_TOKEN_PERMISSION_KEYS } from "@/server/api-tokens/apiTokenPermissions";
import {
  DISPLAY_DATE_FORMATS,
  DISPLAY_TIME_FORMATS
} from "@/server/user/displayPreferenceFormats";
import {
  SUPPORTED_WORKSPACE_CURRENCIES,
  WORKSPACE_CREATION_PRESETS
} from "@/server/workspaces/workspaceOptions";

/**
 * The caller and its workspace (#274, #275), the user's workspaces, the workspace's settings and
 * the user's display preferences (#286). Pure, so unit tests and the OpenAPI document can load it;
 * the implementations are in `workspaceApi.ts`.
 *
 * A token is bound to one workspace and never holds `admin`, while the UI lets only a workspace's
 * administrators change its settings, archive or restore it (#286): those operations need the
 * token's `workspace:write` **and** the user's administrative role in the workspace they act on
 * (`workspace-requires-admin` otherwise).
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

const supplierProviderSchema = z.enum(["DIGIKEY", "MOUSER", "TME"]);

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
  activeSupplierProvider: supplierProviderSchema
    .nullable()
    .describe("The supplier catalogue used for part lookups; null when none is active."),
  defaultLocationId: z
    .string()
    .nullable()
    .describe(
      "The workspace's default storage location: preselected where a part's own default location would be (receiving a purchase order, a build's output) when the part has none; null when unset."
    ),
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

const workspaceIdInput = z
  .string()
  .min(1)
  .describe("The workspace's id, as list_workspaces returns it.");

export const userWorkspaceSchema = z.object({
  id: z.string().describe("The workspace's id."),
  name: z.string().describe("The workspace's name."),
  slug: z.string().describe("The workspace's slug, as in its URL /w/<slug>."),
  primaryCurrency: z.string().describe("ISO 4217 code of the workspace's primary currency."),
  archivedAt: z.iso
    .datetime()
    .nullable()
    .describe("When the workspace was archived (ISO 8601, UTC); null while it is active."),
  deletionScheduledAt: z.iso
    .datetime()
    .nullable()
    .describe(
      "When the workspace's permanent deletion was scheduled (ISO 8601, UTC); null when it is not. Such a workspace cannot be restored."
    ),
  createdAt: z.iso.datetime().describe("When the workspace was created (ISO 8601, UTC)."),
  isTokenWorkspace: z
    .boolean()
    .describe("Whether this is the workspace the token is bound to — the one every other call acts in.")
});

export const listWorkspacesOperation = defineOperation({
  name: "list_workspaces",
  description:
    "List the workspaces the user is a member of, oldest membership first. A token acts only in its own workspace (isTokenWorkspace); working in another one needs a token created for it.",
  permission: "workspace:read",
  input: z.object({
    includeArchived: z
      .boolean()
      .optional()
      .describe("Whether to include archived workspaces; only active ones when omitted.")
  }),
  output: z.object({
    items: z.array(userWorkspaceSchema).describe("The user's workspaces.")
  })
});

export const createWorkspaceOperation = defineOperation({
  name: "create_workspace",
  description:
    "Create a new workspace owned by the user. The token stays bound to its own workspace: acting in the new one needs a token created for it.",
  permission: "workspace:write",
  input: z.object({
    name: z.string().min(1).describe("The workspace's name; its URL slug is derived from it."),
    primaryCurrency: z
      .enum(SUPPORTED_WORKSPACE_CURRENCIES)
      .describe("ISO 4217 code of the currency prices are reported in."),
    preset: z
      .enum(WORKSPACE_CREATION_PRESETS)
      .optional()
      .describe(
        "What the workspace starts with: \"empty\" (the default), \"starter-dictionaries\" (categories, attributes, common manufacturers and suppliers, extra units), or the demo data \"parts-only\" or \"parts-and-orders\"."
      )
  }),
  output: userWorkspaceSchema
});

export const archiveWorkspaceOperation = defineOperation({
  name: "archive_workspace",
  description:
    "Archive a workspace the user administers: it leaves the active list and nobody can work in it until it is restored; all its data is kept. Every token bound to it stops working. Needs the user's administrative role there (workspace-requires-admin).",
  permission: "workspace:write",
  input: z.object({ id: workspaceIdInput }),
  output: userWorkspaceSchema
});

export const restoreWorkspaceOperation = defineOperation({
  name: "restore_workspace",
  description:
    "Restore an archived workspace the user administers, so it is active again. A workspace whose deletion is scheduled cannot be restored (workspace-deletion-scheduled). Needs the user's administrative role there (workspace-requires-admin).",
  permission: "workspace:write",
  input: z.object({ id: workspaceIdInput }),
  output: userWorkspaceSchema
});

export const updateWorkspaceSettingsOperation = defineOperation({
  name: "update_workspace_settings",
  description:
    "Change the token's workspace settings: the ordering defaults, the default storage location and the supplier catalogue used for part lookups. Fields left out keep their value. Needs the user's administrative role in the workspace (workspace-requires-admin).",
  permission: "workspace:write",
  input: z.object({
    defaultPriceEntryMode: z
      .enum(["net", "gross"])
      .optional()
      .describe("Whether new purchase prices are entered \"net\" or \"gross\" by default."),
    defaultTaxRate: z
      .string()
      .nullable()
      .optional()
      .describe(
        "Default tax rate in percent, as a decimal string from 0 up to (not including) 100, e.g. \"23\"; null clears it."
      ),
    activeSupplierProvider: supplierProviderSchema
      .optional()
      .describe("The supplier catalogue used for part lookups."),
    defaultLocationId: z
      .string()
      .min(1)
      .nullable()
      .optional()
      .describe(
        "The workspace's default storage location, used when a part has no default location of its own: a location of this workspace that is not archived (invalid-default-location otherwise); null clears it."
      )
  }),
  output: workspaceDetailsSchema
});

export const loadStarterDictionariesOperation = defineOperation({
  name: "load_starter_dictionaries",
  description:
    "Add the starter dictionaries to the token's workspace: categories, attributes, common manufacturers and suppliers, and extra units. Safe to repeat: nothing existing is duplicated or overwritten, and no parts or stock are added. Needs the user's administrative role in the workspace (workspace-requires-admin).",
  permission: "workspace:write",
  input: z.object({}),
  output: z.object({
    attributesCreated: z.number().int().describe("Attributes added."),
    categoriesCreated: z.number().int().describe("Part categories added."),
    organizationsCreated: z.number().int().describe("Manufacturers and suppliers added."),
    unitsCreated: z.number().int().describe("Units added.")
  })
});

export const displayPreferencesSchema = z.object({
  dateFormat: z
    .enum(DISPLAY_DATE_FORMATS)
    .describe(
      "How dates are shown: \"locale\" (the browser's), \"abbr\" (e.g. Mar 5, 2026), \"YMD\", \"DMY\" or \"MDY\"."
    ),
  timeFormat: z
    .enum(DISPLAY_TIME_FORMATS)
    .describe("How times are shown: \"locale\" (the browser's), \"12h\" or \"24h\"."),
  relativeFormat: z
    .boolean()
    .describe("Whether recent dates are shown relative to now (e.g. \"3 days ago\").")
});

export const getDisplayPreferencesOperation = defineOperation({
  name: "get_display_preferences",
  description: "The user's display preferences: how the app shows dates and times to them, in every workspace.",
  permission: "workspace:read",
  input: z.object({}),
  output: displayPreferencesSchema
});

export const updateDisplayPreferencesOperation = defineOperation({
  name: "update_display_preferences",
  description:
    "Change the user's display preferences (they apply in every workspace). Fields left out keep their value.",
  permission: "workspace:write",
  input: z.object({
    dateFormat: displayPreferencesSchema.shape.dateFormat.optional(),
    timeFormat: displayPreferencesSchema.shape.timeFormat.optional(),
    relativeFormat: displayPreferencesSchema.shape.relativeFormat.optional()
  }),
  output: displayPreferencesSchema
});
