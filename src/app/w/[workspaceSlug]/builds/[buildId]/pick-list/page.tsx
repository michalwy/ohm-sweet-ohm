import { notFound, redirect } from "next/navigation";

import { getCurrentSession, getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import { getBuildPickList, type BuildState } from "@/server/builds/builds";

import { PrintBar } from "../print-bar";

const stateLabels: Record<BuildState, string> = {
  ALLOCATING: "Allocating",
  STARTED: "Started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled"
};

type PickListPageProps = {
  params: Promise<{ workspaceSlug: string; buildId: string }>;
};

export default async function BuildPickListPage({ params }: PickListPageProps) {
  const { workspaceSlug, buildId } = await params;
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

  if (!context) {
    notFound();
  }

  const pickList = await getBuildPickList({
    userId: context.user.id,
    workspaceId: context.workspace.id,
    buildId
  }).catch(() => null);

  if (!pickList) {
    notFound();
  }

  const generatedAt = new Date().toLocaleString();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 print:max-w-none print:px-0 print:py-0">
      <PrintBar
        buildId={buildId}
        copy={{ backToBuild: "Back to build", print: "Print" }}
        workspaceSlug={workspaceSlug}
      />

      <header className="mb-6 border-b border-[var(--color-border)] pb-4">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Pick list</h1>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-[var(--color-text-secondary)] sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Design</dt>
            <dd>{pickList.designName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Revision</dt>
            <dd>{pickList.revisionNumber}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              Target quantity
            </dt>
            <dd>{pickList.targetQuantity}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">State</dt>
            <dd>{stateLabels[pickList.state]}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">Generated {generatedAt}</p>
      </header>

      {pickList.groups.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">Nothing to pick for this build.</p>
      ) : (
        <div className="grid gap-6">
          {pickList.groups.map((group) => (
            <section className="break-inside-avoid" key={group.locationId ?? "no-location"}>
              <h2 className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">
                {group.locationPath}
              </h2>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border-strong)] text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                    <th className="w-8 py-1 pr-2"></th>
                    <th className="py-1 pr-2">Part</th>
                    <th className="py-1 pr-2">Manufacturer</th>
                    <th className="py-1 pr-2">Category</th>
                    <th className="py-1 pr-2 text-right">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {group.entries.map((entry) => (
                    <tr className="border-b border-[var(--color-border)]" key={entry.partId}>
                      <td className="py-2 pr-2 align-top">
                        <span
                          aria-hidden
                          className="inline-block h-4 w-4 border border-[var(--color-border-strong)]"
                        />
                      </td>
                      <td className="py-2 pr-2 align-top font-medium text-[var(--color-text-primary)]">
                        {entry.catalogNumber}
                      </td>
                      <td className="py-2 pr-2 align-top">{entry.manufacturerName}</td>
                      <td className="py-2 pr-2 align-top">{entry.categoryName ?? "—"}</td>
                      <td className="py-2 pr-2 align-top text-right">
                        {entry.totalQuantity}
                        {entry.assembledQuantity > 0 && (
                          <span className="ml-1 text-xs text-[var(--color-text-muted)]">
                            ({entry.assembledQuantity} already assembled)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
