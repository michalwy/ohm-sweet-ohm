import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import {
  getCurrentSession,
  getCurrentWorkspaceContextBySlug
} from "@/server/auth/currentContext";

export default async function WorkspaceLayout({
  params,
  children
}: {
  params: Promise<{ workspaceSlug: string }>;
  children: ReactNode;
}) {
  const { workspaceSlug } = await params;
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

  if (!context) {
    notFound();
  }

  if (context.workspace.archivedAt) {
    redirect("/workspaces?notice=workspace-archived");
  }

  return <>{children}</>;
}
