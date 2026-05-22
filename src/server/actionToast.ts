import "server-only";

import { cookies } from "next/headers";

import { ACTION_TOAST_COOKIE_NAME } from "@/lib/actionToastCookie";

export type ActionToast =
  | {
      type: "part-created" | "part-updated";
      catalogNumber: string;
      manufacturerName: string;
    }
  | {
      type: "category-created" | "category-updated";
      name: string;
    };

export async function getActionToast() {
  const cookieStore = await cookies();
  const value = cookieStore.get(ACTION_TOAST_COOKIE_NAME)?.value;

  if (!value) {
    return null;
  }

  try {
    return parseActionToast(JSON.parse(value));
  } catch {
    return null;
  }
}

export async function setActionToast(toast: ActionToast) {
  const cookieStore = await cookies();

  cookieStore.set(ACTION_TOAST_COOKIE_NAME, JSON.stringify(toast), {
    httpOnly: false,
    maxAge: 30,
    path: "/",
    sameSite: "lax",
    secure: shouldUseSecureCookies()
  });
}

function parseActionToast(value: unknown): ActionToast | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (
    hasStringProperty(value, "type") &&
    (value.type === "part-created" || value.type === "part-updated") &&
    hasStringProperty(value, "catalogNumber") &&
    hasStringProperty(value, "manufacturerName")
  ) {
    return {
      type: value.type,
      catalogNumber: value.catalogNumber,
      manufacturerName: value.manufacturerName
    };
  }

  if (
    hasStringProperty(value, "type") &&
    (value.type === "category-created" || value.type === "category-updated") &&
    hasStringProperty(value, "name")
  ) {
    return {
      type: value.type,
      name: value.name
    };
  }

  return null;
}

function hasStringProperty(
  value: object,
  property: string
): value is Record<string, string> {
  return (
    Object.prototype.hasOwnProperty.call(value, property) &&
    typeof (value as Record<string, unknown>)[property] === "string"
  );
}

function shouldUseSecureCookies() {
  const authUrl = process.env.BETTER_AUTH_URL;

  if (!authUrl) {
    return process.env.NODE_ENV === "production";
  }

  try {
    return new URL(authUrl).protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}
