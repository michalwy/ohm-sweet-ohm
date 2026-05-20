import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";

import {
  defaultWorkspaceRoles,
  permissionDescriptions,
  PERMISSIONS
} from "@/server/access-control/permissions";
import { prisma } from "@/server/db/prisma";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

type CreateWorkspaceInput = {
  name: string;
  slug: string;
};

export async function createWorkspaceWithDefaultRoles(input: CreateWorkspaceInput) {
  return prisma.$transaction((tx) => createWorkspaceWithDefaultRolesTx(tx, input));
}

export async function createWorkspaceWithDefaultRolesTx(
  tx: DatabaseClient,
  input: CreateWorkspaceInput
) {
  const workspace = await tx.workspace.create({
    data: {
      name: input.name,
      slug: input.slug
    }
  });

  await ensurePermissions(tx);

  for (const role of defaultWorkspaceRoles) {
    await tx.role.create({
      data: {
        workspaceId: workspace.id,
        name: role.name,
        isSystem: true,
        permissions: {
          create: role.permissions.map((permissionKey) => ({
            permissionKey
          }))
        }
      }
    });
  }

  return workspace;
}

export async function ensurePermissions(tx: DatabaseClient = prisma) {
  for (const permission of PERMISSIONS) {
    await tx.permission.upsert({
      where: { key: permission },
      update: {
        description: permissionDescriptions[permission]
      },
      create: {
        key: permission,
        description: permissionDescriptions[permission]
      }
    });
  }
}
