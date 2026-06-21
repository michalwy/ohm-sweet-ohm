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
      <label className="grid min-w-72 gap-1.5 text-sm font-medium text-slate-700">
        {copy.searchParts}
        <input
          className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
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
