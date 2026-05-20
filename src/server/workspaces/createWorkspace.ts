import "server-only";

import { randomBytes } from "crypto";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";

import {
  defaultWorkspaceRoles,
  OWNER_ROLE_NAME,
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

export async function createWorkspaceForOwner(input: {
  userId: string;
  name: string;
}) {
  return prisma.$transaction(async (tx) => {
    const slug = await generateUniqueWorkspaceSlug(tx, input.name);
    const workspace = await createWorkspaceWithDefaultRolesTx(tx, {
      name: input.name,
      slug
    });
    const ownerRole = await tx.role.findUniqueOrThrow({
      where: {
        workspaceId_name: {
          workspaceId: workspace.id,
          name: OWNER_ROLE_NAME
        }
      },
      select: {
        id: true
      }
    });
    const member = await tx.workspaceMember.create({
      data: {
        userId: input.userId,
        workspaceId: workspace.id
      },
      select: {
        id: true
      }
    });

    await tx.workspaceMemberRole.create({
      data: {
        workspaceMemberId: member.id,
        roleId: ownerRole.id
      }
    });

    return workspace;
  });
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

async function generateUniqueWorkspaceSlug(tx: DatabaseClient, name: string) {
  const baseSlug = slugifyWorkspaceName(name);
  let candidate = baseSlug;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const existing = await tx.workspace.findUnique({
      where: {
        slug: candidate
      },
      select: {
        id: true
      }
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${baseSlug}-${createSlugSuffix()}`;
  }

  throw new Error("workspace_slug_unavailable");
}

function slugifyWorkspaceName(name: string) {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "workspace";
}

function createSlugSuffix() {
  return randomBytes(4).toString("base64url").toLowerCase().slice(0, 6);
}
