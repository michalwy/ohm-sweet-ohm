import "server-only";

import { prisma } from "@/server/db/prisma";

/**
 * Storage used, for the admin panel (#324). OhmSweetOhm keeps everything in PostgreSQL — there are
 * no uploaded files — so storage is measured in the database:
 *
 * - the instance: `pg_database_size`, the whole database on disk (indexes, free space and
 *   PostgreSQL's own catalogs included);
 * - a workspace: the size of its rows (`pg_column_size` of each row) in every table that carries
 *   `workspaceId`, plus the workspace row and the child tables that reach a workspace through their
 *   parent (listed below). Indexes and table overhead are not attributed, so the workspace figures
 *   add up to less than the database size;
 * - a user: the sum over the workspaces they are a member of, so a shared workspace counts for each
 *   of its members (as in Darkroom and Stamporama).
 */

/** Tables without `workspaceId` that belong to a workspace through a parent table that has it. */
const CHILD_TABLES = [
  { table: "AttributeChoiceOption", foreignKey: "attributeId", parent: "Attribute" },
  { table: "OrganizationRole", foreignKey: "organizationId", parent: "Organization" },
  { table: "ShoppingListItem", foreignKey: "shoppingListId", parent: "ShoppingList" },
  { table: "PurchaseOrderItem", foreignKey: "purchaseOrderId", parent: "PurchaseOrder" },
  { table: "PurchaseOrderAdditionalCost", foreignKey: "purchaseOrderId", parent: "PurchaseOrder" },
  { table: "WorkspaceMemberRole", foreignKey: "workspaceMemberId", parent: "WorkspaceMember" },
  { table: "RolePermission", foreignKey: "roleId", parent: "Role" },
  { table: "OAuthAuthorizationCode", foreignKey: "grantId", parent: "OAuthGrant" },
  { table: "OAuthToken", foreignKey: "grantId", parent: "OAuthGrant" }
] as const;

export type StorageUsage = {
  /** The whole database, in bytes. */
  databaseBytes: number;
  workspaces: { id: string; name: string; slug: string; bytes: number }[];
  users: { id: string; email: string; bytes: number }[];
};

function quoteIdentifier(name: string) {
  return `"${name.replaceAll('"', '""')}"`;
}

/** Bytes of row data per workspace id. */
async function measureWorkspaceBytes(): Promise<Map<string, number>> {
  const tables = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND column_name = 'workspaceId'
    ORDER BY table_name`;

  const parts = [
    `SELECT w."id" AS "workspaceId", pg_column_size(w.*)::bigint AS bytes FROM "Workspace" w`,
    ...tables.map(
      ({ table_name }) =>
        `SELECT t."workspaceId", SUM(pg_column_size(t.*))::bigint FROM ${quoteIdentifier(table_name)} t GROUP BY 1`
    ),
    ...CHILD_TABLES.map(
      ({ table, foreignKey, parent }) =>
        `SELECT p."workspaceId", SUM(pg_column_size(c.*))::bigint FROM ${quoteIdentifier(table)} c JOIN ${quoteIdentifier(parent)} p ON p."id" = c.${quoteIdentifier(foreignKey)} GROUP BY 1`
    )
  ];

  // Identifiers come from the database's own catalog and the constant list above, never from input.
  const rows = await prisma.$queryRawUnsafe<{ workspaceId: string; bytes: bigint }[]>(
    `SELECT "workspaceId", SUM(bytes)::bigint AS bytes FROM (${parts.join(" UNION ALL ")}) s GROUP BY 1`
  );

  return new Map(rows.map((row) => [row.workspaceId, Number(row.bytes)]));
}

export async function getStorageUsage(): Promise<StorageUsage> {
  const [[database], bytesByWorkspace, workspaces, users] = await Promise.all([
    prisma.$queryRaw<{ bytes: bigint }[]>`SELECT pg_database_size(current_database())::bigint AS bytes`,
    measureWorkspaceBytes(),
    prisma.workspace.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    }),
    prisma.user.findMany({
      select: { id: true, email: true, memberships: { select: { workspaceId: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    })
  ]);

  const workspaceBytes = (id: string) => bytesByWorkspace.get(id) ?? 0;

  return {
    databaseBytes: Number(database?.bytes ?? 0),
    workspaces: workspaces.map((workspace) => ({ ...workspace, bytes: workspaceBytes(workspace.id) })),
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      bytes: user.memberships.reduce((sum, { workspaceId }) => sum + workspaceBytes(workspaceId), 0)
    }))
  };
}
