"use client";

import { createPortal } from "react-dom";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  RefObject
} from "react";
import { getFieldInputClassName } from "@/app/dialog-shell";

export const defaultTreeSelectButtonClassName =
  "grid min-h-8 w-full grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-left text-sm text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

export function TreeSelectButton({
  ariaExpanded,
  ariaInvalid,
  ariaLabel,
  ariaLabelledby,
  buttonClassName = defaultTreeSelectButtonClassName,
  buttonId,
  disabled,
  hasSelection,
  selectedLabel,
  onKeyDown,
  onToggle
}: {
  ariaExpanded: boolean;
  ariaInvalid?: boolean;
  ariaLabel?: string;
  ariaLabelledby?: string;
  buttonClassName?: string;
  buttonId: string;
  disabled?: boolean;
  hasSelection: boolean;
  selectedLabel: string;
  onKeyDown: (event: ReactKeyboardEvent) => void;
  onToggle: () => void;
}) {
  return (
    <button
      id={buttonId}
      aria-expanded={ariaExpanded}
      aria-haspopup="listbox"

      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      className={getFieldInputClassName(buttonClassName, Boolean(ariaInvalid))}
      disabled={disabled}
      type="button"
      onClick={onToggle}
      onKeyDown={onKeyDown}
    >
      <span className={hasSelection ? "truncate" : "text-slate-400"}>{selectedLabel}</span>
      <span aria-hidden="true" className="text-sm text-slate-500">
        ▾
      </span>
    </button>
  );
}

export function TreeSelectPanel({
  children,
  listboxAriaLabelledby,
  panelMinWidth,
  panelRef,
  panelStyle,
  portalTarget,
  searchId,
  searchLabel,
  searchQuery,
  onKeyDown,
  onSearchChange
}: {
  children: ReactNode;
  listboxAriaLabelledby?: string;
  panelMinWidth?: number;
  panelRef: RefObject<HTMLDivElement | null>;
  panelStyle: CSSProperties;
  portalTarget: HTMLElement | null;
  searchId: string;
  searchLabel: string;
  searchQuery: string;
  onKeyDown: (event: ReactKeyboardEvent) => void;
  onSearchChange: (query: string) => void;
}) {
  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-50 flex overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
      style={panelMinWidth ? { ...panelStyle, minWidth: panelMinWidth } : panelStyle}
      onKeyDown={onKeyDown}
    >
      <div className="flex min-h-0 w-full flex-col">
        <div className="border-b border-slate-200 p-2">
          <label className="sr-only" htmlFor={searchId}>
            {searchLabel}
          </label>
          <input
            id={searchId}
            autoFocus
            className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            placeholder={searchLabel}
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            onKeyDown={onKeyDown}
          />
        </div>
        <div
          aria-labelledby={listboxAriaLabelledby}
          className="min-h-0 overflow-auto p-2"
          role="listbox"
        >
          {children}
        </div>
      </div>
    </div>,
    portalTarget ?? document.body
  );
}
