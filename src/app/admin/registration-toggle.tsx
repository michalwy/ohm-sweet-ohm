"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { adminCopy as copy } from "@/app/admin/admin-copy";
import { setRegistrationOpenAction } from "@/server/admin/adminActions";

export function RegistrationToggle({ open }: { open: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setRegistrationOpenAction(!open);

      if (!result.ok) {
        setError(copy.errors[result.error] ?? copy.errors.unavailable);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      <button
        className={
          open
            ? "inline-flex min-h-9 w-fit items-center justify-center rounded-md border border-[var(--color-error-border)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2 disabled:opacity-60"
            : "inline-flex min-h-9 w-fit items-center justify-center rounded-md border border-[var(--color-action-primary)] bg-[var(--color-action-primary)] px-3 py-1.5 text-sm font-semibold text-white transition hover:border-[var(--color-action-primary-hover)] hover:bg-[var(--color-action-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-action-focus)] focus:ring-offset-2 disabled:opacity-60"
        }
        disabled={pending}
        type="button"
        onClick={toggle}
      >
        {open ? copy.closeRegistration : copy.openRegistration}
      </button>
      {error ? <p className="text-sm text-[var(--color-error)]">{error}</p> : null}
    </div>
  );
}
