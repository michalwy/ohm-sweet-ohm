import { notFound, redirect } from "next/navigation";

import { WorkspaceShell } from "@/app/workspace-shell";
import { DisplaySettingsClient } from "@/app/display-settings-client";
import {
  getCurrentSession,
  getCurrentWorkspaceContextBySlug
} from "@/server/auth/currentContext";

export const dynamic = "force-dynamic";

const copy = {
  title: "Display",
  intro: "Personal preferences for how dates and times are shown to you.",
  dateFormat: "Date format",
  timeFormat: "Time format",
  relativeFormat: "Relative time",
  relativeFormatHelp:
    "Show recent dates as '10 minutes ago' or '3 days ago'. Dates older than 7 days are shown in your selected format.",
  preview: "Preview",
  saveChanges: "Save changes",
  saved: "Saved",
  errorGeneric: "Could not save preferences. Please try again.",
  errorUnauthenticated: "You must be signed in to change preferences."
};

type DisplayPageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function DisplaySettingsPage({ params }: DisplayPageProps) {
  const { workspaceSlug } = await params;
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

  if (!context) {
    notFound();
  }

  return (
    <WorkspaceShell
      activeNavItem="settings-display"
      intro={copy.intro}
      title={copy.title}
      userEmail={context.user.email}
      workspaceName={context.workspace.name}
      workspaceSlug={workspaceSlug}
    >
      <DisplaySettingsClient
        copy={copy}
        initialDateFormat={context.user.dateFormat}
        initialTimeFormat={context.user.timeFormat}
        initialRelativeFormat={context.user.relativeFormat}
      />
    </WorkspaceShell>
  );
}
