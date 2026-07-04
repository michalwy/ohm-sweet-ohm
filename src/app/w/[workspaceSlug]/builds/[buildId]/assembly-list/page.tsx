import { notFound, redirect } from "next/navigation";

import { getCurrentSession, getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import { getBuildAssemblyList, type BuildState } from "@/server/builds/builds";

import { PrintBar } from "../print-bar";

const stateLabels: Record<BuildState, string> = {
  CREATED: "Created",
  ALLOCATED: "Allocated",
  STARTED: "Started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled"
};

type AssemblyListPageProps = {
  params: Promise<{ workspaceSlug: string; buildId: string }>;
};

export default async function BuildAssemblyListPage({ params }: AssemblyListPageProps) {
  const { workspaceSlug, buildId } = await params;
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

  if (!context) {
    notFound();
  }

  const assemblyList = await getBuildAssemblyList({
    userId: context.user.id,
    workspaceId: context.workspace.id,
    buildId
  }).catch(() => null);

  if (!assemblyList) {
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
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Assembly list</h1>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-[var(--color-text-secondary)] sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Design</dt>
            <dd>{assemblyList.designName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Revision</dt>
            <dd>{assemblyList.revisionNumber}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              Target quantity
            </dt>
            <dd>{assemblyList.targetQuantity}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">State</dt>
            <dd>{stateLabels[assemblyList.state]}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">Generated {generatedAt}</p>
      </header>

      {assemblyList.units.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">Nothing to assemble for this build.</p>
      ) : (
        <div className="grid gap-6">
          {assemblyList.units.map((unit) => (
            <section className="break-inside-avoid" key={unit.unitIndex}>
              <h2 className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">
                Unit {unit.unitIndex}
              </h2>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border-strong)] text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                    <th className="w-8 py-1 pr-2"></th>
                    <th className="py-1 pr-2">Designator</th>
                    <th className="py-1 pr-2">Part</th>
                    <th className="py-1 pr-2">Manufacturer</th>
                    <th className="py-1 pr-2">Category</th>
                    <th className="py-1 pr-2">Source location</th>
                  </tr>
                </thead>
                <tbody>
                  {unit.entries.map((entry) => (
                    <tr
                      className={`border-b border-[var(--color-border)] ${entry.assembled ? "text-[var(--color-text-muted)]" : ""}`}
                      key={entry.assignmentId}
                    >
                      <td className="py-2 pr-2 align-top">
                        <span
                          aria-hidden
                          className={`inline-flex h-4 w-4 items-center justify-center border border-[var(--color-border-strong)] text-xs leading-none ${entry.assembled ? "bg-[var(--color-success-soft)]" : ""}`}
                        >
                          {entry.assembled ? "✓" : ""}
                        </span>
                      </td>
                      <td
                        className={`py-2 pr-2 align-top font-medium ${entry.assembled ? "line-through" : "text-[var(--color-text-primary)]"}`}
                      >
                        {entry.designator}
                      </td>
                      <td className={`py-2 pr-2 align-top ${entry.assembled ? "line-through" : ""}`}>
                        {entry.part?.catalogNumber ?? "—"}
                      </td>
                      <td className={`py-2 pr-2 align-top ${entry.assembled ? "line-through" : ""}`}>
                        {entry.part?.manufacturerName ?? "—"}
                      </td>
                      <td className={`py-2 pr-2 align-top ${entry.assembled ? "line-through" : ""}`}>
                        {entry.categoryName ?? "—"}
                      </td>
                      <td className={`py-2 pr-2 align-top ${entry.assembled ? "line-through" : ""}`}>
                        {entry.sourceLocation?.path ?? "—"}
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
