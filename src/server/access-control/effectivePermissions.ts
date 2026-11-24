import {
  ADMIN_PERMISSION,
  PERMISSIONS,
  type PermissionKey
} from "@/server/access-control/permissions";

/**
 * The permissions an actor holds in one workspace (ADR 0030).
 *
 * For a browser session they are the permission keys of the user's roles. For an API token they
 * are the token's permission set intersected with those roles, so a token never grants more than
 * its user holds, and a role the user loses is lost by the token on its next request.
 *
 * `admin` stays a wildcard (ADR 0005): a set holding it grants every permission.
 */
export type EffectivePermissions = ReadonlySet<PermissionKey>;

export function permissionSetGrants(
  permissions: Iterable<PermissionKey>,
  permission: PermissionKey
) {
  const set = permissions instanceof Set ? permissions : new Set(permissions);

  return set.has(ADMIN_PERMISSION) || set.has(permission);
}

export function getEffectivePermissions({
  rolePermissions,
  tokenPermissions
}: {
  rolePermissions: Iterable<PermissionKey>;
  /** `null` for a browser session: the roles apply unrestricted. */
  tokenPermissions: Iterable<PermissionKey> | null;
}): EffectivePermissions {
  const roles = new Set(rolePermissions);

  if (tokenPermissions === null) {
    return roles;
  }

  const token = new Set(tokenPermissions);
  const effective = new Set<PermissionKey>();

  for (const permission of PERMISSIONS) {
    if (permission === ADMIN_PERMISSION) {
      if (roles.has(ADMIN_PERMISSION) && token.has(ADMIN_PERMISSION)) {
        effective.add(ADMIN_PERMISSION);
      }

      continue;
    }

    if (permissionSetGrants(roles, permission) && permissionSetGrants(token, permission)) {
      effective.add(permission);
    }
  }

  return effective;
}
