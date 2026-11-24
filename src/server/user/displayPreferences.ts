"use server";

import "server-only";

import { getCurrentSession } from "@/server/auth/currentContext";
import {
  isDisplayDateFormat,
  isDisplayTimeFormat
} from "@/server/user/displayPreferenceFormats";
import { updateDisplayPreferencesForUser } from "@/server/user/displayPreferenceMutations";

type UpdateUserDisplayPreferencesInput = {
  dateFormat: string;
  timeFormat: string;
  relativeFormat: boolean;
};

type UpdateUserDisplayPreferencesResult =
  | { ok: true }
  | { ok: false; error: "unauthenticated" | "invalid-format" | "database-unavailable" };

export async function updateUserDisplayPreferences(
  input: UpdateUserDisplayPreferencesInput
): Promise<UpdateUserDisplayPreferencesResult> {
  const session = await getCurrentSession();
  if (!session) {
    return { ok: false, error: "unauthenticated" };
  }

  if (!isDisplayDateFormat(input.dateFormat) || !isDisplayTimeFormat(input.timeFormat)) {
    return { ok: false, error: "invalid-format" };
  }

  try {
    await updateDisplayPreferencesForUser(session.user.id, {
      dateFormat: input.dateFormat,
      timeFormat: input.timeFormat,
      relativeFormat: input.relativeFormat
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "database-unavailable" };
  }
}
