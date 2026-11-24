import "server-only";

import { z } from "zod";

import type { PermissionKey } from "@/server/access-control/permissions";
import {
  API_TOKEN_ACCESS_LEVELS,
  isApiTokenPermissionKey,
  resolveApiTokenPermissions,
  type ApiTokenAccess
} from "@/server/api-tokens/apiTokenPermissions";
import {
  generateApiTokenValue,
  hashApiTokenValue,
  isWellFormedApiToken
} from "@/server/api-tokens/apiTokenValue";
import { prisma } from "@/server/db/prisma";

/**
 * Personal API tokens (ADR 0030, #273). A token belongs to one user, is bound to one of that
 * user's workspaces and to a permission set, and may expire. Its value is returned once, by
 * `createApiToken`; only its SHA-256 hash is stored. Revoking deletes it.
 *
 * Verification (`verifyApiToken`) checks only the token itself — shape, hash, expiry. The
 * workspace side (membership, archived workspace, the intersection with the user's roles) is
 * `resolveTokenActor`'s, through the same `resolveMemberActor` a session uses.
 */

export const API_TOKEN_NAME_MAX_LENGTH = 100;

/** How often, at most, a token's last-used time is written: once a minute, not on every request. */
const LAST_USED_RESOLUTION_MS = 60_000;

export const createApiTokenInputSchema = z.object({
  workspaceId: z.string().min(1).describe("The workspace the token acts in."),
  name: z
    .string()
    .trim()
    .min(1, "api-token-name-required")
    .max(API_TOKEN_NAME_MAX_LENGTH, "api-token-name-too-long")
    .describe("A name that tells the user what the token is for."),
  access: z.enum(API_TOKEN_ACCESS_LEVELS).describe("read-only, read-write, or custom."),
  permissions: z
    .array(z.string())
    .default([])
    .describe("The permission keys of a custom token; ignored for the presets."),
  expiresAt: z
    .union([z.iso.datetime(), z.null()])
    .default(null)
    .describe("When the token stops working, or null for no expiry.")
});

export type CreateApiTokenInput = z.input<typeof createApiTokenInputSchema>;

export type ApiTokenError =
  | "invalid-input"
  | "api-token-name-required"
  | "api-token-name-too-long"
  | "api-token-permissions-required"
  | "api-token-invalid-permission"
  | "api-token-expiry-in-past"
  | "workspace-not-found"
  | "api-token-not-found";

export class ApiTokenDomainError extends Error {
  constructor(readonly code: ApiTokenError) {
    super(code);
    this.name = "ApiTokenDomainError";
  }
}

export type ApiTokenStatus = "active" | "expired" | "workspace-archived" | "no-access";

export type ApiTokenSummary = {
  id: string;
  name: string;
  workspace: { id: string; name: string; slug: string };
  access: ApiTokenAccess;
  /** The token's own set, before the intersection with its user's roles. */
  permissions: PermissionKey[];
  createdAt: Date;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  status: ApiTokenStatus;
};

/** What a verified API token says about itself. */
export type VerifiedApiToken = {
  tokenId: string;
  userId: string;
  workspaceId: string;
  permissions: PermissionKey[];
};

const summarySelect = {
  id: true,
  name: true,
  access: true,
  permissions: true,
  createdAt: true,
  expiresAt: true,
  lastUsedAt: true,
  workspace: { select: { id: true, name: true, slug: true, archivedAt: true } }
} as const;

function parseCreateInput(raw: CreateApiTokenInput) {
  const parsed = createApiTokenInputSchema.safeParse(raw);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message;

    if (message === "api-token-name-required" || message === "api-token-name-too-long") {
      throw new ApiTokenDomainError(message);
    }

    throw new ApiTokenDomainError("invalid-input");
  }

  return parsed.data;
}

function toAccess(value: string): ApiTokenAccess {
  return (API_TOKEN_ACCESS_LEVELS as readonly string[]).includes(value)
    ? (value as ApiTokenAccess)
    : "custom";
}

/**
 * Creates a token for `userId`, who must be a member of the (active) workspace. Returns the token's
 * summary and its value — the only time the value exists outside the caller's hands.
 *
 * The permission set is not limited to what the user holds today: the intersection with the user's
 * roles is taken on every request, so a role granted later widens the token up to its own set.
 */
export async function createApiToken(
  userId: string,
  raw: CreateApiTokenInput,
  now: Date = new Date()
): Promise<{ token: ApiTokenSummary; value: string }> {
  const input = parseCreateInput(raw);

  let permissions: string[] = [];

  if (input.access === "custom") {
    if (input.permissions.some((key) => !isApiTokenPermissionKey(key))) {
      throw new ApiTokenDomainError("api-token-invalid-permission");
    }

    permissions = [...new Set(input.permissions)];

    if (permissions.length === 0) {
      throw new ApiTokenDomainError("api-token-permissions-required");
    }
  }

  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

  if (expiresAt && expiresAt.getTime() <= now.getTime()) {
    throw new ApiTokenDomainError("api-token-expiry-in-past");
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId, workspaceId: input.workspaceId, workspace: { archivedAt: null } },
    select: { id: true }
  });

  if (!membership) {
    throw new ApiTokenDomainError("workspace-not-found");
  }

  const value = generateApiTokenValue();
  const created = await prisma.apiToken.create({
    data: {
      userId,
      workspaceId: input.workspaceId,
      name: input.name,
      tokenHash: hashApiTokenValue(value),
      access: input.access,
      permissions,
      expiresAt
    },
    select: summarySelect
  });

  return {
    token: {
      id: created.id,
      name: created.name,
      workspace: {
        id: created.workspace.id,
        name: created.workspace.name,
        slug: created.workspace.slug
      },
      access: toAccess(created.access),
      permissions: resolveApiTokenPermissions(created.access, created.permissions),
      createdAt: created.createdAt,
      expiresAt: created.expiresAt,
      lastUsedAt: created.lastUsedAt,
      status: "active"
    },
    value
  };
}

/** Every token of `userId`, newest first, with whether it would be accepted now. */
export async function listApiTokensForUser(
  userId: string,
  now: Date = new Date()
): Promise<ApiTokenSummary[]> {
  const tokens = await prisma.apiToken.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: summarySelect
  });

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId, workspaceId: { in: [...new Set(tokens.map((t) => t.workspace.id))] } },
    select: { workspaceId: true }
  });
  const memberOf = new Set(memberships.map((m) => m.workspaceId));

  return tokens.map((token) => {
    let status: ApiTokenStatus = "active";

    if (!memberOf.has(token.workspace.id)) {
      status = "no-access";
    } else if (token.workspace.archivedAt) {
      status = "workspace-archived";
    } else if (token.expiresAt && token.expiresAt.getTime() <= now.getTime()) {
      status = "expired";
    }

    return {
      id: token.id,
      name: token.name,
      workspace: { id: token.workspace.id, name: token.workspace.name, slug: token.workspace.slug },
      access: toAccess(token.access),
      permissions: resolveApiTokenPermissions(token.access, token.permissions),
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      lastUsedAt: token.lastUsedAt,
      status
    };
  });
}

/** Revokes (deletes) one of `userId`'s own tokens; another user's token is "not found". */
export async function revokeApiToken(userId: string, tokenId: string) {
  const { count } = await prisma.apiToken.deleteMany({ where: { id: tokenId, userId } });

  if (count === 0) {
    throw new ApiTokenDomainError("api-token-not-found");
  }
}

/**
 * Checks a raw token value: well formed, known by its hash, not expired. `null` otherwise. The
 * workspace checks happen in `resolveTokenActor`.
 */
export async function verifyApiToken(
  value: string,
  now: Date = new Date()
): Promise<VerifiedApiToken | null> {
  if (!isWellFormedApiToken(value)) {
    return null;
  }

  const token = await prisma.apiToken.findUnique({
    where: { tokenHash: hashApiTokenValue(value) },
    select: { id: true, userId: true, workspaceId: true, access: true, permissions: true, expiresAt: true }
  });

  if (!token) {
    return null;
  }

  if (token.expiresAt && token.expiresAt.getTime() <= now.getTime()) {
    return null;
  }

  return {
    tokenId: token.id,
    userId: token.userId,
    workspaceId: token.workspaceId,
    permissions: resolveApiTokenPermissions(token.access, token.permissions)
  };
}

/** Records that a token was used, at most once a minute per token. */
export async function recordApiTokenUse(tokenId: string, now: Date = new Date()) {
  await prisma.apiToken.updateMany({
    where: {
      id: tokenId,
      OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: new Date(now.getTime() - LAST_USED_RESOLUTION_MS) } }]
    },
    data: { lastUsedAt: now }
  });
}
