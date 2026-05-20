import "server-only";

import {
  defaultWorkspaceSlug,
  developmentUserEmail
} from "@/server/auth/developmentDefaults";
import { prisma } from "@/server/db/prisma";

export async function getCurrentUser() {
  return prisma.user.findUnique({
    where: {
      email: developmentUserEmail
    }
  });
}

export async function getCurrentWorkspace() {
  return prisma.workspace.findUnique({
    where: {
      slug: defaultWorkspaceSlug
    }
  });
}

export async function getCurrentWorkspaceContext() {
  const [user, workspace] = await Promise.all([
    getCurrentUser(),
    getCurrentWorkspace()
  ]);

  if (!user || !workspace) {
    return null;
  }

  return {
    user,
    workspace
  };
}
