import {
  ADMIN_PERMISSION,
  PERMISSIONS,
  type PermissionKey
} from "@/server/access-control/permissions";

/**
 * A personal API token's permission set (ADR 0030, #273): read-only, read-write, or a custom subset
 * of the workspace permission keys. Pure, so the UI and unit tests can load it.
 *
 * The two presets are stored by name and resolved when the token is used, so a permission key added
 * later (a new area) reaches existing read-only and read-write tokens. `admin` is never part of a
 * token's set: a token holds named permissions only, and its effective rights are that set
 * intersected with its user's roles (`effectivePermissions.ts`).
 */
export const API_TOKEN_ACCESS_LEVELS = ["read-only", "read-write", "custom"] as const;

export type ApiTokenAccess = (typeof API_TOKEN_ACCESS_LEVELS)[number];

/** The keys a custom token may hold: every workspace permission key except `admin`. */
export const API_TOKEN_PERMISSION_KEYS = PERMISSIONS.filter(
  (key): key is Exclude<PermissionKey, typeof ADMIN_PERMISSION> => key !== ADMIN_PERMISSION
);

const tokenPermissionKeys = new Set<string>(API_TOKEN_PERMISSION_KEYS);

export function isApiTokenAccess(value: string): value is ApiTokenAccess {
  return (API_TOKEN_ACCESS_LEVELS as readonly string[]).includes(value);
}

export function isApiTokenPermissionKey(value: string): value is PermissionKey {
  return tokenPermissionKeys.has(value);
}

/**
 * The permission keys a token holds, before the intersection with its user's roles. Unknown keys in
 * a stored custom set (a key since removed) are ignored; an unknown access level holds nothing.
 */
export function resolveApiTokenPermissions(
  access: string,
  customPermissions: readonly string[]
): PermissionKey[] {
  if (access === "read-only") {
    return API_TOKEN_PERMISSION_KEYS.filter((key) => key.endsWith(":read"));
  }

  if (access === "read-write") {
    return [...API_TOKEN_PERMISSION_KEYS];
  }

  if (access === "custom") {
    return API_TOKEN_PERMISSION_KEYS.filter((key) => customPermissions.includes(key));
  }

  return [];
}
