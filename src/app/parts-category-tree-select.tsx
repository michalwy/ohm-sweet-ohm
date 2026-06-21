"use client";

import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { PartCategoryListItem } from "@/server/parts/categories";
import { LabelWithError } from "@/app/dialog-shell";
import { TreeSelectButton, TreeSelectPanel } from "@/app/tree-select";

export type CategoryTreeItem = PartCategoryListItem & {
  children: CategoryTreeItem[];
};

export type CategoryTreeSelectCopy = {
  searchCategories: string;
  noMatchingCategories: string;
  expandCategory: string;
  collapseCategory: string;
};

// ---------------------------------------------------------------------------
// Tree building / filtering helpers
// ---------------------------------------------------------------------------

export function buildCategoryTree(categories: PartCategoryListItem[]): CategoryTreeItem[] {
  const nodesById = new Map<string, CategoryTreeItem>();

  for (const category of categories) {
    nodesById.set(category.id, { ...category, children: [] });
  }

  const roots: CategoryTreeItem[] = [];

  for (const category of categories) {
    const node = nodesById.get(category.id);

    if (!node) {
      continue;
    }

    const parent = category.parentId
      ? nodesById.get(category.parentId)
      : undefined;

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  sortCategoryTree(roots);

  return roots;
}

function sortCategoryTree(categories: CategoryTreeItem[]) {
  categories.sort((left, right) =>
    left.name.localeCompare(right.name, "en", { sensitivity: "base" })
  );

  for (const category of categories) {
    sortCategoryTree(category.children);
  }
}

export function getAncestorIds(categories: PartCategoryListItem[], categoryId: string) {
  const categoriesById = new Map(
    categories.map((category) => [category.id, category])
  );
  const ancestorIds = new Set<string>();
  let currentCategory = categoriesById.get(categoryId);

  while (currentCategory?.parentId) {
    ancestorIds.add(currentCategory.parentId);
    currentCategory = categoriesById.get(currentCategory.parentId);
  }

  return ancestorIds;
}

function getExpandableCategoryIds(categories: CategoryTreeItem[]) {
  const expandableIds = new Set<string>();

  for (const category of categories) {
    if (category.children.length > 0) {
      expandableIds.add(category.id);
    }

    for (const childId of getExpandableCategoryIds(category.children)) {
      expandableIds.add(childId);
    }
  }

  return expandableIds;
}

function filterCategoryTree(
  categories: CategoryTreeItem[],
  normalizedSearchQuery: string
) {
  const filteredCategories: CategoryTreeItem[] = [];

  for (const category of categories) {
    const children = filterCategoryTree(category.children, normalizedSearchQuery);
    const matches =
      category.name.toLocaleLowerCase("en").includes(normalizedSearchQuery) ||
      category.path.toLocaleLowerCase("en").includes(normalizedSearchQuery);

    if (matches || children.length > 0) {
      filteredCategories.push({ ...category, children });
    }
  }

  return filteredCategories;
}

export function findFirstAssignableCategory(
  categories: CategoryTreeItem[],
  excludedCategoryId: string | undefined,
  allowOrganizationalCategories: boolean
): CategoryTreeItem | null {
  for (const category of categories) {
    if (
      isCategorySelectable({
        allowOrganizationalCategories,
        category,
        excludedCategoryId
      })
    ) {
      return category;
    }

    const matchingChild = findFirstAssignableCategory(
      category.children,
      excludedCategoryId,
      allowOrganizationalCategories
    );

    if (matchingChild) {
      return matchingChild;
    }
  }

  return null;
}

export function isCategorySelectable({
  allowOrganizationalCategories,
  category,
  excludedCategoryId
}: {
  allowOrganizationalCategories: boolean;
  category: CategoryTreeItem;
  excludedCategoryId?: string;
}) {
  return (
    category.id !== excludedCategoryId &&
    (allowOrganizationalCategories || category.isAssignable)
  );
}

function getVisibleCategoryOptions(
  categories: CategoryTreeItem[],
  expandedCategoryIds: Set<string>
) {
  const visibleCategories: CategoryTreeItem[] = [];

  for (const category of categories) {
    visibleCategories.push(category);

    if (expandedCategoryIds.has(category.id)) {
      visibleCategories.push(
        ...getVisibleCategoryOptions(category.children, expandedCategoryIds)
      );
    }
  }

  return visibleCategories;
}

export function getCreatePrimaryCategoryFromFilter({
  categories,
  categoryFilterId
}: {
  categories: PartCategoryListItem[];
  categoryFilterId: string;
}) {
  if (!categoryFilterId) {
    return "";
  }

  const filteredCategory = categories.find(
    (category) => category.id === categoryFilterId
  );

  return filteredCategory?.isAssignable ? filteredCategory.id : "";
}

export function getFloatingPanelStyle(
  anchor: HTMLElement | null
): CSSProperties | null {
  if (!anchor) {
    return null;
  }

  const viewportPadding = 16;
  const gap = 4;
  const minimumHeight = 220;
  const rect = anchor.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - viewportPadding - gap;
  const spaceAbove = rect.top - viewportPadding - gap;
  const opensDown = spaceBelow >= minimumHeight || spaceBelow >= spaceAbove;
  const maxHeight = Math.max(160, Math.floor(opensDown ? spaceBelow : spaceAbove));

  return {
    left: rect.left,
    width: rect.width,
    maxHeight,
    ...(opensDown
      ? { top: rect.bottom + gap }
      : { bottom: window.innerHeight - rect.top + gap })
  };
}

// ---------------------------------------------------------------------------
// Public CSS class constants
// ---------------------------------------------------------------------------

export const defaultCategorySelectButtonClassName =
  "grid min-h-11 grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-base text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

export const compactCategorySelectButtonClassName =
  "grid min-h-9 grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-left text-sm text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

// ---------------------------------------------------------------------------
// CategoryTreeSelectNode (internal)
// ---------------------------------------------------------------------------

function CategoryTreeSelectNode({
  allowOrganizationalCategories,
  category,
  copy,
  excludedCategoryId,
  expandedCategoryIds,
  activeCategoryId,
  level,
  selectedId,
  onSelect,
  onToggleExpanded
}: {
  allowOrganizationalCategories: boolean;
  category: CategoryTreeItem;
  copy: CategoryTreeSelectCopy;
  excludedCategoryId?: string;
  expandedCategoryIds: Set<string>;
  activeCategoryId: string;
  level: number;
  selectedId: string;
  onSelect: (categoryId: string) => void;
  onToggleExpanded: (categoryId: string) => void;
}) {
  const hasChildren = category.children.length > 0;
  const isExpanded = expandedCategoryIds.has(category.id);
  const isSelectable = isCategorySelectable({
    allowOrganizationalCategories,
    category,
    excludedCategoryId
  });
  const isSelected = selectedId === category.id;
  const isActive = activeCategoryId === category.id;
  const activeClassName = isSelectable
    ? "bg-[var(--color-accent-soft)] font-semibold text-slate-950 hover:bg-[var(--color-accent-soft)]"
    : "bg-white font-medium text-slate-800 ring-2 ring-inset ring-slate-400";
  const toggleLabel = isExpanded
    ? `${copy.collapseCategory} ${category.name}`
    : `${copy.expandCategory} ${category.name}`;

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
            onClick={() => onToggleExpanded(category.id)}
          >
            <span
              aria-hidden="true"
              className={`text-xs leading-none transition-transform ${
                isExpanded ? "rotate-90" : ""
              }`}
            >
              ▶
            </span>
          </button>
        ) : (
          <span />
        )}
        <button
          aria-disabled={!isSelectable}
          aria-selected={isSelected}
          className={`min-h-9 rounded-md px-2 py-1.5 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-slate-300 ${
            isActive ? activeClassName : "text-slate-700"
          } ${
            isSelectable && !isSelected ? "hover:bg-slate-50" : ""
          } ${
            !isSelectable && !isActive ? "text-slate-500" : ""
          }`}
          role="option"
          type="button"
          onClick={() =>
            isSelectable ? onSelect(category.id) : onToggleExpanded(category.id)
          }
        >
          <span className="block truncate">{category.name}</span>
        </button>
      </div>
      {hasChildren && isExpanded ? (
        <ol className="mt-1 grid gap-1">
          {category.children.map((child) => (
            <CategoryTreeSelectNode
              key={child.id}
              allowOrganizationalCategories={allowOrganizationalCategories}
              category={child}
              copy={copy}
              excludedCategoryId={excludedCategoryId}
              expandedCategoryIds={expandedCategoryIds}
              activeCategoryId={activeCategoryId}
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

// ---------------------------------------------------------------------------
// CategoryTreeSelect (public)
// ---------------------------------------------------------------------------

export function CategoryTreeSelect({
  allowOrganizationalCategories = false,
  buttonClassName = defaultCategorySelectButtonClassName,
  categories,
  categoryTree,
  copy,
  disabled,
  excludedCategoryId,
  label,
  name,
  noSelectionLabel,
  selectedId,
  error,
  onSelectedIdChange
}: {
  allowOrganizationalCategories?: boolean;
  buttonClassName?: string;
  categories: PartCategoryListItem[];
  categoryTree: CategoryTreeItem[];
  copy: CategoryTreeSelectCopy;
  disabled: boolean;
  excludedCategoryId?: string;
  label: string;
  name: string;
  noSelectionLabel: string;
  selectedId: string;
  error?: string;
  onSelectedIdChange: (categoryId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const labelId = `${name}-label`;
  const buttonId = `${name}-button`;
  const searchId = `${name}-search`;
  const currentSelectedId = selectedId;
  const currentSelectedCategory = categories.find(
    (category) => category.id === currentSelectedId
  );
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState(currentSelectedId);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(
    () => getAncestorIds(categories, selectedId)
  );
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase("en");
  const visibleTree = normalizedSearchQuery
    ? filterCategoryTree(categoryTree, normalizedSearchQuery)
    : categoryTree;
  const searchExpandedCategoryIds = normalizedSearchQuery
    ? getExpandableCategoryIds(visibleTree)
    : expandedCategoryIds;
  const effectiveExpandedCategoryIds = normalizedSearchQuery
    ? searchExpandedCategoryIds
    : expandedCategoryIds;
  const visibleCategoryOptions = getVisibleCategoryOptions(
    visibleTree,
    effectiveExpandedCategoryIds
  );
  const activeCategory = visibleCategoryOptions.find(
    (category) => category.id === activeCategoryId
  );
  const keyboardOptionIds = [
    "",
    ...visibleCategoryOptions.map((category) => category.id)
  ];

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
    if (disabled) {
      return;
    }

    setExpandedCategoryIds(getAncestorIds(categories, currentSelectedId));
    setActiveCategoryId(currentSelectedId);
    setPanelStyle(getFloatingPanelStyle(containerRef.current) ?? {});
    setPortalTarget(containerRef.current?.closest("dialog") ?? document.body);
    setIsOpen(true);
  }

  function setSelectedCategory(categoryId: string) {
    onSelectedIdChange(categoryId);
    setIsOpen(false);
    setSearchQuery("");
    setActiveCategoryId(categoryId);
    setExpandedCategoryIds(getAncestorIds(categories, categoryId));
  }

  function updateSearchQuery(query: string) {
    const normalizedQuery = query.trim().toLocaleLowerCase("en");

    setSearchQuery(query);

    if (!normalizedQuery) {
      return;
    }

    const firstMatchingCategory = findFirstAssignableCategory(
      filterCategoryTree(categoryTree, normalizedQuery),
      excludedCategoryId,
      allowOrganizationalCategories
    );

    if (!firstMatchingCategory) {
      return;
    }

    setActiveCategoryId(firstMatchingCategory.id);
    if (firstMatchingCategory.id === currentSelectedId) {
      return;
    }

    onSelectedIdChange(firstMatchingCategory.id);
    setExpandedCategoryIds(getAncestorIds(categories, firstMatchingCategory.id));
  }

  function moveActiveCategory(direction: 1 | -1) {
    if (keyboardOptionIds.length === 0) {
      return;
    }

    const currentIndex = keyboardOptionIds.indexOf(activeCategoryId);
    const nextIndex =
      currentIndex === -1
        ? direction === 1
          ? 0
          : keyboardOptionIds.length - 1
        : (currentIndex + direction + keyboardOptionIds.length) %
          keyboardOptionIds.length;

    setActiveCategoryId(keyboardOptionIds[nextIndex]);
  }

  function commitActiveCategory() {
    if (!keyboardOptionIds.includes(activeCategoryId)) {
      return;
    }

    if (activeCategoryId === "") {
      setSelectedCategory("");
      return;
    }

    if (!activeCategory) {
      return;
    }

    if (
      isCategorySelectable({
        allowOrganizationalCategories,
        category: activeCategory,
        excludedCategoryId
      })
    ) {
      setSelectedCategory(activeCategory.id);
      return;
    }

    if (activeCategory.children.length > 0) {
      toggleExpanded(activeCategory.id);
    }
  }

  function handleComboboxKeyDown(event: ReactKeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (!isOpen) {
        openSelect();
      } else {
        moveActiveCategory(1);
      }
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (!isOpen) {
        openSelect();
      } else {
        moveActiveCategory(-1);
      }
    }

    if (event.key === "Enter" && isOpen) {
      event.preventDefault();
      commitActiveCategory();
    }

    if (event.key === "ArrowRight" && isOpen) {
      if (!activeCategory || activeCategory.children.length === 0) {
        return;
      }

      event.preventDefault();
      setExpandedCategoryIds(
        new Set(expandedCategoryIds).add(activeCategory.id)
      );
    }

    if (event.key === "ArrowLeft" && isOpen) {
      if (!activeCategory || activeCategory.children.length === 0) {
        return;
      }

      event.preventDefault();
      const nextIds = new Set(expandedCategoryIds);
      nextIds.delete(activeCategory.id);
      setExpandedCategoryIds(nextIds);
    }
  }

  function toggleExpanded(categoryId: string) {
    const nextIds = new Set(expandedCategoryIds);

    if (nextIds.has(categoryId)) {
      nextIds.delete(categoryId);
    } else {
      nextIds.add(categoryId);
    }

    setExpandedCategoryIds(nextIds);
  }

  const panel = isOpen ? (
    <TreeSelectPanel
      listboxAriaLabelledby={labelId}
      panelRef={panelRef}
      panelStyle={panelStyle}
      portalTarget={portalTarget}
      searchId={searchId}
      searchLabel={copy.searchCategories}
      searchQuery={searchQuery}
      onKeyDown={handleComboboxKeyDown}
      onSearchChange={updateSearchQuery}
    >
      <button
        aria-selected={currentSelectedId === ""}
        className={`mb-1 grid min-h-9 w-full grid-cols-[1.75rem_1fr] items-center rounded-md px-2 py-1.5 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-slate-300 ${
          activeCategoryId === ""
            ? "bg-[var(--color-accent-soft)] font-semibold text-slate-950 hover:bg-[var(--color-accent-soft)]"
            : "text-slate-700 hover:bg-slate-50"
        }`}
        role="option"
        type="button"
        onClick={() => setSelectedCategory("")}
      >
        <span />
        <span>{noSelectionLabel}</span>
      </button>
      {visibleTree.length > 0 ? (
        <ol className="grid gap-1">
          {visibleTree.map((category) => (
            <CategoryTreeSelectNode
              key={category.id}
              category={category}
              allowOrganizationalCategories={allowOrganizationalCategories}
              copy={copy}
              excludedCategoryId={excludedCategoryId}
              expandedCategoryIds={effectiveExpandedCategoryIds}
              activeCategoryId={activeCategoryId}
              level={0}
              selectedId={currentSelectedId}
              onSelect={setSelectedCategory}
              onToggleExpanded={toggleExpanded}
            />
          ))}
        </ol>
      ) : (
        <p className="px-2 py-6 text-center text-sm text-slate-500">
          {copy.noMatchingCategories}
        </p>
      )}
    </TreeSelectPanel>
  ) : null;

  return (
    <div ref={containerRef} className="relative grid gap-2">
      <span id={labelId}>
        <LabelWithError error={error}>{label}</LabelWithError>
      </span>
      <input name={name} type="hidden" value={currentSelectedId} />
      <TreeSelectButton
        ariaExpanded={isOpen}
        ariaInvalid={error ? true : undefined}
        ariaLabel={`${label} ${currentSelectedCategory?.path ?? noSelectionLabel}`}
        buttonClassName={buttonClassName}
        buttonId={buttonId}
        disabled={disabled}
        hasSelection={Boolean(currentSelectedCategory)}
        selectedLabel={currentSelectedCategory?.path ?? noSelectionLabel}
        onKeyDown={handleComboboxKeyDown}
        onToggle={() => (isOpen ? setIsOpen(false) : openSelect())}
      />
      {portalTarget ? createPortal(panel, portalTarget) : panel}
    </div>
  );
}
