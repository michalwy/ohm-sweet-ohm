"use client";

import type { StorageLocationListItem } from "@/server/inventory/locationMutations";
import { type TreeNode } from "@/app/tree-picker-utils";
import { TreeSelectButton, TreeSelectPanel, defaultTreeSelectButtonClassName, useTreeSelect } from "@/app/tree-select";

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
  "flex-1 grid min-h-10 w-full grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-left text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]";

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
  disabled,
  describeLocation,
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
  disabled?: boolean;
  describeLocation?: (location: StorageLocationListItem) => string | undefined;
  className?: string;
  buttonClassName?: string;
}) {
  const buttonId = `${name}-button`;
  const searchId = `${name}-search`;
  const currentSelectedLocation = locations.find((loc) => loc.id === selectedId);

  const {
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
    setExpandedIds,
    visibleTree,
    effectiveExpandedIds,
    activeItem: activeLocation,
    openSelect,
    setSelected: setSelectedLocation,
    toggleExpanded,
    buildHandleKeyDown,
  } = useTreeSelect({
    items: locations,
    tree: locationTree,
    selectedId,
    filterTree: filterLocationTree,
    onSelectedIdChange,
  });

  function commitActive() {
    if (!activeLocation?.isAssignable) return;
    setSelectedLocation(activeId);
  }

  const handleKeyDown = buildHandleKeyDown(commitActive);

  const selectedDescription = currentSelectedLocation
    ? describeLocation?.(currentSelectedLocation)
    : undefined;
  const triggerLabel = currentSelectedLocation
    ? selectedDescription
      ? `${currentSelectedLocation.name} — ${selectedDescription}`
      : currentSelectedLocation.name
    : emptyLabel ?? copy.chooseLocation;
  const showClear = clearable && Boolean(selectedId);

  return (
    <div ref={containerRef} className={`relative flex items-center gap-1 ${className}`}>
      <TreeSelectButton
        ariaExpanded={isOpen}
        buttonClassName={buttonClassName}
        buttonId={buttonId}
        disabled={disabled}
        hasSelection={Boolean(currentSelectedLocation)}
        selectedLabel={triggerLabel}
        onKeyDown={handleKeyDown}
        onToggle={() => (isOpen ? setIsOpen(false) : openSelect())}
      />
      {showClear && !disabled ? (
        <button
          type="button"
          className="grid h-8 w-8 flex-none place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-placeholder)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
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
                  describeLocation={describeLocation}
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
            <p className="px-2 py-6 text-center text-sm text-[var(--color-text-muted)]">
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
  describeLocation,
  expandedIds,
  activeId,
  level,
  selectedId,
  onSelect,
  onToggleExpanded
}: {
  location: LocationTreeItem;
  copy: LocationTreeSelectCopy;
  describeLocation?: (location: StorageLocationListItem) => string | undefined;
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
  const description = describeLocation?.(location);
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
            className="grid h-7 w-7 place-items-center rounded text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)]"
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
            className={`grid min-h-9 grid-cols-[1fr_auto] items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] ${
              isActive
                ? "bg-[var(--color-accent-soft)] font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-accent-soft)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]"
            }`}
            role="option"
            type="button"
            onClick={() => onSelect(location.id)}
          >
            <span className="block truncate">{location.name}</span>
            {description ? (
              <span className="truncate text-xs text-[var(--color-text-muted)]">{description}</span>
            ) : null}
          </button>
        ) : (
          <span className="truncate px-2 py-1.5 text-sm text-[var(--color-text-placeholder)]">{location.name}</span>
        )}
      </div>
      {hasChildren && isExpanded ? (
        <ol className="mt-1 grid gap-1">
          {location.children.map((child) => (
            <LocationTreeSelectNode
              key={child.id}
              location={child}
              copy={copy}
              describeLocation={describeLocation}
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
