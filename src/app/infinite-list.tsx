"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef
} from "react";

type InfiniteListViewportProps = {
  children: ReactNode;
  className?: string;
  emptyState: ReactNode;
  errorState?: ReactNode;
  isEmpty: boolean;
  isError?: boolean;
  isInitialLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  loadingLabel: string;
  loadingMoreLabel: string;
  loadMore: () => void;
  testId?: string;
};

export function InfiniteListViewport({
  children,
  className = "relative min-h-0 flex-1 overflow-auto overscroll-contain",
  emptyState,
  errorState,
  isEmpty,
  isError = false,
  isInitialLoading,
  isFetchingNextPage,
  hasNextPage,
  loadingLabel,
  loadingMoreLabel,
  loadMore,
  testId
}: InfiniteListViewportProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;

      if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        loadMore();
      }
    },
    [hasNextPage, isFetchingNextPage, loadMore]
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel) {
      return undefined;
    }

    const observer = new IntersectionObserver(handleIntersect, {
      root: rootRef.current,
      rootMargin: "240px 0px"
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleIntersect]);

  return (
    <div ref={rootRef} className={className} data-testid={testId}>
      {isInitialLoading ? (
        <p className="p-6 text-sm text-[var(--color-text-muted)]">{loadingLabel}</p>
      ) : isError && errorState ? (
        errorState
      ) : isEmpty ? (
        emptyState
      ) : (
        children
      )}
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      {isFetchingNextPage ? (
        <p className="border-t border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
          {loadingMoreLabel}
        </p>
      ) : null}
    </div>
  );
}
