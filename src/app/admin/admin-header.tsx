import Link from "next/link";

import { adminCopy as copy } from "@/app/admin/admin-copy";

export function AdminHeader({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <header className="flex min-h-14 items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-[var(--color-accent)] text-sm font-semibold text-white">
          {copy.appShortName}
        </div>
        <div>
          <p className="text-sm font-semibold leading-5 text-[var(--color-text-primary)]">{copy.appName}</p>
          <p className="text-xs leading-4 text-[var(--color-text-muted)]">{copy.title}</p>
        </div>
      </div>
      <Link
        className="inline-flex min-h-10 items-center rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2"
        href={backHref}
      >
        {backLabel}
      </Link>
    </header>
  );
}

export const adminCardClass =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5 shadow-sm";
export const adminTableClass = "w-full text-left text-sm";
export const adminThClass =
  "border-b border-[var(--color-border)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]";
export const adminTdClass = "border-b border-[var(--color-border)] px-3 py-2 text-[var(--color-text-secondary)]";
export const adminNumericClass = "text-right tabular-nums";
