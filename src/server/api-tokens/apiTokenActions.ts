"use server";

import "server-only";

import {
  ApiTokenDomainError,
  createApiToken,
  listApiTokensForUser,
  revokeApiToken,
  type ApiTokenError,
  type ApiTokenSummary,
  type CreateApiTokenInput
} from "@/server/api-tokens/apiTokens";
import { getCurrentSession } from "@/server/auth/currentContext";

/**
 * The signed-in user's management of their own API tokens (#273). Tokens are personal: these
 * actions act on the session's user only, never through a token — a token cannot create, list or
 * revoke tokens. Every export of this module is a server action.
 */

type ActionError = ApiTokenError | "unauthenticated" | "database-unavailable";

export type ApiTokenActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

function toActionError(error: unknown): { ok: false; error: ActionError } {
  if (error instanceof ApiTokenDomainError) {
    return { ok: false, error: error.code };
  }

  return { ok: false, error: "database-unavailable" };
}

export async function createApiTokenAction(
  input: CreateApiTokenInput
): Promise<ApiTokenActionResult<{ token: ApiTokenSummary; value: string; tokens: ApiTokenSummary[] }>> {
  const session = await getCurrentSession();

  if (!session) {
    return { ok: false, error: "unauthenticated" };
  }

  try {
    const created = await createApiToken(session.user.id, input);
    const tokens = await listApiTokensForUser(session.user.id);

    return { ok: true, data: { ...created, tokens } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function revokeApiTokenAction(
  tokenId: string
): Promise<ApiTokenActionResult<{ tokens: ApiTokenSummary[] }>> {
  const session = await getCurrentSession();

  if (!session) {
    return { ok: false, error: "unauthenticated" };
  }

  try {
    await revokeApiToken(session.user.id, String(tokenId));

    return { ok: true, data: { tokens: await listApiTokensForUser(session.user.id) } };
  } catch (error) {
    return toActionError(error);
  }
}
