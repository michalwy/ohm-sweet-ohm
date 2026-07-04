"use client";

import Link from "next/link";

type PrintBarCopy = {
  backToBuild: string;
  print: string;
};

export function PrintBar({
  workspaceSlug,
  buildId,
  copy
}: {
  workspaceSlug: string;
  buildId: string;
  copy: PrintBarCopy;
}) {
  return (
    <div className="print:hidden mb-6 flex items-center justify-between gap-3">
      <Link
        className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        href={`/w/${workspaceSlug}/builds?selectedBuildId=${buildId}`}
      >
        {copy.backToBuild}
      </Link>
      <button
        className="inline-flex min-h-8 items-center rounded-md bg-[var(--color-accent)] px-3 py-1 text-sm font-semibold text-white transition hover:brightness-95"
        onClick={() => window.print()}
        type="button"
      >
        {copy.print}
      </button>
    </div>
  );
}
