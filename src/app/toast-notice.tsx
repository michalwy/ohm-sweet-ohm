"use client";

import { useEffect } from "react";

import { ACTION_TOAST_COOKIE_NAME } from "@/lib/actionToastCookie";

type ToastNoticeProps = {
  message?: string;
};

export function ToastNotice({ message }: ToastNoticeProps) {
  useEffect(() => {
    if (!message) {
      return;
    }

    document.cookie = `${ACTION_TOAST_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
  }, [message]);

  if (!message) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed right-6 top-6 z-50 animate-[toast-notice_4s_ease-in-out_forwards]"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-sm rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20">
        {message}
      </div>
    </div>
  );
}
