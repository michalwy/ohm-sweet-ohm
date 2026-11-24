import "server-only";

import { prisma } from "@/server/db/prisma";
import {
  isDisplayDateFormat,
  isDisplayTimeFormat,
  type DisplayDateFormat,
  type DisplayTimeFormat
} from "@/server/user/displayPreferenceFormats";

/** A user's display preferences (Settings → Display); the server action and the API share this. */

export type DisplayPreferencesChange = {
  dateFormat?: string;
  timeFormat?: string;
  relativeFormat?: boolean;
};

const displayPreferencesSelect = {
  dateFormat: true,
  timeFormat: true,
  relativeFormat: true
} as const;

export type DisplayPreferences = {
  dateFormat: DisplayDateFormat;
  timeFormat: DisplayTimeFormat;
  relativeFormat: boolean;
};

/** A stored value the app no longer offers is shown as the browser's format, as the UI does. */
function toDisplayPreferences(stored: {
  dateFormat: string;
  timeFormat: string;
  relativeFormat: boolean;
}): DisplayPreferences {
  return {
    dateFormat: isDisplayDateFormat(stored.dateFormat) ? stored.dateFormat : "locale",
    timeFormat: isDisplayTimeFormat(stored.timeFormat) ? stored.timeFormat : "locale",
    relativeFormat: stored.relativeFormat
  };
}

export async function getDisplayPreferencesForUser(userId: string) {
  return toDisplayPreferences(
    await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: displayPreferencesSelect })
  );
}

/** Changes the fields given; an unknown date or time format is `invalid-format`. */
export async function updateDisplayPreferencesForUser(
  userId: string,
  change: DisplayPreferencesChange
) {
  if (
    (change.dateFormat !== undefined && !isDisplayDateFormat(change.dateFormat)) ||
    (change.timeFormat !== undefined && !isDisplayTimeFormat(change.timeFormat))
  ) {
    throw new Error("invalid-format");
  }

  return toDisplayPreferences(
    await prisma.user.update({
      where: { id: userId },
      data: {
        dateFormat: change.dateFormat,
        timeFormat: change.timeFormat,
        relativeFormat: change.relativeFormat
      },
      select: displayPreferencesSelect
    })
  );
}
