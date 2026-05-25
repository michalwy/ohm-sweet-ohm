"use client";

import {
  forwardRef,
  type CSSProperties,
  type ReactNode
} from "react";

type DialogShellProps = {
  children: ReactNode;
  closeLabel: string;
  description?: string;
  title: string;
  titleId: string;
  widthClassName?: string;
  onClose?: () => void;
  onCloseClick?: () => void;
};

type DialogSectionProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
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
      onClose,
      onCloseClick
    },
    ref
  ) {
    return (
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        className={`fixed inset-0 m-auto max-h-[calc(100vh-2rem)] ${widthClassName} overflow-hidden rounded-lg border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/40`}
        onClose={onClose}
      >
        <div className="flex max-h-[calc(100vh-2rem)] min-h-0 flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 id={titleId} className="text-lg font-semibold text-slate-950">
                {title}
              </h2>
              {description ? (
                <p className="mt-1 text-sm leading-6 text-slate-500">
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
      className={`flex shrink-0 border-t border-slate-200 px-5 py-4 ${className}`}
    >
      {children}
    </div>
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
  "grid h-8 w-8 place-items-center rounded-md border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2";
const dialogBodyVerticalPadding = 32;
