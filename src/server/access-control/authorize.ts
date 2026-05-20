import "server-only";

import { ADMIN_PERMISSION, type PermissionKey } from "@/server/access-control/permissions";
import { prisma } from "@/server/db/prisma";

type WorkspacePermissionInput = {
  userId: string;
  workspaceId: string;
  permission: PermissionKey;
};

export async function hasWorkspacePermission({
  userId,
  workspaceId,
  permission
}: WorkspacePermissionInput) {
  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId
      }
    },
    select: {
      roles: {
        select: {
          role: {
            select: {
              permissions: {
                select: {
                  permissionKey: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!member) {
    return false;
  }

  return member.roles.some(({ role }) =>
    role.permissions.some(
      ({ permissionKey }) =>
        permissionKey === ADMIN_PERMISSION || permissionKey === permission
    )
  );
}

export async function authorizeWorkspacePermission(
  input: WorkspacePermissionInput
) {
  const isAllowed = await hasWorkspacePermission(input);

  if (!isAllowed) {
    throw new Error("workspace_permission_denied");
  }
}
