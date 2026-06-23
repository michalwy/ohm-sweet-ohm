"use client";

import type { RefObject } from "react";

export type ToastMessage = {
  id: number;
  message: string;
  variant?: "success" | "error";
};

type ToastNoticeProps = {
  messages: ToastMessage[];
  onDismiss: (id: number) => void;
};

export function ToastNotice({ messages, onDismiss }: ToastNoticeProps) {
  if (messages.length === 0) {
    return null;
  }

  const latestToastId = messages.at(-1)?.id;

  return (
    <div className="pointer-events-none fixed right-6 top-6 z-50 grid w-96 gap-2">
      {messages.map((toast) => (
        <ToastNoticeItem
          key={toast.id}
          isLatest={toast.id === latestToastId}
          message={toast.message}
          variant={toast.variant}
          onDismiss={() => onDismiss(toast.id)}
        />
      ))}
    </div>
  );
}

function ToastNoticeItem({
  isLatest,
  message,
  onDismiss,
  variant = "success"
}: {
  isLatest: boolean;
  message: string;
  onDismiss: () => void;
  variant?: "success" | "error";
}) {
  const variantClassName =
    variant === "error"
      ? "bg-red-700 shadow-red-900/20"
      : "bg-emerald-600 shadow-emerald-900/20";

  return (
    <div
      aria-live={isLatest ? "polite" : undefined}
      className={`animate-[toast-notice_5500ms_ease-in-out_forwards] rounded-md px-4 py-3 text-sm font-semibold text-white shadow-lg ${variantClassName}`}
      role={isLatest ? "status" : undefined}
      onAnimationEnd={onDismiss}
    >
      {message}
    </div>
  );
}

export function getNextToastId(nextToastIdRef: RefObject<number>) {
  nextToastIdRef.current += 1;
  return nextToastIdRef.current;
}
