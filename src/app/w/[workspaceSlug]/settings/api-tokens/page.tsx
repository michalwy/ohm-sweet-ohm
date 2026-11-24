import { notFound, redirect } from "next/navigation";

import { ApiTokensClient } from "@/app/api-tokens-client";
import { apiTokensCopy as copy } from "@/app/api-tokens-copy";
import { WorkspaceShell } from "@/app/workspace-shell";
import { permissionDescriptions } from "@/server/access-control/permissions";
import { API_TOKEN_PERMISSION_KEYS } from "@/server/api-tokens/apiTokenPermissions";
import { listApiTokensForUser } from "@/server/api-tokens/apiTokens";
import {
  getCurrentSession,
  getCurrentUserWorkspaces,
  getCurrentWorkspaceContextBySlug
} from "@/server/auth/currentContext";

export const dynamic = "force-dynamic";

type ApiTokensPageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function ApiTokensSettingsPage({ params }: ApiTokensPageProps) {
  const { workspaceSlug } = await params;
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

  if (!context) {
    notFound();
  }

  const [tokens, memberships] = await Promise.all([
    listApiTokensForUser(context.user.id),
    getCurrentUserWorkspaces()
  ]);

  const workspaces = (memberships ?? []).map(({ workspace }) => ({
    id: workspace.id,
    name: workspace.name
  }));

  return (
    <WorkspaceShell
      activeNavItem="settings-api-tokens"
      intro={copy.intro}
      title={copy.title}
      userEmail={context.user.email}
      workspaceName={context.workspace.name}
      workspaceSlug={workspaceSlug}
    >
      <ApiTokensClient
        copy={copy}
        currentWorkspaceId={context.workspace.id}
        initialTokens={tokens}
        permissionOptions={API_TOKEN_PERMISSION_KEYS.map((key) => ({
          key,
          description: permissionDescriptions[key]
        }))}
        workspaces={workspaces}
      />
    </WorkspaceShell>
  );
}
