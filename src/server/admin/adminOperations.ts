import { z } from "zod";

import { defineOperation } from "@/server/api/operations";

/**
 * The instance administrator's operations (#324), offered as the `admin_…` MCP tools. Pure, so unit
 * tests can load it; the implementations are in `adminApi.ts`.
 *
 * They are not workspace operations: no workspace permission key describes them, so `permission`
 * is `null` and every implementation checks instead that the token's user is an instance
 * administrator — and, for a tool that changes anything, that the token may write
 * (`requireInstanceAdminActor`). The MCP server lists these tools only to an instance
 * administrator. There are no REST endpoints for them.
 */

const ADMIN_ONLY = "Instance administrators only.";

const userIdInput = z.string().min(1).max(64).describe("The user's id, from admin_list_users.");

export const adminUserWorkspaceSchema = z.object({
  id: z.string().describe("The workspace's id."),
  name: z.string().describe("The workspace's name."),
  slug: z.string().describe("The workspace's slug, as in its URL /w/<slug>."),
  roles: z.array(z.string()).describe("The user's role names in the workspace, sorted."),
  owner: z.boolean().describe("Whether the user holds the owner role in the workspace."),
  solelyOwned: z
    .boolean()
    .describe("Whether the user owns it and no other member does: deleting the user's data deletes it."),
  memberCount: z.number().int().describe("How many members the workspace has, the user included."),
  archived: z.boolean().describe("Whether the workspace is archived.")
});

export const adminUserSchema = z.object({
  id: z.string().describe("The user's id."),
  email: z.string().describe("The user's email address."),
  name: z.string().nullable().describe("The user's display name; null when unset."),
  createdAt: z.iso.datetime().describe("When the account was created (ISO 8601, UTC)."),
  instanceAdmin: z.boolean().describe("Whether the user is an instance administrator."),
  workspaces: z.array(adminUserWorkspaceSchema).describe("The workspaces the user is a member of.")
});

const workspaceRefSchema = z.object({
  id: z.string().describe("The workspace's id."),
  name: z.string().describe("The workspace's name."),
  slug: z.string().describe("The workspace's slug.")
});

export const adminDeletionResultSchema = z.object({
  deletedWorkspaces: z
    .array(workspaceRefSchema)
    .describe("The workspaces deleted, with everything in them."),
  userDeleted: z.boolean().describe("Whether the account itself was deleted.")
});

export const registrationStateSchema = z.object({
  open: z.boolean().describe("Whether new accounts may register now."),
  source: z
    .enum(["runtime", "config"])
    .describe("runtime when an administrator set it; config when it is the configuration default."),
  configDefault: z.boolean().describe("The configuration default (OSO_AUTH_ALLOW_SIGN_UP)."),
  updatedAt: z.iso.datetime().nullable().describe("When an administrator last set it; null when never."),
  updatedByUserId: z.string().nullable().describe("Who set it last; null when never.")
});

export const adminListUsersOperation = defineOperation({
  name: "admin_list_users",
  description: `${ADMIN_ONLY} Every account on the instance, oldest first, with the workspaces each belongs to (role, member count, whether the user solely owns it).`,
  permission: null,
  input: z.object({}),
  output: z.object({ users: z.array(adminUserSchema).describe("Every account, oldest first.") })
});

export const adminGetUserOperation = defineOperation({
  name: "admin_get_user",
  description: `${ADMIN_ONLY} One account with the workspaces it belongs to.`,
  permission: null,
  input: z.object({ userId: userIdInput }),
  output: adminUserSchema
});

export const adminDeleteUserOperation = defineOperation({
  name: "admin_delete_user",
  description: `${ADMIN_ONLY} Delete an account at once, not restorable: its sessions, API tokens, connected apps and memberships, and every workspace it was the only member of. With deleteData, every workspace it solely owns is deleted too. An administrator cannot delete themselves or another administrator.`,
  permission: null,
  input: z.object({
    userId: userIdInput,
    deleteData: z
      .boolean()
      .default(false)
      .describe("Also delete every workspace the user solely owns, with everything in it. Default false.")
  }),
  output: adminDeletionResultSchema
});

export const adminDeleteUserDataOperation = defineOperation({
  name: "admin_delete_user_data",
  description: `${ADMIN_ONLY} Delete a user's data entirely, at once and not restorable: every workspace the user solely owns, with everything in it. The account and co-owned workspaces stay.`,
  permission: null,
  input: z.object({ userId: userIdInput }),
  output: adminDeletionResultSchema
});

export const adminGetStorageUsageOperation = defineOperation({
  name: "admin_get_storage_usage",
  description: `${ADMIN_ONLY} Storage used, in bytes: the whole database, each workspace (its rows), and each user (the sum over the workspaces they are a member of, so a shared workspace counts for each member).`,
  permission: null,
  input: z.object({}),
  output: z.object({
    databaseBytes: z.number().int().describe("The whole database on disk, in bytes."),
    workspaces: z
      .array(workspaceRefSchema.extend({ bytes: z.number().int().describe("Bytes of the workspace's rows.") }))
      .describe("Every workspace, oldest first."),
    users: z
      .array(
        z.object({
          id: z.string().describe("The user's id."),
          email: z.string().describe("The user's email address."),
          bytes: z.number().int().describe("Sum of the bytes of the user's workspaces.")
        })
      )
      .describe("Every account, oldest first.")
  })
});

export const adminGetRegistrationOperation = defineOperation({
  name: "admin_get_registration",
  description: `${ADMIN_ONLY} Whether new accounts may register, and whether that is the configuration default or an administrator's setting.`,
  permission: null,
  input: z.object({}),
  output: registrationStateSchema
});

export const adminSetRegistrationOpenOperation = defineOperation({
  name: "admin_set_registration_open",
  description: `${ADMIN_ONLY} Open or close new-account registration now; it overrides the configuration default until changed again. An instance with no accounts always lets the first one register.`,
  permission: null,
  input: z.object({ open: z.boolean().describe("true opens registration, false closes it.") }),
  output: registrationStateSchema
});
