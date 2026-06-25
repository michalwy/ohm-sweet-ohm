"use client";

import { useEffect, useState } from "react";

import { ArchivedWorkspaceActions } from "@/app/workspaces/archived-workspace-actions";

const STORAGE_KEY = "oso:archived-workspaces-expanded";

type ArchivedWorkspace = {
  id: string;
  name: string;
  slug: string;
  archivedAt: Date | null;
  deletionScheduledAt: Date | null;
};

type ArchivedWorkspacesSectionProps = {
  workspaces: ArchivedWorkspace[];
  retentionDays: number;
  sectionLabel: string;
};

export function ArchivedWorkspacesSection({
  workspaces,
  retentionDays,
  sectionLabel
}: ArchivedWorkspacesSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsExpanded(stored === "true");
    setMounted(true);
  }, []);

  if (workspaces.length === 0) {
    return null;
  }

  function toggle() {
    setIsExpanded((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <div className="mt-8">
      <button
        aria-expanded={isExpanded}
        className="flex w-full items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring-strong)] focus-visible:ring-offset-2 rounded"
        type="button"
        onClick={toggle}
      >
        <svg
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-base font-semibold text-[var(--color-text-secondary)]">
          {sectionLabel}
        </span>
        {mounted && (
          <span className="inline-flex items-center justify-center rounded-full bg-[var(--color-bg-strong)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
            {workspaces.length}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-sm">
          <ul className="divide-y divide-[var(--color-border)]">
            {workspaces.map((workspace) => (
              <li
                className="flex items-center justify-between gap-3 px-4 py-4"
                key={workspace.id}
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-[var(--color-text-primary)]">
                    {workspace.name}
                  </p>
                  <p className="mt-1 truncate font-mono text-xs text-[var(--color-text-muted)]">
                    /w/{workspace.slug}
                  </p>
                  {workspace.archivedAt && (
                    <p className="mt-0.5 text-xs text-[var(--color-text-placeholder)]">
                      Archived{" "}
                      {new Intl.DateTimeFormat("en-US", {
                        dateStyle: "medium"
                      }).format(new Date(workspace.archivedAt))}
                    </p>
                  )}
                </div>
                <ArchivedWorkspaceActions
                  workspaceName={workspace.name}
                  workspaceSlug={workspace.slug}
                  archivedAt={workspace.archivedAt!}
                  retentionDays={retentionDays}
                  deletionScheduledAt={workspace.deletionScheduledAt}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
