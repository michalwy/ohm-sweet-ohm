"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type BuildPartOption = {
  id: string;
  catalogNumber: string;
  manufacturerName: string;
  description: string | null;
  available: number;
};

type BuildPartSelectProps = {
  options: BuildPartOption[];
  value: string;
  placeholder: string;
  availableLabel: string;
  noOptionsLabel: string;
  invalid?: boolean;
  name: string;
  onChange: (partId: string) => void;
};

const buttonClass =
  "flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-[var(--color-bg-input)] px-3 text-left text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]";

/**
 * Compact rich single-select for allocating a part to a build line: shows the catalog number,
 * manufacturer, description, and available quantity per option. The dropdown is rendered in a
 * portal with fixed positioning (flipping up when there is little room below) so it is never
 * clipped by the scrolling detail panel. Options are expected to be pre-filtered to parts with
 * available stock (plus the current selection). This is a fixed-list picker — not a typeahead —
 * so it deliberately avoids the server-backed `PartPickerCombobox`.
 */
export function BuildPartSelect({
  options,
  value,
  placeholder,
  availableLabel,
  noOptionsLabel,
  invalid,
  name,
  onChange
}: BuildPartSelectProps) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.id === value) ?? null;

  useEffect(() => {
    if (!open) return undefined;

    function reposition() {
      const style = getFloatingPanelStyle(anchorRef.current);
      if (style) setPanelStyle(style);
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const style = getFloatingPanelStyle(anchorRef.current);
    if (style) setPanelStyle(style);
    setPortalTarget(anchorRef.current?.closest("dialog") ?? document.body);
    setOpen(true);
  }

  const panel = (
    <div
      ref={panelRef}
      role="listbox"
      style={panelStyle}
      className="fixed z-50 overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-1 shadow-lg"
    >
      {options.length === 0 ? (
        <p className="px-3 py-2 text-sm text-[var(--color-text-muted)]">{noOptionsLabel}</p>
      ) : (
        options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="option"
            aria-selected={option.id === value}
            className={`flex w-full flex-col gap-0.5 rounded-md px-2.5 py-1.5 text-left transition ${
              option.id === value ? "bg-[var(--color-bg-muted)]" : "hover:bg-[var(--color-bg-subtle)]"
            }`}
            onMouseDown={(event) => {
              // Select before the anchor's blur/outside-click handler can fire.
              event.preventDefault();
              onChange(option.id);
              setOpen(false);
            }}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                {option.catalogNumber}
              </span>
              <span className="shrink-0 rounded bg-[var(--color-bg-subtle)] px-1.5 py-0.5 text-xs text-[var(--color-text-secondary)]">
                {availableLabel} {option.available}
              </span>
            </span>
            {option.manufacturerName ? (
              <span className="truncate text-xs text-[var(--color-text-muted)]">
                {option.manufacturerName}
              </span>
            ) : null}
            {option.description ? (
              <span className="truncate text-xs text-[var(--color-text-placeholder)]">
                {option.description}
              </span>
            ) : null}
          </button>
        ))
      )}
    </div>
  );

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        name={name}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${buttonClass} ${
          invalid ? "border-[var(--color-error)]" : "border-[var(--color-border-strong)]"
        }`}
        onClick={toggle}
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{selected.catalogNumber}</span>
            {selected.manufacturerName ? (
              <span className="truncate text-[var(--color-text-muted)]">{selected.manufacturerName}</span>
            ) : null}
          </span>
        ) : (
          <span className="text-[var(--color-text-placeholder)]">{placeholder}</span>
        )}
        <span aria-hidden="true" className="shrink-0 text-[var(--color-text-muted)]">
          ▾
        </span>
      </button>
      {open ? createPortal(panel, portalTarget ?? document.body) : null}
    </>
  );
}

function getFloatingPanelStyle(anchor: HTMLElement | null): CSSProperties | null {
  if (!anchor) return null;

  const viewportPadding = 16;
  const gap = 4;
  const minimumHeight = 160;
  const rect = anchor.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - viewportPadding - gap;
  const spaceAbove = rect.top - viewportPadding - gap;
  const opensDown = spaceBelow >= minimumHeight || spaceBelow >= spaceAbove;
  const maxHeight = Math.max(120, Math.floor(opensDown ? spaceBelow : spaceAbove));

  return {
    left: rect.left,
    width: rect.width,
    maxHeight,
    ...(opensDown
      ? { top: rect.bottom + gap }
      : { bottom: window.innerHeight - rect.top + gap })
  };
}
