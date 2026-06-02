import "server-only";

import { ADMIN_PERMISSION } from "@/server/access-control/permissions";
import { prisma } from "@/server/db/prisma";

type AssignMemberRolesInput = {
  workspaceMemberId: string;
  roleIds: string[];
};

export async function assignWorkspaceMemberRoles({
  workspaceMemberId,
  roleIds
}: AssignMemberRolesInput) {
  const uniqueRoleIds = [...new Set(roleIds)];

  if (uniqueRoleIds.length === 0) {
    throw new Error("member-requires-role");
  }

  const member = await prisma.workspaceMember.findUniqueOrThrow({
    where: { id: workspaceMemberId },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: true
            }
          }
        }
      }
    }
  });

  const roles = await prisma.role.findMany({
    where: {
      id: { in: uniqueRoleIds },
      workspaceId: member.workspaceId
    },
    select: { id: true }
  });

  if (roles.length !== uniqueRoleIds.length) {
    throw new Error("role-not-in-workspace");
  }

  const currentlyHasAdmin = member.roles.some(({ role }) =>
    role.permissions.some(({ permissionKey }) => permissionKey === ADMIN_PERMISSION)
  );
  const willHaveAdmin = await prisma.role.findFirst({
    where: {
      id: { in: uniqueRoleIds },
      permissions: {
        some: {
          permissionKey: ADMIN_PERMISSION
        }
      }
    },
    select: { id: true }
  });

  if (currentlyHasAdmin && !willHaveAdmin) {
    await assertWorkspaceKeepsAdminMember(member.workspaceId, member.id);
  }

  return prisma.$transaction(async (tx) => {
    await tx.workspaceMemberRole.deleteMany({
      where: { workspaceMemberId }
    });

    await tx.workspaceMemberRole.createMany({
      data: uniqueRoleIds.map((roleId) => ({
        workspaceMemberId,
        roleId
      }))
    });
  });
}

async function assertWorkspaceKeepsAdminMember(
  workspaceId: string,
  excludedWorkspaceMemberId: string
) {
  const otherAdminMember = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      id: {
        not: excludedWorkspaceMemberId
      },
      roles: {
        some: {
          role: {
            permissions: {
              some: {
                permissionKey: ADMIN_PERMISSION
              }
            }
          }
        }
      }
    },
    select: { id: true }
  });

  if (!otherAdminMember) {
    throw new Error("workspace-requires-admin");
  }
}
