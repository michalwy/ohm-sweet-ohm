import { randomBytes } from "node:crypto";

import { prisma } from "../../src/server/db/prisma";
import { defaultWorkspaceRoles } from "../../src/server/access-control/permissions";
import { createApiToken, type CreateApiTokenInput } from "../../src/server/api-tokens/apiTokens";
import { ensurePermissions } from "../../src/server/workspaces/createWorkspace";

/** Shared setup for the REST and MCP integration tests (#274, #275). */

export function uniqueSuffix() {
  return randomBytes(4).toString("hex");
}

export async function createApiTestWorkspace(label: string) {
  const suffix = uniqueSuffix();

  await ensurePermissions();

  const workspace = await prisma.workspace.create({
    data: { name: `API ${label} ${suffix}`, slug: `api-${label}-${suffix}` }
  });

  for (const role of defaultWorkspaceRoles) {
    await prisma.role.create({
      data: {
        workspaceId: workspace.id,
        name: role.name,
        isSystem: true,
        permissions: { create: role.permissions.map((permissionKey) => ({ permissionKey })) }
      }
    });
  }

  const owner = await prisma.user.create({
    data: {
      email: `api-${label}-owner-${suffix}@ohmsweetohm.local`,
      emailVerified: true,
      name: `API ${label} owner`
    }
  });

  const ownerRole = await prisma.role.findFirstOrThrow({
    where: { workspaceId: workspace.id, name: "owner" },
    select: { id: true }
  });

  await prisma.workspaceMember.create({
    data: { userId: owner.id, workspaceId: workspace.id, roles: { create: { roleId: ownerRole.id } } }
  });

  return { workspace, owner };
}

export async function createTestToken(
  userId: string,
  workspaceId: string,
  access: Omit<CreateApiTokenInput, "workspaceId" | "name">
) {
  const { token, value } = await createApiToken(userId, {
    workspaceId,
    name: "integration test",
    ...access
  } as CreateApiTokenInput);

  return { tokenId: token.id, value };
}

export function bearer(value: string): HeadersInit {
  return { authorization: `Bearer ${value}` };
}
