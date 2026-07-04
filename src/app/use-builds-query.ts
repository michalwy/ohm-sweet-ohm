"use client";

import { useMemo } from "react";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { getBuildsPageForWorkspace } from "@/server/builds/buildActions";
import type { BuildSummary } from "@/server/builds/builds";
import type { ListPage } from "@/server/pagination";

export type { BuildSummary };

type UseBuildsQueryOpts = {
  workspaceSlug: string;
  initialPage?: ListPage<BuildSummary>;
  /** Pre-filter the list to a single build (set when navigating here via an entity link). */
  pinnedId?: string | null;
};

export function useBuildsQuery({ workspaceSlug, initialPage, pinnedId }: UseBuildsQueryOpts) {
  const query = useInfiniteQuery({
    queryKey: ["builds", workspaceSlug, pinnedId] as const,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const result = await getBuildsPageForWorkspace({
        workspaceSlug,
        cursor: pageParam,
        pinnedId
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
    initialData:
      initialPage && !pinnedId ? { pages: [initialPage], pageParams: [null] } : undefined
  });

  const currentBuilds = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data]
  );
  const totalCount = query.data?.pages[0]?.totalCount ?? 0;

  return {
    currentBuilds,
    totalCount,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage
  };
}
