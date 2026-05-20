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

  await prisma.part.createMany({
    data: [
      {
        workspaceId: workspace.id,
        catalogNumber: "NE555P",
        manufacturerName: "Texas Instruments"
      },
      {
        workspaceId: workspace.id,
        catalogNumber: "1N4148W",
        manufacturerName: "Diodes Incorporated"
      }
    ]
  });
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
