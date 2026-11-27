"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { adminCopy as copy } from "@/app/admin/admin-copy";
import { updateFeedbackAction } from "@/server/admin/adminActions";
import { FEEDBACK_STATUSES, type FeedbackStatus } from "@/server/feedback/feedbackPolicy";

const fieldClass =
  "min-h-9 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-placeholder)] hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]";

/** A report's status and GitHub issue URL (#325). */
export function FeedbackTriageForm({
  feedbackId,
  status: initialStatus,
  issueUrl: initialIssueUrl
}: {
  feedbackId: string;
  status: FeedbackStatus;
  issueUrl: string;
}) {
  const router = useRouter();
  const statusId = useId();
  const issueId = useId();
  const [status, setStatus] = useState<FeedbackStatus>(initialStatus);
  const [issueUrl, setIssueUrl] = useState(initialIssueUrl);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(null);
        startTransition(async () => {
          const result = await updateFeedbackAction(feedbackId, { status, issueUrl });

          if (!result.ok) {
            setMessage({ error: true, text: copy.errors[result.error] ?? copy.errors.unavailable });
            return;
          }

          setIssueUrl(result.data.issueUrl ?? "");
          setMessage({ error: false, text: copy.saved });
          router.refresh();
        });
      }}
    >
      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-[var(--color-text-secondary)]" htmlFor={statusId}>
          {copy.triageStatus}
        </label>
        <select
          className={fieldClass}
          disabled={pending}
          id={statusId}
          value={status}
          onChange={(event) => setStatus(event.target.value as FeedbackStatus)}
        >
          {FEEDBACK_STATUSES.map((value) => (
            <option key={value} value={value}>
              {copy.feedbackStatus[value]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-[var(--color-text-secondary)]" htmlFor={issueId}>
          {copy.triageIssueUrl}
        </label>
        <input
          className={fieldClass}
          disabled={pending}
          id={issueId}
          placeholder={copy.triageIssuePlaceholder}
          type="url"
          value={issueUrl}
          onChange={(event) => setIssueUrl(event.target.value)}
        />
      </div>
      {message ? (
        <p className={`text-sm ${message.error ? "text-[var(--color-error)]" : "text-[var(--color-text-secondary)]"}`}>
          {message.text}
        </p>
      ) : null}
      <button
        className="inline-flex min-h-9 w-fit items-center justify-center rounded-md border border-[var(--color-action-primary)] bg-[var(--color-action-primary)] px-3 py-1.5 text-sm font-semibold text-white transition hover:border-[var(--color-action-primary-hover)] hover:bg-[var(--color-action-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-action-focus)] focus:ring-offset-2 disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {copy.save}
      </button>
    </form>
  );
}
