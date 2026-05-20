import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { ADMIN_PERMISSION } from "../src/server/access-control/permissions";
import {
  defaultWorkspaceSlug,
  developmentUserEmail
} from "../src/server/auth/developmentDefaults";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed development data.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: defaultWorkspaceSlug },
    include: {
      roles: {
        where: {
          permissions: {
            some: {
              permissionKey: ADMIN_PERMISSION
            }
          }
        },
        select: { id: true },
        take: 1
      }
    }
  });

  if (!workspace) {
    throw new Error(
      "Default workspace is missing. Run database migrations before seeding."
    );
  }

  const adminRole = workspace.roles[0];

  if (!adminRole) {
    throw new Error("Default workspace admin role is missing.");
  }

  const user = await prisma.user.upsert({
    where: { email: developmentUserEmail },
    update: {},
    create: {
      email: developmentUserEmail,
      name: "OSO Owner"
    }
  });

  const member = await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id
      }
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: user.id
    }
  });

  await prisma.workspaceMemberRole.upsert({
    where: {
      workspaceMemberId_roleId: {
        workspaceMemberId: member.id,
        roleId: adminRole.id
      }
    },
    update: {},
    create: {
      workspaceMemberId: member.id,
      roleId: adminRole.id
    }
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
