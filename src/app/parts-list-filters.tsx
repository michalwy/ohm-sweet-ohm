"use client";

import type { PartCategoryListItem } from "@/server/parts/categories";
import type { ManufacturerSuggestion } from "@/app/manufacturer-autocomplete";
import { ManufacturerAutocomplete } from "@/app/manufacturer-autocomplete";
import {
  CategoryTreeSelect,
  buildCategoryTree,
  compactCategorySelectButtonClassName,
  type CategoryTreeSelectCopy
} from "@/app/parts-category-tree-select";

export type PartsListFiltersCopy = CategoryTreeSelectCopy & {
  searchParts: string;
  searchPartsPlaceholder: string;
  filterByCategory: string;
  allCategories: string;
  filterByManufacturer: string;
  allManufacturers: string;
  noMatchingManufacturers: string;
};

type PartsListFiltersProps = {
  copy: PartsListFiltersCopy;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  categoryFilterId: string;
  onCategoryChange: (id: string) => void;
  manufacturerFilter: string;
  onManufacturerChange: (value: string) => void;
  partCategories: PartCategoryListItem[];
  manufacturerOptions: ManufacturerSuggestion[];
  disabled?: boolean;
};

export function PartsListFilters({
  copy,
  searchQuery,
  onSearchChange,
  categoryFilterId,
  onCategoryChange,
  manufacturerFilter,
  onManufacturerChange,
  partCategories,
  manufacturerOptions,
  disabled = false
}: PartsListFiltersProps) {
  const categoryTree = buildCategoryTree(partCategories);

  return (
    <>
      <label className="grid min-w-72 gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]">
        {copy.searchParts}
        <input
          className="min-h-9 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-placeholder)] hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]"
          placeholder={copy.searchPartsPlaceholder}
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
        />
      </label>
      {partCategories.length > 0 ? (
        <div className="min-w-56">
          <CategoryTreeSelect
            allowOrganizationalCategories
            buttonClassName={compactCategorySelectButtonClassName}
            categories={partCategories}
            categoryTree={categoryTree}
            copy={copy}
            disabled={disabled}
            label={copy.filterByCategory}
            name="categoryFilterId"
            noSelectionLabel={copy.allCategories}
            selectedId={categoryFilterId}
            onSelectedIdChange={onCategoryChange}
          />
        </div>
      ) : null}
      <ManufacturerAutocomplete
        compact
        disabled={disabled}
        inputId="manufacturer-filter"
        label={copy.filterByManufacturer}
        noMatchingLabel={copy.noMatchingManufacturers}
        name="manufacturerFilter"
        placeholder={copy.allManufacturers}
        suggestions={manufacturerOptions}
        value={manufacturerFilter}
        onValueChange={onManufacturerChange}
      />
    </>
  );
}
