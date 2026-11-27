"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { getCurrentSession } from "@/server/auth/currentContext";
import { FEEDBACK_STATUSES, type FeedbackStatus } from "@/server/feedback/feedbackPolicy";

import {
  deleteUserAs,
  deleteUserDataAs,
  setRegistrationOpenAs,
  updateFeedbackAs,
  type AdminActionResult
} from "./adminActionCore";
import type { AdminDeletionResult } from "./adminUsers";

/**
 * The admin panel's server actions (#324, feedback triage #325). Each acts for the signed-in user, and refuses anyone who
 * is not an instance administrator (`adminActionCore.ts`). Every export of this module is a server
 * action.
 */

async function sessionUserId() {
  return (await getCurrentSession())?.user.id ?? null;
}

function revalidateOnSuccess<T>(result: AdminActionResult<T>) {
  if (result.ok) {
    revalidatePath("/admin", "layout");
  }

  return result;
}

export async function setRegistrationOpenAction(open: boolean): Promise<AdminActionResult<{ open: boolean }>> {
  return revalidateOnSuccess(await setRegistrationOpenAs(await sessionUserId(), Boolean(open)));
}

export async function deleteUserAction(
  userId: string,
  deleteData: boolean
): Promise<AdminActionResult<AdminDeletionResult>> {
  return revalidateOnSuccess(await deleteUserAs(await sessionUserId(), String(userId), Boolean(deleteData)));
}

export async function deleteUserDataAction(userId: string): Promise<AdminActionResult<AdminDeletionResult>> {
  return revalidateOnSuccess(await deleteUserDataAs(await sessionUserId(), String(userId)));
}

export async function updateFeedbackAction(
  feedbackId: string,
  input: { status: FeedbackStatus; issueUrl: string }
): Promise<AdminActionResult<{ status: FeedbackStatus; issueUrl: string | null }>> {
  const status = FEEDBACK_STATUSES.find((value) => value === input?.status);

  return revalidateOnSuccess(
    await updateFeedbackAs(await sessionUserId(), String(feedbackId), {
      status,
      issueUrl: typeof input?.issueUrl === "string" ? input.issueUrl : undefined
    })
  );
}
