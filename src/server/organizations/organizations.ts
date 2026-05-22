import "server-only";

import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { prisma } from "@/server/db/prisma";

export const ORGANIZATION_ROLE_MANUFACTURER = "manufacturer";

export function normalizeOrganizationName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function ensureOrganizationWithRole({
  workspaceId,
  name,
  role
}: {
  workspaceId: string;
  name: string;
  role: string;
}) {
  const displayName = name.trim().replace(/\s+/g, " ");
  const normalizedName = normalizeOrganizationName(displayName);

  const organization = await prisma.organization.upsert({
    where: {
      workspaceId_normalizedName: {
        workspaceId,
        normalizedName
      }
    },
    update: {},
    create: {
      workspaceId,
      name: displayName,
      normalizedName
    },
    select: {
      id: true
    }
  });

  await prisma.organizationRole.upsert({
    where: {
      organizationId_role: {
        organizationId: organization.id,
        role
      }
    },
    update: {},
    create: {
      organizationId: organization.id,
      role
    }
  });

  return organization;
}

export type ManufacturerSuggestion = {
  id: string;
  name: string;
};

export async function getManufacturerSuggestionsForPartForm({
  userId,
  workspaceId
}: {
  userId: string;
  workspaceId: string;
}) {
  await authorizeWorkspacePermission({
    userId,
    workspaceId,
    permission: "parts:read"
  });

  return prisma.organization.findMany({
    where: {
      workspaceId,
      roles: {
        some: {
          role: ORGANIZATION_ROLE_MANUFACTURER
        }
      }
    },
    orderBy: {
      name: "asc"
    },
    select: {
      id: true,
      name: true
    }
  });
}
