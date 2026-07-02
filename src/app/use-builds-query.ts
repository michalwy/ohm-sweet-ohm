"use client";

import { useMemo } from "react";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { getBuildsPageForWorkspace, type BuildSummary } from "@/server/builds/buildActions";
import type { ListPage } from "@/server/pagination";

export type { BuildSummary };

type UseBuildsQueryOpts = {
  workspaceSlug: string;
  initialPage?: ListPage<BuildSummary>;
};

export function useBuildsQuery({ workspaceSlug, initialPage }: UseBuildsQueryOpts) {
  const query = useInfiniteQuery({
    queryKey: ["builds", workspaceSlug] as const,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const result = await getBuildsPageForWorkspace({ workspaceSlug, cursor: pageParam });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
    initialData: initialPage ? { pages: [initialPage], pageParams: [null] } : undefined
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
