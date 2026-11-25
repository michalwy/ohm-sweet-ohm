"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import { computeFloatingPosition, type FloatingSide } from "@/app/floating-position";

// The shared floating primitives (#129, #123): `Tooltip` labels an icon-only button on hover,
// `HoverPopover` shows richer content anchored to an element. Both open after a short hover
// delay, so moving the mouse across a row does not flicker, and both render in the browser's top
// layer (the Popover API), so they also appear above an open modal dialog.

/** Hover delay before a tooltip opens. */
export const TOOLTIP_OPEN_DELAY_MS = 400;
/** Hover delay before a popover opens — and so before its content is fetched. */
export const POPOVER_OPEN_DELAY_MS = 350;
/** Grace period for the pointer to move from the anchor onto an open popover. */
export const POPOVER_CLOSE_DELAY_MS = 150;

function useHoverIntent({ openDelay, closeDelay }: { openDelay: number; closeDelay: number }) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const setOpenState = useCallback((next: boolean) => {
    openRef.current = next;
    setOpen(next);
  }, []);

  const scheduleOpen = useCallback(() => {
    clearTimer();
    if (openRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setOpenState(true);
    }, openDelay);
  }, [clearTimer, openDelay, setOpenState]);

  const close = useCallback(() => {
    clearTimer();
    if (openRef.current) setOpenState(false);
  }, [clearTimer, setOpenState]);

  const scheduleClose = useCallback(() => {
    clearTimer();
    if (!openRef.current) return;
    if (closeDelay <= 0) {
      setOpenState(false);
      return;
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setOpenState(false);
    }, closeDelay);
  }, [clearTimer, closeDelay, setOpenState]);

  useEffect(() => clearTimer, [clearTimer]);

  // An open layer closes on Escape and on any scroll, since it would no longer sit next to its anchor.
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  return { open, scheduleOpen, scheduleClose, close };
}

function FloatingLayer({
  anchorRef,
  children,
  className,
  open,
  side
}: {
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  className: string;
  open: boolean;
  side: FloatingSide;
}) {
  const layerRef = useRef<HTMLDivElement>(null);

  // Positioned straight on the DOM node before paint: the layer has to be laid out before its size
  // is known, and its content (a popover that finishes loading) can change that size later.
  useLayoutEffect(() => {
    const layer = layerRef.current;
    const anchor = anchorRef.current;
    if (!open || !layer || !anchor) return;

    try {
      if (typeof layer.showPopover === "function" && !layer.matches(":popover-open")) layer.showPopover();
    } catch {
      // Without the Popover API the layer stays a fixed element in <body>.
    }

    function place() {
      if (!layer || !anchor) return;
      const anchorRect = anchor.getBoundingClientRect();
      const layerRect = layer.getBoundingClientRect();
      const position = computeFloatingPosition({
        anchor: { top: anchorRect.top, left: anchorRect.left, width: anchorRect.width, height: anchorRect.height },
        size: { width: layerRect.width, height: layerRect.height },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        preferredSide: side
      });
      layer.style.top = `${position.top}px`;
      layer.style.left = `${position.left}px`;
      layer.style.visibility = "visible";
      layer.dataset.side = position.side;
    }

    place();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(place) : null;
    observer?.observe(layer);
    return () => observer?.disconnect();
  }, [anchorRef, open, side]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={layerRef}
      popover="manual"
      role="tooltip"
      className={`fixed z-50 m-0 overflow-visible ${className}`}
      style={{ inset: "auto", top: 0, left: 0, visibility: "hidden" }}
      // React bubbles events through portals: keep clicks inside the layer from activating a row.
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}

function isFocusVisible(target: EventTarget) {
  return target instanceof Element && target.matches(":focus-visible");
}

/**
 * A hover label for an icon-only control. `label` should be the control's accessible name (its
 * `aria-label`), so the tooltip itself is hidden from assistive technology; without a label the
 * control renders alone. Opens after
 * `TOOLTIP_OPEN_DELAY_MS` on hover or keyboard focus; closes on leave, blur, click, Escape or scroll.
 */
export function Tooltip({
  children,
  label,
  side = "top"
}: {
  children: ReactNode;
  label: string | undefined;
  side?: FloatingSide;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const hover = useHoverIntent({ openDelay: TOOLTIP_OPEN_DELAY_MS, closeDelay: 0 });

  if (!label) return <>{children}</>;

  return (
    <span
      ref={anchorRef}
      className="inline-flex"
      onMouseEnter={hover.scheduleOpen}
      onMouseLeave={hover.close}
      onMouseDown={hover.close}
      onFocus={(event) => {
        if (isFocusVisible(event.target)) hover.scheduleOpen();
      }}
      onBlur={hover.close}
    >
      {children}
      <FloatingLayer
        anchorRef={anchorRef}
        open={hover.open}
        side={side}
        className="pointer-events-none max-w-xs whitespace-nowrap rounded border-0 bg-[var(--color-text-primary)] px-2 py-1 text-xs font-medium text-[var(--color-bg-elevated)] shadow-md"
      >
        <span aria-hidden="true">{label}</span>
      </FloatingLayer>
    </span>
  );
}

/**
 * Richer content shown next to `children` on hover. `content` is mounted only once the popover
 * opens — after `POPOVER_OPEN_DELAY_MS` — so a component that fetches data on mount fetches only
 * for a deliberate hover. The pointer may move onto the open popover without closing it.
 */
export function HoverPopover({
  children,
  content,
  side = "bottom"
}: {
  children: ReactNode;
  content: ReactNode;
  side?: FloatingSide;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const hover = useHoverIntent({ openDelay: POPOVER_OPEN_DELAY_MS, closeDelay: POPOVER_CLOSE_DELAY_MS });

  return (
    // The popover is a React child of this span, so moving onto it does not count as leaving.
    <span
      ref={anchorRef}
      className="inline-flex"
      onMouseEnter={hover.scheduleOpen}
      onMouseLeave={hover.scheduleClose}
      onFocus={(event) => {
        if (isFocusVisible(event.target)) hover.scheduleOpen();
      }}
      onBlur={hover.close}
    >
      {children}
      <FloatingLayer
        anchorRef={anchorRef}
        open={hover.open}
        side={side}
        className="w-72 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 text-left text-sm font-normal text-[var(--color-text-primary)] shadow-lg"
      >
        {content}
      </FloatingLayer>
    </span>
  );
}
