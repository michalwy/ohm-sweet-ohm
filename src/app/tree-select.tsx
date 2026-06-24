"use client";

import { createPortal } from "react-dom";
import {
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { getFieldInputClassName } from "@/app/dialog-shell";
import {
  getAncestorIds,
  getExpandableIds,
  getFloatingPanelStyle,
  getVisibleOptions,
  type TreeNode,
} from "@/app/tree-picker-utils";

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

export function useTreeSelect<T extends { id: string; parentId: string | null; name: string }>({
  items,
  tree,
  selectedId,
  filterTree,
  onSelectedIdChange,
  includeEmptyOption = false,
}: {
  items: T[];
  tree: TreeNode<T>[];
  selectedId: string;
  filterTree: (tree: TreeNode<T>[], normalizedQuery: string) => TreeNode<T>[];
  onSelectedIdChange: (id: string) => void;
  includeEmptyOption?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [activeId, setActiveId] = useState(selectedId);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => getAncestorIds(items, selectedId)
  );

  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase("en");
  const visibleTree = normalizedSearchQuery
    ? filterTree(tree, normalizedSearchQuery)
    : tree;
  const effectiveExpandedIds = normalizedSearchQuery
    ? getExpandableIds(visibleTree)
    : expandedIds;
  const visibleOptions = getVisibleOptions(visibleTree, effectiveExpandedIds);
  const activeItem = visibleOptions.find((item) => item.id === activeId);
  const keyboardOptionIds = includeEmptyOption
    ? ["", ...visibleOptions.map((item) => item.id)]
    : visibleOptions.map((item) => item.id);

  useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target) &&
        !panelRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        setSearchQuery("");
      }
    }

    function onReposition() {
      const nextStyle = getFloatingPanelStyle(containerRef.current);
      if (nextStyle) setPanelStyle(nextStyle);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [isOpen]);

  function openSelect() {
    setExpandedIds(getAncestorIds(items, selectedId));
    setActiveId(selectedId);
    setPanelStyle(getFloatingPanelStyle(containerRef.current) ?? {});
    setPortalTarget(containerRef.current?.closest("dialog") ?? document.body);
    setIsOpen(true);
  }

  function setSelected(id: string) {
    onSelectedIdChange(id);
    setIsOpen(false);
    setSearchQuery("");
    setActiveId(id);
    setExpandedIds(getAncestorIds(items, id));
  }

  function selectInPlace(id: string) {
    onSelectedIdChange(id);
    setActiveId(id);
    setExpandedIds(getAncestorIds(items, id));
  }

  function moveActive(direction: 1 | -1) {
    if (keyboardOptionIds.length === 0) return;
    const currentIndex = keyboardOptionIds.indexOf(activeId);
    const nextIndex =
      currentIndex === -1
        ? direction === 1
          ? 0
          : keyboardOptionIds.length - 1
        : (currentIndex + direction + keyboardOptionIds.length) % keyboardOptionIds.length;
    setActiveId(keyboardOptionIds[nextIndex]);
  }

  function toggleExpanded(id: string) {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  }

  function buildHandleKeyDown(commitActive: () => void) {
    return function handleKeyDown(event: ReactKeyboardEvent) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!isOpen) openSelect();
        else moveActive(1);
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (!isOpen) openSelect();
        else moveActive(-1);
      }
      if (event.key === "Enter" && isOpen) {
        event.preventDefault();
        commitActive();
      }
      if (event.key === "ArrowRight" && isOpen && activeItem && activeItem.children.length > 0) {
        event.preventDefault();
        setExpandedIds(new Set(expandedIds).add(activeId));
      }
      if (event.key === "ArrowLeft" && isOpen && activeItem && activeItem.children.length > 0) {
        event.preventDefault();
        const next = new Set(expandedIds);
        next.delete(activeId);
        setExpandedIds(next);
      }
    };
  }

  return {
    containerRef,
    panelRef,
    isOpen,
    setIsOpen,
    searchQuery,
    setSearchQuery,
    panelStyle,
    portalTarget,
    activeId,
    setActiveId,
    expandedIds,
    setExpandedIds: setExpandedIds as Dispatch<SetStateAction<Set<string>>>,
    normalizedSearchQuery,
    visibleTree,
    effectiveExpandedIds,
    visibleOptions,
    activeItem,
    keyboardOptionIds,
    openSelect,
    setSelected,
    selectInPlace,
    moveActive,
    toggleExpanded,
    buildHandleKeyDown,
  };
}
