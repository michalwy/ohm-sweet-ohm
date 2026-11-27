"use server";

import "server-only";

import { getCurrentSession } from "@/server/auth/currentContext";
import {
  disconnectConnectedApp,
  listConnectedApps,
  type ConnectedApp
} from "@/server/oauth/oauthServer";

/**
 * The signed-in user's connected apps (#322): OAuth clients such as a claude.ai connector that the
 * user approved. Like API tokens, they are managed only by the session's user, never through a
 * token. Every export of this module is a server action.
 */

export type ConnectedAppActionResult =
  | { ok: true; data: { apps: ConnectedApp[] } }
  | { ok: false; error: "unauthenticated" | "connected-app-not-found" | "database-unavailable" };

export async function disconnectConnectedAppAction(grantId: string): Promise<ConnectedAppActionResult> {
  const session = await getCurrentSession();

  if (!session) {
    return { ok: false, error: "unauthenticated" };
  }

  try {
    await disconnectConnectedApp(session.user.id, String(grantId));

    return { ok: true, data: { apps: await listConnectedApps(session.user.id) } };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error && error.message === "connected-app-not-found"
          ? "connected-app-not-found"
          : "database-unavailable"
    };
  }
}
