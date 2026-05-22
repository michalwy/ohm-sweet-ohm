import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import {
  defaultWorkspaceRoles,
  OWNER_ROLE_NAME,
  permissionDescriptions,
  PERMISSIONS
} from "../src/server/access-control/permissions";
import {
  defaultWorkspaceSlug,
  developmentUserEmail,
  developmentUserPassword
} from "../src/server/auth/developmentDefaults";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed e2e data.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.verification.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.workspaceMemberRole.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.part.deleteMany();
  await prisma.organizationRole.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.partCategoryClosure.deleteMany();
  await prisma.partCategory.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
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

  const user = await prisma.user.create({
    data: {
      email: developmentUserEmail,
      emailVerified: true,
      name: "OSO Owner"
    }
  });

  await prisma.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: await hashPassword(developmentUserPassword)
    }
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: "Default workspace",
      slug: defaultWorkspaceSlug
    }
  });

  const roleIdsByName = new Map<string, string>();

  for (const role of defaultWorkspaceRoles) {
    const createdRole = await prisma.role.create({
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

    roleIdsByName.set(role.name, createdRole.id);
  }

  const ownerRoleId = roleIdsByName.get(OWNER_ROLE_NAME);

  if (!ownerRoleId) {
    throw new Error("Owner role was not created.");
  }

  const member = await prisma.workspaceMember.create({
    data: {
      userId: user.id,
      workspaceId: workspace.id
    }
  });

  await prisma.workspaceMemberRole.create({
    data: {
      workspaceMemberId: member.id,
      roleId: ownerRoleId
    }
  });

  const categories = await seedPartCategories(workspace.id);
  const texasInstruments = await ensureOrganizationWithRole({
    workspaceId: workspace.id,
    name: "Texas Instruments",
    role: "manufacturer"
  });
  const diodesIncorporated = await ensureOrganizationWithRole({
    workspaceId: workspace.id,
    name: "Diodes Incorporated",
    role: "manufacturer"
  });

  await prisma.part.create({
    data: {
      workspaceId: workspace.id,
      catalogNumber: "NE555P",
      manufacturerId: texasInstruments.id,
      primaryCategoryId: categories.integratedCircuits.id
    }
  });

  await prisma.part.create({
    data: {
      workspaceId: workspace.id,
      catalogNumber: "1N4148W",
      manufacturerId: diodesIncorporated.id,
      primaryCategoryId: categories.diodes.id
    }
  });
}

async function ensureOrganizationWithRole({
  workspaceId,
  name,
  role
}: {
  workspaceId: string;
  name: string;
  role: string;
}) {
  const displayName = name.trim().replace(/\s+/g, " ");
  const organization = await prisma.organization.upsert({
    where: {
      workspaceId_normalizedName: {
        workspaceId,
        normalizedName: displayName.toLowerCase()
      }
    },
    update: {},
    create: {
      workspaceId,
      name: displayName,
      normalizedName: displayName.toLowerCase()
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

async function seedPartCategories(workspaceId: string) {
  const passives = await createPartCategory({
    workspaceId,
    name: "Passives",
    isAssignable: false
  });
  const capacitors = await createPartCategory({
    workspaceId,
    parentId: passives.id,
    name: "Capacitors",
    isAssignable: true
  });
  const resistors = await createPartCategory({
    workspaceId,
    parentId: passives.id,
    name: "Resistors",
    isAssignable: true
  });
  const semiconductors = await createPartCategory({
    workspaceId,
    name: "Semiconductors",
    isAssignable: false
  });
  const diodes = await createPartCategory({
    workspaceId,
    parentId: semiconductors.id,
    name: "Diodes",
    isAssignable: true
  });
  const integratedCircuits = await createPartCategory({
    workspaceId,
    parentId: semiconductors.id,
    name: "Integrated circuits",
    isAssignable: true
  });

  return {
    capacitors,
    diodes,
    integratedCircuits,
    passives,
    resistors,
    semiconductors
  };
}

async function createPartCategory({
  workspaceId,
  parentId = null,
  name,
  isAssignable
}: {
  workspaceId: string;
  parentId?: string | null;
  name: string;
  isAssignable: boolean;
}) {
  const category = await prisma.partCategory.create({
    data: {
      workspaceId,
      parentId,
      name,
      isAssignable
    }
  });

  await prisma.partCategoryClosure.create({
    data: {
      workspaceId,
      ancestorId: category.id,
      descendantId: category.id,
      depth: 0
    }
  });

  if (parentId) {
    const parentClosures = await prisma.partCategoryClosure.findMany({
      where: {
        workspaceId,
        descendantId: parentId
      },
      select: {
        ancestorId: true,
        depth: true
      }
    });

    await prisma.partCategoryClosure.createMany({
      data: parentClosures.map((closure) => ({
        workspaceId,
        ancestorId: closure.ancestorId,
        descendantId: category.id,
        depth: closure.depth + 1
      }))
    });
  }

  return category;
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
