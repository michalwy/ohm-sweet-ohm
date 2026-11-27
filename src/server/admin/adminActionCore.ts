import "server-only";

import { setRegistrationOpen } from "@/server/auth/registration";

import type { FeedbackStatus } from "@/server/feedback/feedbackPolicy";
import { updateFeedbackReport } from "@/server/feedback/feedbackReports";

import { deleteAdminUser, deleteAdminUserData, type AdminDeletionResult } from "./adminUsers";
import { isInstanceAdmin } from "./instanceAdmin";

/**
 * The admin panel's actions (#324) for a known signed-in user id (null when signed out): each
 * refuses anyone who is not an instance administrator before doing anything. The server actions in
 * `adminActions.ts` pass the session's user; integration tests call these directly.
 */

export type AdminActionError =
  | "not-instance-admin"
  | "user-not-found"
  | "cannot-delete-self"
  | "cannot-delete-instance-admin"
  | "feedback-not-found"
  | "invalid-issue-url"
  | "unavailable";

export type AdminActionResult<T> = { ok: true; data: T } | { ok: false; error: AdminActionError };

const knownErrors = new Set<string>([
  "user-not-found",
  "cannot-delete-self",
  "cannot-delete-instance-admin",
  "feedback-not-found",
  "invalid-issue-url"
]);

async function asInstanceAdmin<T>(
  actingUserId: string | null,
  run: (adminId: string) => Promise<T>
): Promise<AdminActionResult<T>> {
  if (!actingUserId || !(await isInstanceAdmin(actingUserId))) {
    return { ok: false, error: "not-instance-admin" };
  }

  try {
    return { ok: true, data: await run(actingUserId) };
  } catch (error) {
    if (error instanceof Error && knownErrors.has(error.message)) {
      return { ok: false, error: error.message as AdminActionError };
    }

    console.error("Admin action failed", error);
    return { ok: false, error: "unavailable" };
  }
}

export function setRegistrationOpenAs(actingUserId: string | null, open: boolean) {
  return asInstanceAdmin(actingUserId, async (adminId) => ({
    open: (await setRegistrationOpen(open, adminId)).open
  }));
}

export function deleteUserAs(
  actingUserId: string | null,
  userId: string,
  deleteData: boolean
): Promise<AdminActionResult<AdminDeletionResult>> {
  return asInstanceAdmin(actingUserId, (adminId) => deleteAdminUser(adminId, userId, { deleteData }));
}

export function deleteUserDataAs(
  actingUserId: string | null,
  userId: string
): Promise<AdminActionResult<AdminDeletionResult>> {
  return asInstanceAdmin(actingUserId, (adminId) => deleteAdminUserData(adminId, userId));
}

/** Triage a feedback report (#325): its status and the GitHub issue it became. */
export function updateFeedbackAs(
  actingUserId: string | null,
  feedbackId: string,
  input: { status?: FeedbackStatus; issueUrl?: string }
): Promise<AdminActionResult<{ status: FeedbackStatus; issueUrl: string | null }>> {
  return asInstanceAdmin(actingUserId, async () => {
    const report = await updateFeedbackReport(feedbackId, input);

    return { status: report.status, issueUrl: report.issueUrl };
  });
}
