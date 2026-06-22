import "server-only";

import { headers } from "next/headers";

import { auth } from "@/server/auth/auth";
import { prisma } from "@/server/db/prisma";

export async function getCurrentSession() {
  return auth.api.getSession({
    headers: await headers()
  });
}

export async function getCurrentUser() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      id: session.user.id
    }
  });
}

export async function getCurrentWorkspace() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId: user.id
    },
    orderBy: {
      createdAt: "asc"
    },
    select: {
      workspace: true
    }
  });

  return membership?.workspace ?? null;
}

export async function getCurrentUserWorkspaces() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  return prisma.workspaceMember.findMany({
    where: {
      userId: session.user.id,
      workspace: { archivedAt: null }
    },
    orderBy: {
      createdAt: "asc"
    },
    select: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          archivedAt: true,
          createdAt: true
        }
      }
    }
  });
}

export async function getCurrentUserArchivedWorkspaces() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  return prisma.workspaceMember.findMany({
    where: {
      userId: session.user.id,
      workspace: { archivedAt: { not: null } }
    },
    orderBy: {
      createdAt: "asc"
    },
    select: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          archivedAt: true,
          deletionScheduledAt: true
        }
      }
    }
  });
}

export async function getCurrentWorkspaceContext() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId: session.user.id
    },
    orderBy: {
      createdAt: "asc"
    },
    select: {
      user: true,
      workspace: true
    }
  });

  if (!membership) {
    return null;
  }

  return {
    user: membership.user,
    workspace: membership.workspace
  };
}

export async function getCurrentWorkspaceContextBySlug(workspaceSlug: string) {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId: session.user.id,
      workspace: {
        slug: workspaceSlug
      }
    },
    select: {
      user: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          primaryCurrency: true,
          defaultPriceEntryMode: true,
          defaultTaxRate: true,
          activeSupplierProvider: true,
          archivedAt: true,
          createdAt: true,
          updatedAt: true
        }
      }
    }
  });

  if (!membership) {
    return null;
  }

  return {
    user: membership.user,
    workspace: membership.workspace
  };
}
