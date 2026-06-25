"use client";

import {
  forwardRef,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
  useEffect,
  useRef
} from "react";

type DialogShellProps = {
  children: ReactNode;
  closeLabel: string;
  description?: string;
  title: string;
  titleId: string;
  widthClassName?: string;
  /** Forces the dialog inner container to a fixed height. Use to prevent height-jumping when list content changes. Omit for dialogs that should size to their content. */
  heightClassName?: string;
  onClose?: () => void;
  onCancel?: (event: SyntheticEvent<HTMLDialogElement, Event>) => void;
  onCloseClick?: (event: MouseEvent<HTMLButtonElement>) => void;
};

type DialogSectionProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

type FieldErrorProps = {
  children?: ReactNode;
  id?: string;
};

type LabelWithErrorProps = {
  error?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
};

type DeleteConfirmationDialogProps = {
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  closeLabel: string;
  deleteLabel: string;
  isPending: boolean;
  itemName: string;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export const DialogShell = forwardRef<HTMLDialogElement, DialogShellProps>(
  function DialogShell(
    {
      children,
      closeLabel,
      description,
      title,
      titleId,
      widthClassName = "w-[min(48rem,calc(100vw-3rem))]",
      heightClassName,
      onClose,
      onCancel,
      onCloseClick
    },
    ref
  ) {
    return (
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        className={`fixed inset-0 m-auto max-h-[calc(100vh-2rem)] ${widthClassName} overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-0 text-[var(--color-text-primary)] shadow-2xl backdrop:bg-slate-950/40`}
        onClose={onClose}
        onCancel={onCancel}
      >
        <div className={`flex max-h-[calc(100vh-2rem)] min-h-0 flex-col${heightClassName ? ` ${heightClassName}` : ""}`}>
          <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
            <div>
              <h2 id={titleId} className="text-lg font-semibold text-[var(--color-text-primary)]">
                {title}
              </h2>
              {description ? (
                <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
                  {description}
                </p>
              ) : null}
            </div>
            <form method="dialog">
              <button
                aria-label={closeLabel}
                className={dialogIconButtonClassName}
                type="submit"
                onClick={onCloseClick}
              >
                <CloseIcon />
              </button>
            </form>
          </div>
          {children}
        </div>
      </dialog>
    );
  }
);

export function DialogBody({
  children,
  className = "",
  style
}: DialogSectionProps) {
  return (
    <div
      className={`min-h-0 overflow-auto px-5 py-4 ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function DialogFooter({
  children,
  className = "justify-end"
}: DialogSectionProps) {
  return (
    <div
      className={`flex shrink-0 border-t border-[var(--color-border)] px-5 py-4 ${className}`}
    >
      {children}
    </div>
  );
}

export function FieldError({ children, id }: FieldErrorProps) {
  if (!children) {
    return null;
  }

  return (
    <p
      id={id}
      className="text-xs font-medium leading-5 text-[var(--color-error)]"
    >
      {children}
    </p>
  );
}

export function LabelWithError({ error, htmlFor, children }: LabelWithErrorProps) {
  return (
    <div className="flex min-h-5 items-start justify-between gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
      {htmlFor ? <label htmlFor={htmlFor}>{children}</label> : <span>{children}</span>}
      {error ? (
        <span className="text-xs font-medium leading-5 text-[var(--color-error)]">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function ErrorBubble({
  align = "center",
  children
}: {
  align?: "center" | "start" | "end";
  children?: ReactNode;
}) {
  if (!children) {
    return null;
  }

  const alignmentClassName =
    align === "start"
      ? "left-0"
      : align === "end"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";

  return (
    <div
      className={`pointer-events-none absolute bottom-full z-20 mb-2 w-max max-w-64 rounded-md border border-[var(--color-error-border)] bg-[var(--color-bg-elevated)] px-2 py-1 text-xs font-medium text-[var(--color-error)] shadow-md ${alignmentClassName}`}
    >
      {children}
    </div>
  );
}

export function getFieldInputClassName(className: string, hasError: boolean) {
  return hasError
    ? `${className} !border-[var(--color-error)] !bg-[var(--color-error-soft)]/30 hover:!border-[var(--color-error)] focus:!border-[var(--color-error)] focus:!ring-[var(--color-error-soft)]`
    : className;
}

export function DeleteConfirmationDialog({
  body,
  cancelLabel,
  confirmLabel,
  closeLabel,
  deleteLabel,
  isPending,
  itemName,
  open,
  onCancel,
  onConfirm
}: DeleteConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function closeConfirmationDialog() {
    const dialog = dialogRef.current;

    if (dialog?.open) {
      dialog.close();
    }

    onCancel();
  }

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      openDialog(dialog);
      return;
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <DialogShell
      ref={dialogRef}
      closeLabel={closeLabel}
      title={`${deleteLabel} ${itemName}?`}
      titleId="delete-confirmation-dialog-title"
      widthClassName="w-[min(32rem,calc(100vw-3rem))]"
      onClose={onCancel}
      onCloseClick={closeConfirmationDialog}
    >
      <DialogBody>
        <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{body}</p>
      </DialogBody>
      <DialogFooter className="items-center justify-end gap-2">
        <button
          className="min-h-9 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]"
          data-dialog-initial-focus
          disabled={isPending}
          type="button"
          onClick={closeConfirmationDialog}
        >
          {cancelLabel}
        </button>
        <button
          className="min-h-9 rounded-md border border-[var(--color-error-border)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]"
          disabled={isPending}
          type="button"
          onClick={() => {
            const dialog = dialogRef.current;

            if (dialog?.open) {
              dialog.close();
            }

            onConfirm();
          }}
        >
          {confirmLabel}
        </button>
      </DialogFooter>
    </DialogShell>
  );
}

export function observeDialogContentHeight(
  element: HTMLElement | null,
  onHeightChange: (height: number) => void
) {
  if (!element) {
    return undefined;
  }

  function updateHeight() {
    onHeightChange(Math.ceil(element?.scrollHeight ?? 0));
  }

  updateHeight();

  const resizeObserver = new ResizeObserver(updateHeight);

  resizeObserver.observe(element);

  return () => resizeObserver.disconnect();
}

export function getDialogBodyHeightStyle(
  contentHeight: number | null
): CSSProperties | undefined {
  return contentHeight
    ? { height: `${contentHeight + dialogBodyVerticalPadding}px` }
    : undefined;
}

export function openDialog(dialog: HTMLDialogElement | null) {
  if (!dialog || dialog.open) {
    return;
  }

  try {
    dialog.showModal();
  } catch {
    dialog.setAttribute("open", "");
  }

  window.requestAnimationFrame(() => focusFirstDialogField(dialog));
}

export function closeDialog(dialog: HTMLDialogElement | null) {
  if (!dialog?.open) {
    return;
  }

  dialog.close();
}

function focusFirstDialogField(dialog: HTMLDialogElement) {
  const firstField = dialog.querySelector<HTMLElement>(
    [
      "input:not([type='hidden']):not(:disabled)",
      "select:not(:disabled)",
      "textarea:not(:disabled)"
    ].join(",")
  );

  const fallbackControl = dialog.querySelector<HTMLElement>(
    "[data-dialog-initial-focus]"
  );

  (firstField ?? fallbackControl)?.focus();
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 16 16"
    >
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

const dialogIconButtonClassName =
  "grid h-8 w-8 place-items-center rounded-md border border-transparent text-[var(--color-text-muted)] transition hover:border-[var(--color-border)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2";
const dialogBodyVerticalPadding = 32;
