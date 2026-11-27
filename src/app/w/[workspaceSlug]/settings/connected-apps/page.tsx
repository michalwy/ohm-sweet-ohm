import { notFound, redirect } from "next/navigation";

import { ConnectedAppsClient } from "@/app/connected-apps-client";
import { connectedAppsCopy as copy } from "@/app/connected-apps-copy";
import { WorkspaceShell } from "@/app/workspace-shell";
import { getCurrentSession, getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import { listConnectedApps } from "@/server/oauth/oauthServer";

export const dynamic = "force-dynamic";

type ConnectedAppsPageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function ConnectedAppsSettingsPage({ params }: ConnectedAppsPageProps) {
  const { workspaceSlug } = await params;
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

  if (!context) {
    notFound();
  }

  const apps = await listConnectedApps(context.user.id);

  return (
    <WorkspaceShell
      activeNavItem="settings-connected-apps"
      intro={copy.intro}
      title={copy.title}
      userEmail={context.user.email}
      workspaceName={context.workspace.name}
      workspaceSlug={workspaceSlug}
    >
      <ConnectedAppsClient copy={copy} initialApps={apps} />
    </WorkspaceShell>
  );
}
