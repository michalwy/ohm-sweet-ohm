"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";

import { getPartsListPageForWorkspace } from "@/server/parts/listActions";
import type { PartsListItem } from "@/server/parts/getParts";
import type { ListPage } from "@/server/pagination";
import { useDebouncedValue } from "@/app/use-debounced-value";

export type PartsListQueryOpts = {
  workspaceSlug: string;
  sorting: SortingState;
  /** SSR initial page — used as initialData when no filters/sort are active. */
  initialPage?: ListPage<PartsListItem>;
  /** When false the query is disabled (e.g. database unavailable). Defaults to true. */
  enabled?: boolean;
};

export function usePartsListQuery({
  workspaceSlug,
  sorting,
  initialPage,
  enabled = true
}: PartsListQueryOpts) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilterId, setCategoryFilterId] = useState("");
  const [manufacturerFilter, setManufacturerFilter] = useState("");

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
      sorting
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
        sortBy: activeSorting?.id ?? null,
        sortDirection: activeSorting?.desc ? "desc" : "asc"
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
    Boolean(manufacturerFilter);

  const partsCounts = partsQuery.data?.pages[0] ??
    initialPage ?? { totalCount: 0, filteredCount: 0, items: [], nextCursor: null };

  function clearFilters() {
    setSearchQuery("");
    setCategoryFilterId("");
    setManufacturerFilter("");
  }

  return {
    // Data
    currentParts,
    partsCounts,
    hasActiveFilters,
    isLoading: partsQuery.isLoading,
    isError: partsQuery.isError,
    isFetchingNextPage: partsQuery.isFetchingNextPage,
    hasNextPage: Boolean(partsQuery.hasNextPage),
    fetchNextPage: () => { void partsQuery.fetchNextPage(); },
    // Filter state
    searchQuery,
    setSearchQuery,
    categoryFilterId,
    setCategoryFilterId,
    manufacturerFilter,
    setManufacturerFilter,
    clearFilters
  };
}
