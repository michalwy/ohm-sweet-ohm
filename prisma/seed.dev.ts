import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

import { ADMIN_PERMISSION } from "../src/server/access-control/permissions";
import {
  defaultWorkspaceSlug,
  developmentUserEmail,
  developmentUserPassword
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

  const ownerRole = workspace.roles[0];

  if (!ownerRole) {
    throw new Error("Default workspace owner role is missing.");
  }

  const user = await prisma.user.upsert({
    where: { email: developmentUserEmail },
    update: {
      emailVerified: true
    },
    create: {
      email: developmentUserEmail,
      emailVerified: true,
      name: "OSO Owner"
    }
  });

  await upsertCredentialAccount({
    userId: user.id,
    password:
      process.env.OSO_DEV_USER_PASSWORD?.trim() || developmentUserPassword
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
        roleId: ownerRole.id
      }
    },
    update: {},
    create: {
      workspaceMemberId: member.id,
      roleId: ownerRole.id
    }
  });
}

async function upsertCredentialAccount({
  userId,
  password
}: {
  userId: string;
  password: string;
}) {
  const passwordHash = await hashPassword(password);
  const existingAccount = await prisma.account.findFirst({
    where: {
      userId,
      providerId: "credential"
    },
    select: {
      id: true
    }
  });

  if (existingAccount) {
    await prisma.account.update({
      where: {
        id: existingAccount.id
      },
      data: {
        accountId: userId,
        password: passwordHash
      }
    });
    return;
  }

  await prisma.account.create({
    data: {
      userId,
      accountId: userId,
      providerId: "credential",
      password: passwordHash
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
