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
  "organizations:read",
  "organizations:write",
  "parts:read",
  "parts:write",
  "roles:read",
  "roles:write",
  "members:read",
  "members:write",
  "workspace:read",
  "workspace:write",
  "shopping-lists:read",
  "shopping-lists:write",
  "purchase-orders:read",
  "purchase-orders:write",
  "designs:read",
  "designs:write",
  "builds:read",
  "builds:write"
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
  "organizations:read": "Read organizations in a workspace.",
  "organizations:write": "Create, update, and delete organizations in a workspace.",
  "parts:read": "Read parts in a workspace.",
  "parts:write": "Create and update parts in a workspace.",
  "roles:read": "Read roles and permissions in a workspace.",
  "roles:write": "Create, update, and delete roles in a workspace.",
  "members:read": "Read workspace members.",
  "members:write": "Manage workspace members and role assignments.",
  "workspace:read": "Read workspace settings.",
  "workspace:write": "Update workspace settings.",
  "shopping-lists:read": "Read shopping lists and their items in a workspace.",
  "shopping-lists:write": "Create, update, and delete shopping lists and items in a workspace.",
  "purchase-orders:read": "Read purchase orders and their items in a workspace.",
  "purchase-orders:write": "Create, update, and delete purchase orders, mark as ordered, and receive items in a workspace.",
  "designs:read": "Read designs and their revisions in a workspace.",
  "designs:write": "Create, update, and delete designs and revisions in a workspace.",
  "builds:read": "Read builds and their allocation/assembly state in a workspace.",
  "builds:write":
    "Create builds and advance their state (allocate, start, assemble, complete, cancel) in a workspace."
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
      "organizations:read",
      "parts:read",
      "roles:read",
      "members:read",
      "workspace:read",
      "shopping-lists:read",
      "purchase-orders:read",
      "designs:read",
      "builds:read"
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
      "organizations:read",
      "organizations:write",
      "parts:read",
      "parts:write",
      "roles:read",
      "roles:write",
      "members:read",
      "members:write",
      "workspace:read",
      "workspace:write",
      "shopping-lists:read",
      "shopping-lists:write",
      "purchase-orders:read",
      "purchase-orders:write",
      "designs:read",
      "designs:write",
      "builds:read",
      "builds:write"
    ]
  }
] as const satisfies ReadonlyArray<{
  name: string;
  permissions: ReadonlyArray<PermissionKey>;
}>;
