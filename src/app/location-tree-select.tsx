"use client";

import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState
} from "react";

import type { StorageLocationListItem } from "@/server/inventory/locationMutations";
import {
  getAncestorIds,
  getExpandableIds,
  getFloatingPanelStyle,
  getVisibleOptions,
  type TreeNode
} from "@/app/tree-picker-utils";
import { TreeSelectButton, TreeSelectPanel, defaultTreeSelectButtonClassName } from "@/app/tree-select";

export type LocationTreeItem = TreeNode<StorageLocationListItem>;

export type LocationTreeSelectCopy = {
  chooseLocation: string;
  searchLocations: string;
  noMatchingLocations: string;
  expandLocation: string;
  collapseLocation: string;
};

export function filterLocationTree(
  locations: LocationTreeItem[],
  normalizedSearchQuery: string
): LocationTreeItem[] {
  const filtered: LocationTreeItem[] = [];

  for (const location of locations) {
    const children = filterLocationTree(location.children, normalizedSearchQuery);
    const matches = location.name.toLocaleLowerCase("en").includes(normalizedSearchQuery);

    if (matches || children.length > 0) {
      filtered.push({ ...location, children });
    }
  }

  return filtered;
}

export const defaultLocationSelectButtonClassName = `flex-1 ${defaultTreeSelectButtonClassName}`;

export const formLocationSelectButtonClassName =
  "flex-1 grid min-h-10 w-full grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-left text-sm text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

export function LocationTreeSelect({
  locations,
  locationTree,
  copy,
  name,
  selectedId,
  onSelectedIdChange,
  clearable,
  onClear,
  emptyLabel,
  className = "w-44",
  buttonClassName = defaultLocationSelectButtonClassName
}: {
  locations: StorageLocationListItem[];
  locationTree: LocationTreeItem[];
  copy: LocationTreeSelectCopy;
  name: string;
  selectedId: string;
  onSelectedIdChange: (locationId: string) => void;
  clearable?: boolean;
  onClear?: () => void;
  emptyLabel?: string;
  className?: string;
  buttonClassName?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonId = `${name}-button`;
  const searchId = `${name}-search`;
  const currentSelectedLocation = locations.find((loc) => loc.id === selectedId);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [activeId, setActiveId] = useState(selectedId);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => getAncestorIds(locations, selectedId)
  );
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase("en");
  const visibleTree = normalizedSearchQuery
    ? filterLocationTree(locationTree, normalizedSearchQuery)
    : locationTree;
  const effectiveExpandedIds = normalizedSearchQuery
    ? getExpandableIds(visibleTree)
    : expandedIds;
  const visibleOptions = getVisibleOptions(visibleTree, effectiveExpandedIds);
  const activeLocation = visibleOptions.find((loc) => loc.id === activeId);
  const keyboardOptionIds = visibleOptions.map((loc) => loc.id);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

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
      if (nextStyle) {
        setPanelStyle(nextStyle);
      }
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
    setExpandedIds(getAncestorIds(locations, selectedId));
    setActiveId(selectedId);
    setPanelStyle(getFloatingPanelStyle(containerRef.current) ?? {});
    setPortalTarget(containerRef.current?.closest("dialog") ?? document.body);
    setIsOpen(true);
  }

  function setSelectedLocation(locationId: string) {
    onSelectedIdChange(locationId);
    setIsOpen(false);
    setSearchQuery("");
    setActiveId(locationId);
    setExpandedIds(getAncestorIds(locations, locationId));
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

  function commitActive() {
    if (!activeLocation?.isAssignable) return;
    setSelectedLocation(activeId);
  }

  function handleKeyDown(event: ReactKeyboardEvent) {
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
    if (event.key === "ArrowRight" && isOpen && activeLocation?.children.length) {
      event.preventDefault();
      setExpandedIds(new Set(expandedIds).add(activeId));
    }
    if (event.key === "ArrowLeft" && isOpen && activeLocation?.children.length) {
      event.preventDefault();
      const next = new Set(expandedIds);
      next.delete(activeId);
      setExpandedIds(next);
    }
  }

  function toggleExpanded(locationId: string) {
    const next = new Set(expandedIds);
    if (next.has(locationId)) next.delete(locationId);
    else next.add(locationId);
    setExpandedIds(next);
  }

  const triggerLabel = currentSelectedLocation?.name ?? emptyLabel ?? copy.chooseLocation;
  const showClear = clearable && Boolean(selectedId);

  return (
    <div ref={containerRef} className={`relative flex items-center gap-1 ${className}`}>
      <TreeSelectButton
        ariaExpanded={isOpen}
        buttonClassName={buttonClassName}
        buttonId={buttonId}
        hasSelection={Boolean(currentSelectedLocation)}
        selectedLabel={triggerLabel}
        onKeyDown={handleKeyDown}
        onToggle={() => (isOpen ? setIsOpen(false) : openSelect())}
      />
      {showClear ? (
        <button
          type="button"
          className="grid h-8 w-8 flex-none place-items-center rounded-md border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
          onClick={() => {
            onClear?.();
            onSelectedIdChange("");
            setActiveId("");
            setExpandedIds(new Set());
          }}
        >
          <span aria-hidden="true" className="text-base leading-none">×</span>
        </button>
      ) : null}
      {isOpen ? (
        <TreeSelectPanel
          listboxAriaLabelledby={buttonId}
          panelMinWidth={240}
          panelRef={panelRef}
          panelStyle={panelStyle}
          portalTarget={portalTarget}
          searchId={searchId}
          searchLabel={copy.searchLocations}
          searchQuery={searchQuery}
          onKeyDown={handleKeyDown}
          onSearchChange={setSearchQuery}
        >
          {visibleTree.length > 0 ? (
            <ol className="grid gap-1">
              {visibleTree.map((location) => (
                <LocationTreeSelectNode
                  key={location.id}
                  location={location}
                  copy={copy}
                  expandedIds={effectiveExpandedIds}
                  activeId={activeId}
                  level={0}
                  selectedId={selectedId}
                  onSelect={setSelectedLocation}
                  onToggleExpanded={toggleExpanded}
                />
              ))}
            </ol>
          ) : (
            <p className="px-2 py-6 text-center text-sm text-slate-500">
              {copy.noMatchingLocations}
            </p>
          )}
        </TreeSelectPanel>
      ) : null}
    </div>
  );
}

function LocationTreeSelectNode({
  location,
  copy,
  expandedIds,
  activeId,
  level,
  selectedId,
  onSelect,
  onToggleExpanded
}: {
  location: LocationTreeItem;
  copy: LocationTreeSelectCopy;
  expandedIds: Set<string>;
  activeId: string;
  level: number;
  selectedId: string;
  onSelect: (locationId: string) => void;
  onToggleExpanded: (locationId: string) => void;
}) {
  const hasChildren = location.children.length > 0;
  const isExpanded = expandedIds.has(location.id);
  const isSelected = selectedId === location.id;
  const isActive = activeId === location.id;
  const canSelect = location.isAssignable;
  const toggleLabel = isExpanded
    ? `${copy.collapseLocation} ${location.name}`
    : `${copy.expandLocation} ${location.name}`;

  return (
    <li>
      <div
        className="grid min-h-9 grid-cols-[1.75rem_1fr] items-center rounded-md"
        style={{ paddingLeft: `${level}rem` }}
      >
        {hasChildren ? (
          <button
            aria-expanded={isExpanded}
            aria-label={toggleLabel}
            className="grid h-7 w-7 place-items-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
            type="button"
            onClick={() => onToggleExpanded(location.id)}
          >
            <span
              aria-hidden="true"
              className={`text-xs leading-none transition-transform ${isExpanded ? "rotate-90" : ""}`}
            >
              ▶
            </span>
          </button>
        ) : (
          <span />
        )}
        {canSelect ? (
          <button
            aria-selected={isSelected}
            className={`min-h-9 rounded-md px-2 py-1.5 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-slate-300 ${
              isActive
                ? "bg-[var(--color-accent-soft)] font-semibold text-slate-950 hover:bg-[var(--color-accent-soft)]"
                : "text-slate-700 hover:bg-slate-50"
            }`}
            role="option"
            type="button"
            onClick={() => onSelect(location.id)}
          >
            <span className="block truncate">{location.name}</span>
          </button>
        ) : (
          <span className="truncate px-2 py-1.5 text-sm text-slate-400">{location.name}</span>
        )}
      </div>
      {hasChildren && isExpanded ? (
        <ol className="mt-1 grid gap-1">
          {location.children.map((child) => (
            <LocationTreeSelectNode
              key={child.id}
              location={child}
              copy={copy}
              expandedIds={expandedIds}
              activeId={activeId}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onToggleExpanded={onToggleExpanded}
            />
          ))}
        </ol>
      ) : null}
    </li>
  );
}
