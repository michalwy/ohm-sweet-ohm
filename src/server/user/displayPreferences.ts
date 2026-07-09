"use server";

import "server-only";

import { getCurrentSession } from "@/server/auth/currentContext";
import { prisma } from "@/server/db/prisma";

const VALID_DATE_FORMATS = ["locale", "abbr", "YMD", "DMY", "MDY"] as const;
const VALID_TIME_FORMATS = ["locale", "12h", "24h"] as const;

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

  const isValidDate = (VALID_DATE_FORMATS as readonly string[]).includes(input.dateFormat);
  const isValidTime = (VALID_TIME_FORMATS as readonly string[]).includes(input.timeFormat);
  if (!isValidDate || !isValidTime) {
    return { ok: false, error: "invalid-format" };
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        dateFormat: input.dateFormat,
        timeFormat: input.timeFormat,
        relativeFormat: input.relativeFormat
      }
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "database-unavailable" };
  }
}
