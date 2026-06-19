import { notFound, redirect } from "next/navigation";

import { WorkspaceShell } from "@/app/workspace-shell";
import {
  getCurrentSession,
  getCurrentWorkspaceContextBySlug
} from "@/server/auth/currentContext";
import { hasWorkspacePermission } from "@/server/access-control/authorize";
import { OrderingDefaultsClient } from "@/app/ordering-defaults-client";

export const dynamic = "force-dynamic";

const copy = {
  title: "Ordering defaults",
  intro: "Set default price entry mode and tax rate applied to new purchase orders.",
  priceEntryMode: "Default price entry mode",
  net: "Net",
  gross: "Gross",
  defaultTaxRate: "Default tax rate (%)",
  defaultTaxRatePlaceholder: "0",
  defaultTaxRateHelp:
    "Applied to new purchase orders when no supplier default is set.",
  saveChanges: "Save changes",
  saved: "Saved",
  noPermission: "Only workspace admins can update ordering defaults.",
  permissionDenied: "You do not have permission to perform this action.",
  databaseUnavailable: "Database is not available.",
  invalidTaxRate: "Enter a valid tax rate between 0 and 99.99."
};

type OrderingPageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function OrderingPage({ params }: OrderingPageProps) {
  const { workspaceSlug } = await params;
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

  if (!context) {
    notFound();
  }

  const canManage = await hasWorkspacePermission({
    userId: context.user.id,
    workspaceId: context.workspace.id,
    permission: "admin"
  }).catch(() => false);

  return (
    <WorkspaceShell
      activeNavItem="settings-ordering"
      intro={copy.intro}
      title={copy.title}
      userEmail={context.user.email}
      workspaceName={context.workspace.name}
      workspaceSlug={workspaceSlug}
    >
      <OrderingDefaultsClient
        canManage={canManage}
        copy={copy}
        initialPriceEntryMode={
          (context.workspace.defaultPriceEntryMode as "net" | "gross") ?? "net"
        }
        initialTaxRate={context.workspace.defaultTaxRate?.toString() ?? ""}
        workspaceSlug={workspaceSlug}
      />
    </WorkspaceShell>
  );
}
