"use client";

import { useMemo } from "react";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";

import { getDesignsPageForWorkspace } from "@/server/designs/designActions";
import type { DesignSortBy, DesignSummary } from "@/server/designs/designs";
import type { ListPage } from "@/server/pagination";

export type { DesignSummary };

type UseDesignsQueryOpts = {
  workspaceSlug: string;
  initialPage?: ListPage<DesignSummary>;
  sorting: SortingState;
  searchQuery?: string | null;
  createdAtFilter?: string | null;
};

const SORT_COLUMN_TO_SORT_BY: Record<string, DesignSortBy> = {
  name: "name",
  outputPart: "catalogNumber",
  createdAt: "createdAt"
};

export function useDesignsQuery({ workspaceSlug, initialPage, sorting, searchQuery, createdAtFilter }: UseDesignsQueryOpts) {
  const activeSort = sorting[0];
  const sortBy: DesignSortBy = activeSort
    ? (SORT_COLUMN_TO_SORT_BY[activeSort.id] ?? "name")
    : "name";
  const sortDir = activeSort?.desc ? "desc" : "asc";

  const query = useInfiniteQuery({
    queryKey: ["designs", workspaceSlug, { sorting, search: searchQuery, createdAt: createdAtFilter }] as const,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const result = await getDesignsPageForWorkspace({
        workspaceSlug,
        cursor: pageParam,
        sortBy,
        sortDir,
        searchQuery,
        createdAtFilter
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
    initialData:
      sorting.length === 0 && !searchQuery && !createdAtFilter && initialPage
        ? { pages: [initialPage], pageParams: [null] }
        : undefined
  });

  const currentDesigns = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data]
  );
  const totalCount = query.data?.pages[0]?.totalCount ?? 0;
  const filteredCount = query.data?.pages[0]?.filteredCount;

  return {
    query,
    currentDesigns,
    totalCount,
    filteredCount,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage
  };
}
