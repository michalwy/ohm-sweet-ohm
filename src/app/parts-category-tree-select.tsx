"use client";

import type { PartCategoryListItem } from "@/server/parts/categories";
import { LabelWithError } from "@/app/dialog-shell";
import { TreeSelectButton, TreeSelectPanel, useTreeSelect } from "@/app/tree-select";
import {
  buildTree,
  type TreeNode,
} from "@/app/tree-picker-utils";
export { getFloatingPanelStyle } from "@/app/tree-picker-utils";

export type CategoryTreeItem = TreeNode<PartCategoryListItem>;

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
  return buildTree(categories) as CategoryTreeItem[];
}

export function filterCategoryTree(
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


// ---------------------------------------------------------------------------
// Public CSS class constants
// ---------------------------------------------------------------------------

export const defaultCategorySelectButtonClassName =
  "grid min-h-11 grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-2 text-left text-base text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]";

export const compactCategorySelectButtonClassName =
  "grid min-h-9 grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-left text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]";

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
    ? "bg-[var(--color-accent-soft)] font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-accent-soft)]"
    : "bg-[var(--color-bg-elevated)] font-medium text-[var(--color-text-primary)] ring-2 ring-inset ring-[var(--color-ring-strong)]";
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
            className="grid h-7 w-7 place-items-center rounded text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)]"
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
          className={`min-h-9 rounded-md px-2 py-1.5 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] ${
            isActive ? activeClassName : "text-[var(--color-text-secondary)]"
          } ${
            isSelectable && !isSelected ? "hover:bg-[var(--color-bg-subtle)]" : ""
          } ${
            !isSelectable && !isActive ? "text-[var(--color-text-muted)]" : ""
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
  const labelId = `${name}-label`;
  const buttonId = `${name}-button`;
  const searchId = `${name}-search`;
  const currentSelectedCategory = categories.find(
    (category) => category.id === selectedId
  );

  const {
    containerRef,
    panelRef,
    isOpen,
    setIsOpen,
    searchQuery,
    setSearchQuery,
    panelStyle,
    portalTarget,
    activeId: activeCategoryId,
    visibleTree,
    effectiveExpandedIds: effectiveExpandedCategoryIds,
    activeItem: activeCategory,
    keyboardOptionIds,
    openSelect: openSelectBase,
    setSelected: setSelectedCategory,
    selectInPlace,
    toggleExpanded,
    buildHandleKeyDown,
  } = useTreeSelect({
    items: categories,
    tree: categoryTree,
    selectedId,
    filterTree: filterCategoryTree,
    onSelectedIdChange,
    includeEmptyOption: true,
  });

  function openSelect() {
    if (disabled) return;
    openSelectBase();
  }

  function updateSearchQuery(query: string) {
    const normalizedQuery = query.trim().toLocaleLowerCase("en");
    setSearchQuery(query);
    if (!normalizedQuery) return;
    const firstMatch = findFirstAssignableCategory(
      filterCategoryTree(categoryTree, normalizedQuery),
      excludedCategoryId,
      allowOrganizationalCategories
    );
    if (!firstMatch || firstMatch.id === selectedId) return;
    selectInPlace(firstMatch.id);
  }

  function commitActiveCategory() {
    if (!keyboardOptionIds.includes(activeCategoryId)) return;
    if (activeCategoryId === "") {
      setSelectedCategory("");
      return;
    }
    if (!activeCategory) return;
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

  const handleComboboxKeyDown = buildHandleKeyDown(commitActiveCategory);

  return (
    <div ref={containerRef} className="relative grid gap-2">
      <span id={labelId}>
        <LabelWithError error={error}>{label}</LabelWithError>
      </span>
      <input name={name} type="hidden" value={selectedId} />
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
      {isOpen ? (
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
            aria-selected={selectedId === ""}
            className={`mb-1 grid min-h-9 w-full grid-cols-[1.75rem_1fr] items-center rounded-md px-2 py-1.5 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] ${
              activeCategoryId === ""
                ? "bg-[var(--color-accent-soft)] font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-accent-soft)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]"
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
                  selectedId={selectedId}
                  onSelect={setSelectedCategory}
                  onToggleExpanded={toggleExpanded}
                />
              ))}
            </ol>
          ) : (
            <p className="px-2 py-6 text-center text-sm text-[var(--color-text-muted)]">
              {copy.noMatchingCategories}
            </p>
          )}
        </TreeSelectPanel>
      ) : null}
    </div>
  );
}
