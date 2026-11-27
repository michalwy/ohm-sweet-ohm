"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import {
  DialogActions,
  DialogBody,
  DialogFooter,
  DialogPrimaryButton,
  DialogShell,
  closeDialog,
  openDialog
} from "@/app/dialog-shell";
import { feedbackCopy as copy } from "@/app/feedback/feedback-copy";
import { submitFeedbackAction } from "@/server/feedback/feedbackActions";
import {
  FEEDBACK_KINDS,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_RECENT_ERRORS_MAX,
  type FeedbackKind
} from "@/server/feedback/feedbackPolicy";

/**
 * "Send feedback" (#325): a button that opens a dialog for a remark, with diagnostic context
 * attached automatically. `variant` picks the entry point's look: `sidebar` in the workspace
 * sidebar, `link` as a discreet text link on pages anonymous visitors see (sign-in, sign-up).
 */

const recentErrors: string[] = [];
let listening = false;

/** Keeps the page's last script errors from the first entry point mounted on, for the report. */
function listenForErrors() {
  if (listening || typeof window === "undefined") {
    return;
  }

  listening = true;

  const remember = (text: string) => {
    recentErrors.push(text.slice(0, 500));

    if (recentErrors.length > FEEDBACK_RECENT_ERRORS_MAX) {
      recentErrors.shift();
    }
  };

  window.addEventListener("error", (event) => {
    remember(`${new Date().toISOString()} ${event.message || "Script error"}`);
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
    remember(`${new Date().toISOString()} Unhandled rejection: ${reason}`);
  });
}

function collectContext() {
  const root = document.documentElement;

  return {
    path: `${window.location.pathname}${window.location.search}`,
    userAgent: navigator.userAgent,
    language: navigator.language,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    theme: root.classList.contains("theme-dark") ? "dark" : "light",
    clientTime: new Date().toISOString(),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    recentErrors: [...recentErrors]
  };
}

const sidebarButtonClass =
  "mb-2 flex min-h-10 w-full items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 text-left text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2";
const linkButtonClass =
  "text-xs text-[var(--color-text-muted)] underline-offset-2 transition hover:text-[var(--color-text-secondary)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]";
const fieldClass =
  "min-h-9 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-placeholder)] hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]";

export function FeedbackButton({
  variant,
  workspaceSlug
}: {
  variant: "sidebar" | "link";
  workspaceSlug?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const kindId = useId();
  const messageId = useId();
  const [kind, setKind] = useState<FeedbackKind>("problem");
  const [message, setMessage] = useState("");
  const [context, setContext] = useState<ReturnType<typeof collectContext> | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(listenForErrors, []);

  const mutation = useMutation({
    mutationFn: () =>
      submitFeedbackAction({ kind, message, workspaceSlug, context: context ?? collectContext() }),
    onSuccess: (result) => {
      if (!result.ok) {
        setErrorMsg(copy.errors[result.error] ?? copy.errors.unavailable);
        return;
      }

      setSent(true);
      setMessage("");
    },
    onError: () => setErrorMsg(copy.errors.unavailable)
  });

  function open() {
    setKind("problem");
    setErrorMsg(null);
    setSent(false);
    setContext(collectContext());
    openDialog(dialogRef.current);
  }

  function close() {
    if (!mutation.isPending) {
      closeDialog(dialogRef.current);
    }
  }

  const canSend = message.trim().length > 0 && message.length <= FEEDBACK_MESSAGE_MAX && !mutation.isPending;

  return (
    <>
      <button className={variant === "sidebar" ? sidebarButtonClass : linkButtonClass} type="button" onClick={open}>
        {variant === "sidebar" ? (
          <svg aria-hidden="true" className="h-4 w-4 text-[var(--color-text-muted)]" viewBox="0 0 20 20" fill="currentColor">
            <path d="M3.5 4.75A2.25 2.25 0 0 1 5.75 2.5h8.5a2.25 2.25 0 0 1 2.25 2.25v6.5a2.25 2.25 0 0 1-2.25 2.25H9.06l-3.28 2.95A.75.75 0 0 1 4.5 15.9V13.5h-.25A.75.75 0 0 1 3.5 12.75v-8Z" />
          </svg>
        ) : null}
        {copy.open}
      </button>

      <DialogShell
        ref={dialogRef}
        closeLabel={copy.close}
        description={copy.description}
        title={copy.title}
        titleId={titleId}
        widthClassName="w-[min(36rem,calc(100vw-3rem))]"
        onCloseClick={close}
      >
        {sent ? (
          <>
            <DialogBody>
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{copy.sent}</p>
            </DialogBody>
            <DialogFooter>
              <DialogPrimaryButton type="button" onClick={() => closeDialog(dialogRef.current)}>
                {copy.close}
              </DialogPrimaryButton>
            </DialogFooter>
          </>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setErrorMsg(null);
              if (canSend) mutation.mutate();
            }}
          >
            <DialogBody>
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium text-[var(--color-text-secondary)]" htmlFor={kindId}>
                    {copy.kindLabel}
                  </label>
                  <select
                    className={fieldClass}
                    disabled={mutation.isPending}
                    id={kindId}
                    value={kind}
                    onChange={(event) => setKind(event.target.value as FeedbackKind)}
                  >
                    {FEEDBACK_KINDS.map((value) => (
                      <option key={value} value={value}>
                        {copy.kinds[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium text-[var(--color-text-secondary)]" htmlFor={messageId}>
                    {copy.messageLabel}
                  </label>
                  <textarea
                    className={`${fieldClass} min-h-36 resize-y`}
                    data-dialog-initial-focus
                    disabled={mutation.isPending}
                    id={messageId}
                    maxLength={FEEDBACK_MESSAGE_MAX}
                    placeholder={copy.messagePlaceholder}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                  />
                </div>
                <div className="text-xs leading-5 text-[var(--color-text-muted)]">
                  <p>{copy.contextNote}</p>
                  {context ? (
                    <details className="mt-1">
                      <summary className="cursor-pointer select-none">{copy.contextDetails}</summary>
                      <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-[var(--color-bg-subtle)] p-2 font-mono text-[11px] whitespace-pre-wrap break-all">
                        {JSON.stringify(context, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </div>
                {errorMsg ? (
                  <p className="rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-soft)] px-3 py-2 text-sm text-[var(--color-error)]">
                    {errorMsg}
                  </p>
                ) : null}
              </div>
            </DialogBody>
            <DialogActions cancelLabel={copy.cancel} actionLabel={copy.send} disabled={!canSend} />
          </form>
        )}
      </DialogShell>
    </>
  );
}
