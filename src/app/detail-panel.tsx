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

    const maxWidth = Math.floor(window.innerWidth * 0.5);
    if (Number.isFinite(parsedValue)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWidth(Math.max(320, Math.min(maxWidth, parsedValue)));
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
      const maxWidth = Math.floor(viewportWidth * 0.5);
      const nextWidth = Math.min(maxWidth, Math.max(320, viewportWidth - event.clientX - 24));
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
      className="relative flex min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-sm"
      style={{ width }}
    >
      <div
        aria-label="Resize details panel"
        className="absolute left-0 top-0 z-10 flex h-full w-3 -translate-x-1/2 cursor-col-resize items-center justify-center"
        role="separator"
        onMouseDown={onStartResize}
      >
        <div className="h-16 w-1 rounded-full bg-[var(--color-border-strong)]" />
      </div>
      <div className="flex items-start justify-between border-b border-[var(--color-border)] px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</div>
          {subtitle ? (
            <div className="mt-1 text-sm text-[var(--color-text-secondary)]">{subtitle}</div>
          ) : null}
        </div>
        <button
          aria-label={closeLabel}
          className="ml-3 min-h-8 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2"
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
