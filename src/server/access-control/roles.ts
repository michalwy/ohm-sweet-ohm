import "server-only";

import {
  ADMIN_PERMISSION,
  PERMISSIONS,
  type PermissionKey
} from "@/server/access-control/permissions";
import { prisma } from "@/server/db/prisma";

const permissionSet = new Set<string>(PERMISSIONS);

type RoleInput = {
  workspaceId: string;
  name: string;
  permissions: PermissionKey[];
};

export async function getWorkspaceRoles(workspaceId: string) {
  return prisma.role.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      isSystem: true,
      permissions: {
        orderBy: { permissionKey: "asc" },
        select: {
          permissionKey: true
        }
      }
    }
  });
}

export async function createWorkspaceRole(input: RoleInput) {
  const permissions = validateRoleInput(input);

  return prisma.role.create({
    data: {
      workspaceId: input.workspaceId,
      name: input.name.trim(),
      permissions: {
        create: permissions.map((permissionKey) => ({
          permissionKey
        }))
      }
    }
  });
}

export async function updateWorkspaceRole(
  roleId: string,
  input: Omit<RoleInput, "workspaceId">
) {
  const permissions = validateRoleInput({
    workspaceId: "unused",
    ...input
  });
  const role = await prisma.role.findUniqueOrThrow({
    where: { id: roleId },
    include: {
      permissions: true
    }
  });

  if (
    role.permissions.some(({ permissionKey }) => permissionKey === ADMIN_PERMISSION) &&
    !permissions.includes(ADMIN_PERMISSION)
  ) {
    await assertWorkspaceKeepsAnotherAdmin(role.workspaceId, role.id);
  }

  return prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({
      where: { roleId }
    });

    return tx.role.update({
      where: { id: roleId },
      data: {
        name: input.name.trim(),
        permissions: {
          create: permissions.map((permissionKey) => ({
            permissionKey
          }))
        }
      }
    });
  });
}

export async function deleteWorkspaceRole(roleId: string) {
  const role = await prisma.role.findUniqueOrThrow({
    where: { id: roleId },
    include: {
      permissions: true
    }
  });

  if (role.isSystem) {
    throw new Error("system-role-cannot-be-deleted");
  }

  if (
    role.permissions.some(({ permissionKey }) => permissionKey === ADMIN_PERMISSION)
  ) {
    await assertWorkspaceKeepsAnotherAdmin(role.workspaceId, role.id);
  }

  await prisma.role.delete({
    where: { id: roleId }
  });
}

function validateRoleInput(input: RoleInput) {
  const name = input.name.trim();
  const permissions = [...new Set(input.permissions)];

  if (!name) {
    throw new Error("role-name-required");
  }

  if (permissions.length === 0) {
    throw new Error("role-requires-permission");
  }

  for (const permission of permissions) {
    if (!permissionSet.has(permission)) {
      throw new Error("unknown-permission");
    }
  }

  return permissions;
}

async function assertWorkspaceKeepsAnotherAdmin(
  workspaceId: string,
  excludedRoleId: string
) {
  const otherAdminMember = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      roles: {
        some: {
          roleId: {
            not: excludedRoleId
          },
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
