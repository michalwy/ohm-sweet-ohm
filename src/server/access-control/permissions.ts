export const ADMIN_PERMISSION = "admin";
export const OWNER_ROLE_NAME = "owner";

export const PERMISSIONS = [
  ADMIN_PERMISSION,
  "part-categories:read",
  "part-categories:write",
  "attributes:read",
  "attributes:write",
  "units:read",
  "units:write",
  "locations:read",
  "locations:write",
  "inventory:read",
  "inventory:write",
  "parts:read",
  "parts:write",
  "roles:read",
  "roles:write",
  "members:read",
  "members:write",
  "workspace:read",
  "workspace:write"
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export const permissionDescriptions: Record<PermissionKey, string> = {
  admin: "Administrative access to every workspace permission.",
  "part-categories:read": "Read part categories in a workspace.",
  "part-categories:write": "Create, update, and delete part categories in a workspace.",
  "attributes:read": "Read part attributes in a workspace.",
  "attributes:write": "Create, update, and delete part attributes in a workspace.",
  "units:read": "Read units in a workspace.",
  "units:write": "Create, update, and delete units in a workspace.",
  "locations:read": "Read storage locations in a workspace.",
  "locations:write": "Create, update, archive, and delete storage locations in a workspace.",
  "inventory:read": "Read inventory balances and history in a workspace.",
  "inventory:write": "Create inventory entries in a workspace.",
  "parts:read": "Read parts in a workspace.",
  "parts:write": "Create and update parts in a workspace.",
  "roles:read": "Read roles and permissions in a workspace.",
  "roles:write": "Create, update, and delete roles in a workspace.",
  "members:read": "Read workspace members.",
  "members:write": "Manage workspace members and role assignments.",
  "workspace:read": "Read workspace settings.",
  "workspace:write": "Update workspace settings."
};

export const defaultWorkspaceRoles = [
  {
    name: OWNER_ROLE_NAME,
    permissions: [ADMIN_PERMISSION]
  },
  {
    name: "reader",
    permissions: [
      "part-categories:read",
      "attributes:read",
      "units:read",
      "locations:read",
      "inventory:read",
      "parts:read",
      "roles:read",
      "members:read",
      "workspace:read"
    ]
  },
  {
    name: "editor",
    permissions: [
      "part-categories:read",
      "part-categories:write",
      "attributes:read",
      "attributes:write",
      "units:read",
      "units:write",
      "locations:read",
      "locations:write",
      "inventory:read",
      "inventory:write",
      "parts:read",
      "parts:write",
      "roles:read",
      "roles:write",
      "members:read",
      "members:write",
      "workspace:read",
      "workspace:write"
    ]
  }
] as const satisfies ReadonlyArray<{
  name: string;
  permissions: ReadonlyArray<PermissionKey>;
}>;
