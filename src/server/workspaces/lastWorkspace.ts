import "server-only";

import { cookies } from "next/headers";

import {
  LAST_WORKSPACE_COOKIE_NAME
} from "@/lib/lastWorkspaceCookie";
import { prisma } from "@/server/db/prisma";

export async function clearLastWorkspaceSlug() {
  const cookieStore = await cookies();

  cookieStore.delete(LAST_WORKSPACE_COOKIE_NAME);
}

export async function getLastWorkspaceRedirectPath(userId: string) {
  const cookieStore = await cookies();
  const workspaceSlug = cookieStore.get(LAST_WORKSPACE_COOKIE_NAME)?.value;

  if (!workspaceSlug) {
    return "/workspaces";
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId,
      workspace: {
        slug: workspaceSlug
      }
    },
    select: {
      workspace: {
        select: {
          slug: true
        }
      }
    }
  });

  if (!membership) {
    return "/workspaces";
  }

  return `/w/${encodeURIComponent(membership.workspace.slug)}/parts`;
}
