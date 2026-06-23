import { notFound, redirect } from "next/navigation";

import { WorkspaceShell } from "@/app/workspace-shell";
import { GeneralSettingsClient } from "@/app/general-settings-client";
import {
  getCurrentSession,
  getCurrentWorkspaceContextBySlug
} from "@/server/auth/currentContext";
import { hasWorkspacePermission } from "@/server/access-control/authorize";

export const dynamic = "force-dynamic";

const copy = {
  title: "General",
  intro: "Workspace name, URL, archive, and reset options."
};

type GeneralPageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function GeneralSettingsPage({ params }: GeneralPageProps) {
  const { workspaceSlug } = await params;
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

  if (!context) {
    notFound();
  }

  const canArchive = await hasWorkspacePermission({
    userId: context.user.id,
    workspaceId: context.workspace.id,
    permission: "admin"
  }).catch(() => false);

  return (
    <WorkspaceShell
      activeNavItem="settings-general"
      intro={copy.intro}
      title={copy.title}
      userEmail={context.user.email}
      workspaceName={context.workspace.name}
      workspaceSlug={workspaceSlug}
    >
      <GeneralSettingsClient
        canArchive={canArchive}
        canReset={canArchive}
        workspaceName={context.workspace.name}
        workspaceSlug={workspaceSlug}
      />
    </WorkspaceShell>
  );
}
