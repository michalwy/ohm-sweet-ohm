"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

export function useDetailsPanelWidth(storageKey: string, defaultWidth = 384) {
  const [width, setWidth] = useState(defaultWidth);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(storageKey);
    const parsedValue = storedValue ? Number(storedValue) : NaN;

    if (Number.isFinite(parsedValue)) {
      setWidth(Math.max(320, Math.min(720, parsedValue)));
    } else {
      setWidth(defaultWidth);
    }

    setHasLoaded(true);
  }, [storageKey, defaultWidth]);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    window.localStorage.setItem(storageKey, String(width));
  }, [width, storageKey, hasLoaded]);

  useEffect(() => {
    if (!isResizing) {
      return undefined;
    }

    function handlePointerMove(event: MouseEvent) {
      const viewportWidth = window.innerWidth;
      const nextWidth = Math.min(720, Math.max(320, viewportWidth - event.clientX - 24));
      setWidth(nextWidth);
    }

    function handlePointerUp() {
      setIsResizing(false);
    }

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, [isResizing]);

  function startResizing(event: React.MouseEvent) {
    event.preventDefault();
    setIsResizing(true);
  }

  return { width, hasLoaded, isResizing, startResizing };
}

type DetailPanelProps = {
  width: number;
  onStartResize: (e: React.MouseEvent) => void;
  title: ReactNode;
  subtitle?: ReactNode;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
};

export function DetailPanel({
  width,
  onStartResize,
  title,
  subtitle,
  closeLabel,
  onClose,
  children
}: DetailPanelProps) {
  return (
    <aside
      className="relative flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
      style={{ width }}
    >
      <div
        aria-label="Resize details panel"
        className="absolute left-0 top-0 z-10 flex h-full w-3 -translate-x-1/2 cursor-col-resize items-center justify-center"
        role="separator"
        onMouseDown={onStartResize}
      >
        <div className="h-16 w-1 rounded-full bg-slate-300" />
      </div>
      <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-950">{title}</div>
          {subtitle ? (
            <div className="mt-1 text-sm text-slate-600">{subtitle}</div>
          ) : null}
        </div>
        <button
          aria-label={closeLabel}
          className="ml-3 min-h-8 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          type="button"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="grid min-h-0 gap-4 overflow-y-auto px-4 py-4">
        {children}
      </div>
    </aside>
  );
}
