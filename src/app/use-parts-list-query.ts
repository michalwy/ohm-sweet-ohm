"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";

import { getPartsListPageForWorkspace } from "@/server/parts/listActions";
import type { PartsListItem } from "@/server/parts/getParts";
import type { ListPage } from "@/server/pagination";
import type { FilterValues } from "@/app/use-filter-url-state";
import { useDebouncedValue } from "@/app/use-debounced-value";

export type PartsListQueryOpts = {
  workspaceSlug: string;
  sorting: SortingState;
  filterValues: FilterValues;
  /** SSR initial page — used as initialData when no filters/sort are active. */
  initialPage?: ListPage<PartsListItem>;
  /** When false the query is disabled (e.g. database unavailable). Defaults to true. */
  enabled?: boolean;
  /** Pre-filter the list to a single part (set when navigating here via an entity link). */
  initialPinnedId?: string | null;
};

export function usePartsListQuery({
  workspaceSlug,
  sorting,
  filterValues,
  initialPage,
  enabled = true,
  initialPinnedId
}: PartsListQueryOpts) {
  const [pinnedId, setPinnedId] = useState<string | null>(initialPinnedId ?? null);

  const searchQuery = filterValues["search"] ?? "";
  const categoryFilterId = filterValues["category"] ?? "";
  const manufacturerFilter = filterValues["manufacturer"] ?? "";
  const stockQuantityFilter = filterValues["stockQty"] ?? "";

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const debouncedManufacturerFilter = useDebouncedValue(manufacturerFilter, 300);

  const activeSorting = sorting[0] ?? null;

  const partsQueryKey = [
    "parts-list",
    workspaceSlug,
    {
      searchQuery: debouncedSearchQuery,
      categoryFilterId,
      manufacturerFilter: debouncedManufacturerFilter,
      stockQuantityFilter,
      sorting,
      pinnedId
    }
  ] as const;

  const partsQuery = useInfiniteQuery({
    queryKey: partsQueryKey,
    enabled,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const result = await getPartsListPageForWorkspace({
        workspaceSlug,
        cursor: pageParam,
        searchQuery: debouncedSearchQuery,
        categoryFilterId,
        manufacturerFilter: debouncedManufacturerFilter,
        stockQuantityFilter: stockQuantityFilter || null,
        sortBy: activeSorting?.id ?? null,
        sortDirection: activeSorting?.desc ? "desc" : "asc",
        pinnedId
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      return result.page;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
    initialData:
      initialPage &&
      !debouncedSearchQuery &&
      !categoryFilterId &&
      !debouncedManufacturerFilter &&
      !stockQuantityFilter &&
      !pinnedId &&
      sorting.length === 0
        ? {
            pages: [initialPage],
            pageParams: [null]
          }
        : undefined
  });

  const currentParts = useMemo(
    () => partsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [partsQuery.data]
  );

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    Boolean(categoryFilterId) ||
    Boolean(manufacturerFilter) ||
    Boolean(stockQuantityFilter);

  const partsCounts = partsQuery.data?.pages[0] ??
    initialPage ?? { totalCount: 0, filteredCount: 0, items: [], nextCursor: null };

  function clearPinnedId() {
    setPinnedId(null);
  }

  return {
    // Data
    currentParts,
    partsCounts,
    hasActiveFilters,
    isLoading: partsQuery.isLoading,
    isPlaceholderData: partsQuery.isPlaceholderData,
    isError: partsQuery.isError,
    isFetchingNextPage: partsQuery.isFetchingNextPage,
    hasNextPage: Boolean(partsQuery.hasNextPage),
    fetchNextPage: () => { void partsQuery.fetchNextPage(); },
    // Pinned (navigate-to) state
    pinnedId,
    clearPinnedId
  };
}
