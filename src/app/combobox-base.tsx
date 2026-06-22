"use client";

import type { CSSProperties, UIEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ComboboxBaseItem = { id: string };

type ComboboxBaseProps<T extends ComboboxBaseItem> = {
  inputId: string;
  inputValue: string;
  placeholder: string;
  disabled?: boolean;
  /** name attribute forwarded to the underlying <input> — needed when the input value is the form value (free-text mode). */
  inputName?: string;
  /** Override the default input className entirely. */
  inputClassName?: string;
  /** Sets aria-invalid on the input. */
  inputAriaInvalid?: boolean;
  /** When false, the dropdown won't open (e.g. when an item is already selected). Default: true. */
  openGate?: boolean;
  items: T[];
  isLoading?: boolean;
  hasMore?: boolean;
  noItemsLabel?: string;
  loadingLabel?: string;
  renderItem: (item: T, isActive: boolean) => React.ReactNode;
  onInputChange: (value: string) => void;
  onItemSelect: (item: T) => void;
  onLoadMore?: () => void;
  /** "portal" (default) uses a fixed-position floating panel via createPortal.
   *  "absolute" renders the panel inline — use when portal z-index is not needed. */
  positionMode?: "portal" | "absolute";
  className?: string;
};

export function ComboboxBase<T extends ComboboxBaseItem>({
  inputId,
  inputValue,
  placeholder,
  disabled,
  inputName,
  inputClassName,
  inputAriaInvalid,
  openGate = true,
  items,
  isLoading,
  hasMore,
  noItemsLabel,
  loadingLabel,
  renderItem,
  onInputChange,
  onItemSelect,
  onLoadMore,
  positionMode = "portal",
  className,
}: ComboboxBaseProps<T>) {
  const [isOpenState, setIsOpenState] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const isOpen = isOpenState && openGate && inputValue.length > 0;

  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const listboxId = `${inputId}-listbox`;

  // Reset active index when new results arrive.
  const firstItemId = items[0]?.id ?? null;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIndex(0);
  }, [firstItemId]);

  // Reposition floating panel on resize or scroll while open.
  useEffect(() => {
    if (!isOpen || positionMode !== "portal") return undefined;

    function reposition() {
      const style = getFloatingPanelStyle(anchorRef.current);
      if (style) setPanelStyle(style);
    }

    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [isOpen, positionMode]);

  // Scroll active item into view on keyboard navigation.
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const el = panelRef.current.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen]);

  function positionPanel() {
    if (positionMode === "portal") {
      const style = getFloatingPanelStyle(anchorRef.current);
      if (style) setPanelStyle(style);
      setPortalTarget(anchorRef.current?.closest("dialog") ?? document.body);
    }
  }

  function openDropdown() {
    positionPanel();
    setIsOpenState(true);
  }

  function closeDropdown() {
    setIsOpenState(false);
    setActiveIndex(0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) { openDropdown(); return; }
      const dir = e.key === "ArrowDown" ? 1 : -1;
      if (items.length > 0) {
        setActiveIndex((i) => (i + dir + items.length) % items.length);
      }
    }
    if (e.key === "Enter" && isOpen && items[activeIndex]) {
      e.preventDefault();
      onItemSelect(items[activeIndex]);
      closeDropdown();
    }
    if (e.key === "Escape" && isOpen) {
      e.preventDefault();
      closeDropdown();
    }
  }

  function handleListScroll(e: UIEvent<HTMLOListElement>) {
    if (!onLoadMore || !hasMore) return;
    const el = e.currentTarget;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceToBottom <= 24) onLoadMore();
  }

  const panel = (
    <div
      ref={panelRef}
      id={listboxId}
      role="listbox"
      className={
        positionMode === "portal"
          ? "fixed z-50 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
          : "absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
      }
      style={positionMode === "portal" ? panelStyle : undefined}
    >
      {isLoading && items.length === 0 ? (
        <p className="px-3 py-3 text-sm text-slate-500">{loadingLabel}</p>
      ) : items.length === 0 ? (
        <p className="px-3 py-3 text-sm text-slate-500">{noItemsLabel}</p>
      ) : (
        <ol className="max-h-56 overflow-auto p-1" onScroll={handleListScroll}>
          {items.map((item, i) => (
            <li key={item.id} role="option" aria-selected={i === activeIndex}>
              <button
                id={`${inputId}-option-${item.id}`}
                data-index={i}
                type="button"
                className="w-full rounded-md text-left transition focus:outline-none"
                onMouseDown={(e) => {
                  // Prevent onBlur firing before click.
                  e.preventDefault();
                  onItemSelect(item);
                  closeDropdown();
                }}
              >
                {renderItem(item, i === activeIndex)}
              </button>
            </li>
          ))}
          {isLoading && items.length > 0 ? (
            <li className="px-3 py-2 text-xs text-slate-400">{loadingLabel}</li>
          ) : null}
        </ol>
      )}
    </div>
  );

  return (
    <div ref={anchorRef} className={`relative ${className ?? ""}`}>
      <input
        id={inputId}
        autoComplete="off"
        disabled={disabled}
        name={inputName}
        placeholder={placeholder}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-invalid={inputAriaInvalid || undefined}
        aria-activedescendant={isOpen && items[activeIndex] ? `${inputId}-option-${items[activeIndex].id}` : undefined}
        type="text"
        value={inputValue}
        className={inputClassName ?? "min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"}
        onChange={(e) => {
          onInputChange(e.target.value);
          openDropdown();
        }}
        onFocus={() => { clearTimeout(blurTimerRef.current); openDropdown(); }}
        onBlur={() => { blurTimerRef.current = setTimeout(() => closeDropdown(), 150); }}
        onKeyDown={handleKeyDown}
      />
      {isOpen
        ? positionMode === "portal"
          ? createPortal(panel, portalTarget ?? document.body)
          : panel
        : null}
    </div>
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
      : { bottom: window.innerHeight - rect.top + gap }),
  };
}
