"use client";

import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, UIEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useInfiniteQuery } from "@tanstack/react-query";

import { useDebouncedValue } from "@/app/use-debounced-value";
import { getPartsListPageForWorkspace } from "@/server/parts/listActions";

export type PartPickerOption = {
  id: string;
  catalogNumber: string;
  manufacturerName: string;
  description: string | null;
  primaryCategoryPath: string | null;
};

type PartPickerComboboxProps = {
  workspaceSlug: string;
  /** Text currently shown in the input (controlled by parent). */
  inputValue: string;
  /** Set when a part has been confirmed-selected; null means user is searching. */
  selectedPartId: string | null;
  placeholder: string;
  loadingLabel: string;
  noMatchesLabel: string;
  onInputChange: (value: string) => void;
  onSelect: (part: PartPickerOption) => void;
};

export function PartPickerCombobox({
  workspaceSlug,
  inputValue,
  selectedPartId,
  placeholder,
  loadingLabel,
  noMatchesLabel,
  onInputChange,
  onSelect,
}: PartPickerComboboxProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  const debouncedInputValue = useDebouncedValue(inputValue, 300);
  // When a part is already selected, don't search — input shows the display label.
  const searchQuery = selectedPartId ? undefined : (debouncedInputValue.trim() || undefined);

  const partsQuery = useInfiniteQuery({
    queryKey: ["part-picker", workspaceSlug, searchQuery ?? ""],
    enabled: isOpen && !selectedPartId,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const result = await getPartsListPageForWorkspace({
        workspaceSlug,
        searchQuery,
        pageSize: 12,
        cursor: pageParam,
      });
      return result.ok
        ? result.page
        : { items: [], nextCursor: null, totalCount: 0, filteredCount: 0 };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: (prev) => prev,
  });

  const allParts = partsQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const activeItem = allParts[activeIndex];

  // Reposition floating panel on resize or scroll while open.
  useEffect(() => {
    if (!isOpen) return undefined;

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
  }, [isOpen]);

  // Reset active index when search results change.
  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery]);

  // Scroll active item into view on keyboard navigation.
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const el = panelRef.current.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen]);

  function openPanel() {
    const style = getFloatingPanelStyle(anchorRef.current);
    if (style) setPanelStyle(style);
    setPortalTarget(anchorRef.current?.closest("dialog") ?? document.body);
    setIsOpen(true);
  }

  function handleListScroll(e: UIEvent<HTMLOListElement>) {
    const el = e.currentTarget;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceToBottom <= 24 && partsQuery.hasNextPage && !partsQuery.isFetchingNextPage) {
      void partsQuery.fetchNextPage();
    }
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, allParts.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeItem) {
      e.preventDefault();
      onSelect(activeItem);
      setIsOpen(false);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  }

  const showDropdown = isOpen && !selectedPartId;

  return (
    <div ref={anchorRef}>
      <input
        autoComplete="off"
        className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        placeholder={placeholder}
        type="text"
        value={inputValue}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        onChange={(e) => {
          const next = e.target.value;
          onInputChange(next);
          if (next.length > 0 && !selectedPartId) {
            if (!isOpen) openPanel();
          } else {
            setIsOpen(false);
          }
        }}
        onFocus={() => {
          if (!selectedPartId && inputValue.length > 0) openPanel();
        }}
        onKeyDown={handleKeyDown}
      />
      {showDropdown
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-50 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
              style={panelStyle}
            >
              {partsQuery.isLoading ? (
                <p className="px-3 py-3 text-sm text-slate-500">{loadingLabel}</p>
              ) : allParts.length === 0 ? (
                <p className="px-3 py-3 text-sm text-slate-500">{noMatchesLabel}</p>
              ) : (
                <ol className="max-h-56 overflow-auto p-1" onScroll={handleListScroll}>
                  {allParts.map((part, i) => (
                    <li key={part.id}>
                      <button
                        data-index={i}
                        className={`flex w-full flex-col rounded-md px-3 py-2 text-left text-sm transition ${
                          i === activeIndex ? "bg-slate-100" : "hover:bg-slate-50"
                        }`}
                        type="button"
                        onMouseDown={(e) => {
                          // Prevent onBlur from firing before onClick.
                          e.preventDefault();
                          onSelect(part);
                          setIsOpen(false);
                        }}
                        onMouseEnter={() => setActiveIndex(i)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{part.catalogNumber}</span>
                          <span className="text-slate-500">{part.manufacturerName}</span>
                        </div>
                        {part.description ? (
                          <p className="truncate text-xs text-slate-500">{part.description}</p>
                        ) : null}
                        {part.primaryCategoryPath ? (
                          <p className="truncate text-xs text-slate-400">{part.primaryCategoryPath}</p>
                        ) : null}
                      </button>
                    </li>
                  ))}
                  {partsQuery.isFetchingNextPage ? (
                    <li className="px-3 py-2 text-xs text-slate-400">{loadingLabel}</li>
                  ) : null}
                </ol>
              )}
            </div>,
            portalTarget ?? document.body
          )
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
